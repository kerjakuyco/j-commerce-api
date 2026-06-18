import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType, OrderStatus, PaymentStatus, Prisma, UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSnapTokenDto } from './dto/create-snap-token.dto';
import { MidtransNotificationDto } from './dto/midtrans-notification.dto';
import { SnapTokenEntity } from './entities/payment.entity';
import { MidtransService } from './midtrans.service';

const PAYMENT_ORDER_INCLUDE = {
  user: { select: { id: true, name: true, email: true, phone: true } },
  items: true,
  payment: true,
} satisfies Prisma.OrderInclude;

const SNAP_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly midtransService: MidtransService,
  ) {}

  async createSnapToken(
    user: AuthenticatedUser,
    dto: CreateSnapTokenDto,
  ): Promise<SnapTokenEntity> {
    const order = await this.prisma.order.findFirst({
      where: { OR: [{ id: dto.orderId }, { orderNumber: dto.orderId }] },
      include: PAYMENT_ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException('Pesanan tidak ditemukan');
    if (user.role !== UserRole.ADMIN && order.userId !== user.id) {
      throw new ForbiddenException('Anda tidak bisa membayar pesanan ini');
    }

    const now = new Date();
    // Serialize concurrent snap-token requests for the same order: lock the
    // order row for the whole critical section so the second concurrent
    // request waits, re-reads the now-persisted token, and reuses it instead
    // of creating a second Midtrans transaction for the same order_id.
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM orders WHERE id = ${order.id} FOR UPDATE`;

      const lockedOrder = await tx.order.findUnique({
        where: { id: order.id },
        include: PAYMENT_ORDER_INCLUDE,
      });
      if (!lockedOrder) throw new NotFoundException('Pesanan tidak ditemukan');

      if (
        lockedOrder.status === OrderStatus.CANCELLED ||
        lockedOrder.status === OrderStatus.DELIVERED
      ) {
        throw new BadRequestException('Pesanan tidak bisa dibayar pada status ini');
      }
      if (
        lockedOrder.status !== OrderStatus.PENDING ||
        lockedOrder.paymentStatus === PaymentStatus.PAID
      ) {
        throw new BadRequestException('Pesanan sudah dibayar atau sedang diproses');
      }

      if (this.canReuseSnapToken(lockedOrder, now)) {
        return {
          orderId: lockedOrder.id,
          orderNumber: lockedOrder.orderNumber,
          token: lockedOrder.payment!.snapToken!,
          redirectUrl: lockedOrder.payment!.snapRedirectUrl!,
          status: lockedOrder.payment!.status,
        };
      }

      const snap = await this.midtransService.createSnapTransaction(lockedOrder);
      const expiredAt = new Date(now.getTime() + SNAP_TOKEN_TTL_MS);
      const updatedPayment = await tx.payment.upsert({
        where: { orderId: lockedOrder.id },
        create: {
          orderId: lockedOrder.id,
          method: 'MIDTRANS_SNAP',
          snapToken: snap.token,
          snapRedirectUrl: snap.redirectUrl,
          amount: lockedOrder.total,
          status: PaymentStatus.UNPAID,
          expiredAt,
        },
        update: {
          method: 'MIDTRANS_SNAP',
          snapToken: snap.token,
          snapRedirectUrl: snap.redirectUrl,
          amount: lockedOrder.total,
          status: PaymentStatus.UNPAID,
          expiredAt,
        },
      });

      if (lockedOrder.paymentStatus !== PaymentStatus.UNPAID) {
        await tx.order.update({
          where: { id: lockedOrder.id },
          data: { paymentStatus: PaymentStatus.UNPAID },
        });
      }

      return {
        orderId: lockedOrder.id,
        orderNumber: lockedOrder.orderNumber,
        token: snap.token,
        redirectUrl: snap.redirectUrl,
        status: updatedPayment.status,
      };
    });
  }

  async getByOrderId(user: AuthenticatedUser, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { OR: [{ id: orderId }, { orderNumber: orderId }] },
      include: { payment: true },
    });
    if (!order) throw new NotFoundException('Pesanan tidak ditemukan');
    if (user.role !== UserRole.ADMIN && order.userId !== user.id) {
      throw new ForbiddenException('Anda tidak bisa mengakses pembayaran ini');
    }
    if (!order.payment) throw new NotFoundException('Pembayaran belum dibuat');

    return order.payment;
  }

  async handleNotification(dto: MidtransNotificationDto): Promise<{ message: string }> {
    if (!this.midtransService.verifySignature(dto)) {
      throw new BadRequestException('Signature Midtrans tidak valid');
    }

    const order = await this.prisma.order.findUnique({
      where: { orderNumber: dto.order_id },
      include: PAYMENT_ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException('Pesanan tidak ditemukan');

    const grossAmount = new Prisma.Decimal(dto.gross_amount);
    if (!this.amountsMatch(grossAmount, order.total)) {
      throw new BadRequestException('Nominal pembayaran tidak sesuai pesanan');
    }

    const paymentStatus = this.midtransService.mapPaymentStatus(dto);
    const paidAt = paymentStatus === PaymentStatus.PAID ? new Date() : undefined;

    if (order.status === OrderStatus.CANCELLED) {
      return { message: 'Notifikasi Midtrans diabaikan karena pesanan sudah dibatalkan' };
    }

    if (
      order.paymentStatus === PaymentStatus.PAID &&
      paymentStatus !== PaymentStatus.PAID &&
      paymentStatus !== PaymentStatus.REFUNDED
    ) {
      return { message: 'Notifikasi Midtrans diabaikan karena pesanan sudah dibayar' };
    }

    await this.prisma.$transaction(async (tx) => {
      // Lock order row to prevent concurrent/out-of-order notification races
      await tx.$executeRaw`SELECT id FROM orders WHERE id = ${order.id} FOR UPDATE`;

      // Idempotency + out-of-order protection, evaluated under the row lock.
      // Re-read paymentStatus here (not the stale `order` read above the tx)
      // so the decision reflects any concurrent webhook that committed first.
      const locked = await tx.order.findUnique({
        where: { id: order.id },
        select: { status: true, paymentStatus: true },
      });
      if (!locked) throw new NotFoundException('Pesanan tidak ditemukan');
      if (locked.status === OrderStatus.CANCELLED) {
        return;
      }
      if (locked.paymentStatus === PaymentStatus.PAID) {
        // Order already paid. Accept ONLY a REFUNDED notification (to mark a
        // refund). Ignore a duplicate PAID (stops Midtrans retries) AND any
        // late downgrade (EXPIRED/FAILED) so a PAID order can't be left with an
        // EXPIRED payment and dangling consumed stock/totalSold/voucher — the
        // PAID transition already decremented stock and bumped totalSold, and
        // those must not be stranded by a stale out-of-order notification.
        if (paymentStatus !== PaymentStatus.REFUNDED) {
          return;
        }
      }

      await tx.payment.upsert({
        where: { orderId: order.id },
        create: {
          orderId: order.id,
          method: 'MIDTRANS_SNAP',
          transactionId: dto.transaction_id,
          transactionStatus: dto.transaction_status,
          amount: grossAmount,
          status: paymentStatus,
          paidAt,
        },
        update: {
          transactionId: dto.transaction_id,
          transactionStatus: dto.transaction_status,
          amount: grossAmount,
          status: paymentStatus,
          paidAt,
        },
      });

      if (paymentStatus === PaymentStatus.PAID) {
        // Guarded transition (updateMany) so a race that flipped paymentStatus
        // between the read above and this write surfaces as count:0 instead of
        // P2025; under the row lock this should always match exactly one row.
        const updated = await tx.order.updateMany({
          where: {
            id: order.id,
            status: { not: OrderStatus.CANCELLED },
            paymentStatus: { not: PaymentStatus.PAID },
          },
          data: {
            paymentStatus,
            paidAt,
            ...(locked.status === OrderStatus.PENDING ? { status: OrderStatus.PAID } : {}),
          },
        });

        if (updated.count > 0) {
          await this.incrementTotalSold(tx, order);
        }

        await tx.notification.create({
          data: {
            userId: order.userId,
            type: NotificationType.ORDER,
            title: 'Pembayaran berhasil',
            body: `Pembayaran untuk pesanan ${order.orderNumber} berhasil diterima.`,
            data: { orderId: order.id },
          },
        });
        return;
      }

      if (
        (paymentStatus === PaymentStatus.EXPIRED || paymentStatus === PaymentStatus.FAILED) &&
        locked.status === OrderStatus.PENDING
      ) {
        const cancelled = await tx.order.updateMany({
          where: {
            id: order.id,
            status: OrderStatus.PENDING,
            paymentStatus: { not: PaymentStatus.PAID },
          },
          data: { status: OrderStatus.CANCELLED, paymentStatus, cancelledAt: new Date() },
        });
        if (cancelled.count > 0) {
          await this.restoreStock(tx, order);
          await this.restoreVoucher(tx, order);
          await tx.notification.create({
            data: {
              userId: order.userId,
              type: NotificationType.ORDER,
              title: 'Pembayaran tidak selesai',
              body: `Pesanan ${order.orderNumber} dibatalkan karena pembayaran tidak selesai.`,
              data: { orderId: order.id },
            },
          });
        }
        return;
      }

      await tx.order.updateMany({
        where: { id: order.id, status: { not: OrderStatus.CANCELLED } },
        data: { paymentStatus },
      });
    });

    return { message: 'Notifikasi Midtrans diproses' };
  }

  private amountsMatch(a: Prisma.Decimal.Value, b: Prisma.Decimal.Value): boolean {
    const diff = new Prisma.Decimal(a).minus(new Prisma.Decimal(b)).abs();
    return diff.lessThanOrEqualTo(0.01);
  }

  private canReuseSnapToken(
    order: Prisma.OrderGetPayload<{ include: typeof PAYMENT_ORDER_INCLUDE }>,
    now: Date,
  ): boolean {
    if (!order.payment?.snapToken || !order.payment.snapRedirectUrl) return false;
    if (order.payment.status !== PaymentStatus.UNPAID) return false;
    if (order.paymentStatus !== PaymentStatus.UNPAID || order.status !== OrderStatus.PENDING) {
      return false;
    }

    const expiredAt =
      order.payment.expiredAt ?? new Date(order.payment.createdAt.getTime() + SNAP_TOKEN_TTL_MS);
    return expiredAt > now;
  }

  private async incrementTotalSold(
    tx: Prisma.TransactionClient,
    order: Prisma.OrderGetPayload<{ include: typeof PAYMENT_ORDER_INCLUDE }>,
  ): Promise<void> {
    for (const item of order.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { totalSold: { increment: item.quantity } },
      });
    }
  }

  private async restoreStock(
    tx: Prisma.TransactionClient,
    order: Prisma.OrderGetPayload<{ include: typeof PAYMENT_ORDER_INCLUDE }>,
  ): Promise<void> {
    for (const item of order.items) {
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { stock: { increment: item.quantity } },
      });
      if (order.paymentStatus === PaymentStatus.PAID) {
        await tx.product.update({
          where: { id: item.productId },
          data: { totalSold: { decrement: item.quantity } },
        });
      }
    }
  }

  private async restoreVoucher(
    tx: Prisma.TransactionClient,
    order: Prisma.OrderGetPayload<{ include: typeof PAYMENT_ORDER_INCLUDE }>,
  ): Promise<void> {
    if (!order.voucherId) return;
    await tx.voucher.updateMany({
      where: { id: order.voucherId, usedCount: { gt: 0 } },
      data: { usedCount: { decrement: 1 } },
    });
  }
}

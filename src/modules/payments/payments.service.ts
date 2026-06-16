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
    if (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.DELIVERED) {
      throw new BadRequestException('Pesanan tidak bisa dibayar pada status ini');
    }

    if (order.payment?.snapToken && order.payment.snapRedirectUrl) {
      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        token: order.payment.snapToken,
        redirectUrl: order.payment.snapRedirectUrl,
        status: order.payment.status,
      };
    }

    const snap = await this.midtransService.createSnapTransaction(order);
    const payment = await this.prisma.payment.upsert({
      where: { orderId: order.id },
      create: {
        orderId: order.id,
        method: 'MIDTRANS_SNAP',
        snapToken: snap.token,
        snapRedirectUrl: snap.redirectUrl,
        amount: order.total,
      },
      update: {
        method: 'MIDTRANS_SNAP',
        snapToken: snap.token,
        snapRedirectUrl: snap.redirectUrl,
        amount: order.total,
      },
    });

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      token: snap.token,
      redirectUrl: snap.redirectUrl,
      status: payment.status,
    };
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

    const order = await this.prisma.order.findUnique({ where: { orderNumber: dto.order_id } });
    if (!order) throw new NotFoundException('Pesanan tidak ditemukan');

    const paymentStatus = this.midtransService.mapPaymentStatus(dto);
    const paidAt = paymentStatus === PaymentStatus.PAID ? new Date() : undefined;

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.upsert({
        where: { orderId: order.id },
        create: {
          orderId: order.id,
          method: 'MIDTRANS_SNAP',
          transactionId: dto.transaction_id,
          transactionStatus: dto.transaction_status,
          amount: new Prisma.Decimal(dto.gross_amount),
          status: paymentStatus,
          paidAt,
        },
        update: {
          transactionId: dto.transaction_id,
          transactionStatus: dto.transaction_status,
          status: paymentStatus,
          paidAt,
        },
      });

      await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus,
          ...(paymentStatus === PaymentStatus.PAID ? { status: OrderStatus.PAID, paidAt } : {}),
        },
      });

      if (paymentStatus === PaymentStatus.PAID) {
        await tx.notification.create({
          data: {
            userId: order.userId,
            type: NotificationType.ORDER,
            title: 'Pembayaran berhasil',
            body: `Pembayaran untuk pesanan ${order.orderNumber} berhasil diterima.`,
            data: { orderId: order.id },
          },
        });
      }
    });

    return { message: 'Notifikasi Midtrans diproses' };
  }
}

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  NotificationType,
  OrderStatus,
  PaymentStatus,
  Prisma,
  ShippingMethod,
  UserRole,
  Voucher,
  VoucherType,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrderDto } from './dto/query-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

const ORDER_INCLUDE = {
  user: { select: { id: true, name: true, email: true, phone: true } },
  address: true,
  voucher: true,
  payment: true,
  items: {
    orderBy: { createdAt: 'asc' },
    include: {
      product: { select: { id: true, slug: true, brand: true } },
      variant: { select: { id: true, sku: true, stock: true } },
    },
  },
} satisfies Prisma.OrderInclude;

type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>;

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateOrderDto): Promise<OrderWithRelations> {
    const existingOrder = await this.findByClientRequestId(dto.clientRequestId, userId);
    if (existingOrder) return existingOrder;

    const seen = new Set<string>();
    for (const item of dto.items) {
      const key = `${item.productId}:${item.variantId}`;
      if (seen.has(key)) {
        throw new BadRequestException('Item duplikat ditemukan dalam pesanan');
      }
      seen.add(key);
    }

    const shippingMethod = dto.shippingMethod ?? ShippingMethod.REGULAR;
    const shippingCost = new Prisma.Decimal(this.getShippingCost(shippingMethod));

    const address = await this.prisma.address.findFirst({
      where: { id: dto.addressId, userId },
      select: { id: true },
    });
    if (!address) throw new NotFoundException('Alamat tidak ditemukan');

    try {
      return await this.prisma.$transaction(async (tx) => {
        let subtotal = new Prisma.Decimal(0);
        const orderItems: Prisma.OrderItemCreateWithoutOrderInput[] = [];

        for (const item of dto.items) {
          const variant = await tx.productVariant.findFirst({
            where: { id: item.variantId, productId: item.productId },
            include: {
              product: {
                include: { images: { orderBy: { sortOrder: 'asc' }, take: 1 } },
              },
            },
          });

          if (!variant || variant.product.deletedAt || !variant.product.isActive) {
            throw new NotFoundException('Produk atau varian tidak ditemukan');
          }
          if (variant.stock < item.quantity) {
            throw new BadRequestException(`Stok ${variant.product.name} tidak mencukupi`);
          }

          const updated = await tx.productVariant.updateMany({
            where: { id: variant.id, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity } },
          });
          if (updated.count === 0) {
            throw new BadRequestException(`Stok ${variant.product.name} baru saja berubah`);
          }

          const price = new Prisma.Decimal(variant.price);
          const lineSubtotal = price.mul(item.quantity);
          subtotal = subtotal.add(lineSubtotal);
          orderItems.push({
            product: { connect: { id: variant.productId } },
            variant: { connect: { id: variant.id } },
            productName: variant.product.name,
            productImage: variant.product.images[0]?.url ?? null,
            variantName: variant.name,
            quantity: item.quantity,
            price,
            subtotal: lineSubtotal,
          });
        }

        const voucher = dto.voucherCode
          ? await this.reserveVoucher(tx, dto.voucherCode, subtotal)
          : null;
        const discount = voucher
          ? this.calculateDiscount(voucher, subtotal)
          : new Prisma.Decimal(0);
        const total = subtotal.add(shippingCost).sub(discount);
        const orderNumber = this.generateOrderNumber();

        const order = await tx.order.create({
          data: {
            orderNumber,
            clientRequestId: dto.clientRequestId,
            userId,
            addressId: dto.addressId,
            shippingMethod,
            shippingCost,
            subtotal,
            discount,
            total,
            voucherId: voucher?.id,
            notes: dto.notes,
            items: { create: orderItems },
          },
          include: ORDER_INCLUDE,
        });

        await tx.cartItem.deleteMany({
          where: {
            userId,
            OR: dto.items.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
            })),
          },
        });

        await this.createOrderNotification(
          tx,
          userId,
          order.id,
          'Pesanan dibuat',
          `Pesanan ${order.orderNumber} berhasil dibuat dan menunggu pembayaran.`,
        );

        return order;
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const existing = await this.findByClientRequestId(dto.clientRequestId, userId);
        if (existing) return existing;
      }
      throw e;
    }
  }

  async findAll(user: AuthenticatedUser, query: QueryOrderDto) {
    const {
      page = 1,
      limit = 20,
      status,
      paymentStatus,
      shippingMethod,
      search,
    } = query;
    const trimmedSearch = search?.trim();
    const where: Prisma.OrderWhereInput = {
      ...(user.role === UserRole.ADMIN ? {} : { userId: user.id }),
      ...(status ? { status } : {}),
      ...(paymentStatus ? { paymentStatus } : {}),
      ...(shippingMethod ? { shippingMethod } : {}),
      ...(trimmedSearch
        ? {
            OR: [
              { orderNumber: { contains: trimmedSearch } },
              { trackingNumber: { contains: trimmedSearch } },
              { user: { is: { name: { contains: trimmedSearch } } } },
              { user: { is: { email: { contains: trimmedSearch } } } },
              { user: { is: { phone: { contains: trimmedSearch } } } },
              { address: { is: { recipient: { contains: trimmedSearch } } } },
              { address: { is: { phone: { contains: trimmedSearch } } } },
              { address: { is: { city: { contains: trimmedSearch } } } },
              { voucher: { is: { code: { contains: trimmedSearch } } } },
              { items: { some: { productName: { contains: trimmedSearch } } } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: ORDER_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, user: AuthenticatedUser): Promise<OrderWithRelations> {
    const order = await this.prisma.order.findFirst({
      where: { OR: [{ id }, { orderNumber: id }] },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException('Pesanan tidak ditemukan');

    if (user.role !== UserRole.ADMIN && order.userId !== user.id) {
      throw new ForbiddenException('Anda tidak bisa mengakses pesanan ini');
    }

    return order;
  }

  async cancel(
    id: string,
    user: AuthenticatedUser,
    dto: CancelOrderDto = {},
  ): Promise<OrderWithRelations> {
    const order = await this.findOne(id, user);
    if (order.userId !== user.id && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Anda hanya bisa membatalkan pesanan sendiri');
    }
    if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.PAID) {
      throw new BadRequestException('Pesanan tidak bisa dibatalkan pada status ini');
    }

    const cancelReason = dto.reason?.trim() || null;

    return this.prisma.$transaction(async (tx) => {
      // Lock the order row for the whole critical section so a concurrent
      // payment webhook (which also locks the order) can't flip paymentStatus
      // to PAID between our read and our writes. All decisions below are
      // derived from the freshly locked row, not the stale `order` captured
      // outside the transaction — otherwise a PAID order could be cancelled
      // with paymentStatus=EXPIRED and skip the totalSold decrement.
      await tx.$executeRaw`SELECT id FROM orders WHERE id = ${order.id} FOR UPDATE`;

      const locked = await tx.order.findUnique({
        where: { id: order.id },
        include: ORDER_INCLUDE,
      });
      if (!locked) throw new NotFoundException('Pesanan tidak ditemukan');
      if (locked.status !== OrderStatus.PENDING && locked.status !== OrderStatus.PAID) {
        throw new BadRequestException('Pesanan tidak bisa dibatalkan pada status ini');
      }

      const paymentStatus =
        locked.paymentStatus === PaymentStatus.PAID
          ? PaymentStatus.REFUNDED
          : PaymentStatus.EXPIRED;
      const cancelled = await tx.order.updateMany({
        where: { id: locked.id, status: locked.status },
        data: {
          status: OrderStatus.CANCELLED,
          paymentStatus,
          cancelReason,
          cancelledAt: new Date(),
        },
      });
      if (cancelled.count === 0) {
        throw new ConflictException(
          'Status pesanan berubah sebelum dibatalkan, silakan muat ulang',
        );
      }

      await this.restoreStock(tx, locked);
      await this.restoreVoucher(tx, locked);

      await tx.payment.updateMany({
        where: { orderId: locked.id },
        data: { status: paymentStatus },
      });

      await this.createOrderNotification(
        tx,
        locked.userId,
        locked.id,
        'Pesanan dibatalkan',
        cancelReason
          ? `Pesanan ${locked.orderNumber} berhasil dibatalkan. Alasan: ${cancelReason}`
          : `Pesanan ${locked.orderNumber} berhasil dibatalkan.`,
      );

      const updated = await tx.order.findUnique({
        where: { id: locked.id },
        include: ORDER_INCLUDE,
      });
      if (!updated) throw new NotFoundException('Pesanan tidak ditemukan');

      return updated;
    });
  }

  async confirmReceived(id: string, user: AuthenticatedUser): Promise<OrderWithRelations> {
    const order = await this.findOne(id, user);
    if (order.userId !== user.id) {
      throw new ForbiddenException('Hanya pemilik pesanan yang bisa konfirmasi diterima');
    }
    if (order.status !== OrderStatus.SHIPPED) {
      throw new BadRequestException('Pesanan hanya bisa dikonfirmasi saat status SHIPPED');
    }

    return this.updateOrderAndNotify(order, OrderStatus.SHIPPED, {
      status: OrderStatus.DELIVERED,
      deliveredAt: new Date(),
    });
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto): Promise<OrderWithRelations> {
    const order = await this.prisma.order.findFirst({
      where: { OR: [{ id }, { orderNumber: id }] },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException('Pesanan tidak ditemukan');
    if (dto.status === OrderStatus.CANCELLED) {
      throw new BadRequestException(
        'Gunakan endpoint cancel agar stok dan pembayaran diproses benar',
      );
    }

    const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.PAID],
      [OrderStatus.PAID]: [OrderStatus.PACKED],
      [OrderStatus.PACKED]: [OrderStatus.SHIPPED],
      [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
      [OrderStatus.DELIVERED]: [],
      [OrderStatus.CANCELLED]: [],
    };

    if (!allowedTransitions[order.status]?.includes(dto.status)) {
      throw new BadRequestException(
        `Status pesanan tidak bisa diubah dari ${order.status} ke ${dto.status}`,
      );
    }

    if (dto.status === OrderStatus.PAID && order.paymentStatus !== PaymentStatus.PAID) {
      throw new BadRequestException('Pesanan belum dibayar');
    }

    const data: Prisma.OrderUpdateManyMutationInput = {
      status: dto.status,
      trackingNumber: dto.trackingNumber,
      ...this.statusTimestamp(dto.status),
    };

    return this.updateOrderAndNotify(order, order.status, data);
  }

  private async updateOrderAndNotify(
    order: OrderWithRelations,
    expectedStatus: OrderStatus,
    data: Prisma.OrderUpdateManyMutationInput,
  ): Promise<OrderWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      // Guarded transition: only apply the write if the order is still in the
      // expected status. If a concurrent transition already moved the order,
      // updateMany matches 0 rows and we surface a 409 instead of a silent
      // last-writer-wins (e.g. a PENDING->PACKED jump over PAID).
      const result = await tx.order.updateMany({
        where: { id: order.id, status: expectedStatus },
        data,
      });
      if (result.count === 0) {
        throw new ConflictException(
          `Status pesanan berubah sebelum diperbarui, silakan muat ulang`,
        );
      }

      const updated = await tx.order.findUnique({
        where: { id: order.id },
        include: ORDER_INCLUDE,
      });
      if (!updated) throw new NotFoundException('Pesanan tidak ditemukan');

      await this.createOrderNotification(
        tx,
        order.userId,
        order.id,
        'Status pesanan diperbarui',
        `Pesanan ${order.orderNumber} sekarang berstatus ${updated.status}.`,
      );

      return updated;
    });
  }

  private async findByClientRequestId(
    clientRequestId: string | undefined,
    userId: string,
  ): Promise<OrderWithRelations | null> {
    if (!clientRequestId) return null;

    const order = await this.prisma.order.findUnique({
      where: { clientRequestId },
      include: ORDER_INCLUDE,
    });
    if (!order) return null;
    if (order.userId !== userId) {
      throw new ConflictException('Idempotency key sudah digunakan');
    }

    return order;
  }

  private async reserveVoucher(
    tx: Prisma.TransactionClient,
    code: string,
    subtotal: Prisma.Decimal,
  ): Promise<Voucher> {
    await tx.$executeRaw`SELECT id FROM vouchers WHERE code = ${code.toUpperCase()} FOR UPDATE`;
    const voucher = await tx.voucher.findUnique({ where: { code: code.toUpperCase() } });
    const now = new Date();
    if (
      !voucher ||
      !voucher.isActive ||
      voucher.startsAt > now ||
      voucher.expiresAt < now ||
      voucher.usedCount >= voucher.quota
    ) {
      throw new BadRequestException('Voucher tidak valid atau sudah habis');
    }

    if (subtotal.lessThan(voucher.minPurchase)) {
      throw new BadRequestException('Subtotal belum memenuhi minimal pembelian voucher');
    }

    const reserved = await tx.voucher.updateMany({
      where: {
        id: voucher.id,
        isActive: true,
        startsAt: { lte: now },
        expiresAt: { gte: now },
        quota: voucher.quota,
        usedCount: { lt: voucher.quota },
      },
      data: { usedCount: { increment: 1 } },
    });
    if (reserved.count === 0) {
      throw new BadRequestException('Voucher tidak valid atau sudah habis');
    }

    return voucher;
  }

  private calculateDiscount(voucher: Voucher, subtotal: Prisma.Decimal): Prisma.Decimal {
    let discount =
      voucher.type === VoucherType.PERCENTAGE
        ? subtotal.mul(new Prisma.Decimal(voucher.value)).div(100)
        : new Prisma.Decimal(voucher.value);

    if (voucher.maxDiscount && discount.greaterThan(voucher.maxDiscount)) {
      discount = new Prisma.Decimal(voucher.maxDiscount);
    }
    if (discount.greaterThan(subtotal)) discount = subtotal;

    return discount;
  }

  private async restoreStock(
    tx: Prisma.TransactionClient,
    order: OrderWithRelations,
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
    order: OrderWithRelations,
  ): Promise<void> {
    if (!order.voucherId) return;
    await tx.voucher.updateMany({
      where: { id: order.voucherId, usedCount: { gt: 0 } },
      data: { usedCount: { decrement: 1 } },
    });
  }

  private statusTimestamp(status: OrderStatus): Prisma.OrderUpdateManyMutationInput {
    const now = new Date();
    switch (status) {
      case OrderStatus.PAID:
        return { paidAt: now };
      case OrderStatus.SHIPPED:
        return { shippedAt: now };
      case OrderStatus.DELIVERED:
        return { deliveredAt: now };
      default:
        return {};
    }
  }

  private async createOrderNotification(
    tx: Prisma.TransactionClient,
    userId: string,
    orderId: string,
    title: string,
    body: string,
  ): Promise<void> {
    await tx.notification.create({
      data: {
        userId,
        type: NotificationType.ORDER,
        title,
        body,
        data: { orderId },
      },
    });
  }

  private getShippingCost(method: ShippingMethod): number {
    switch (method) {
      case ShippingMethod.SAME_DAY:
        return 50000;
      case ShippingMethod.EXPRESS:
        return 30000;
      case ShippingMethod.REGULAR:
      default:
        return 15000;
    }
  }

  private generateOrderNumber(): string {
    const date = new Date();
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const suffix = randomBytes(3).toString('hex').toUpperCase().slice(0, 5);

    return `INV-${y}${m}${d}-${suffix}`;
  }
}

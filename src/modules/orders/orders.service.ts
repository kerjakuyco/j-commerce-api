import {
  BadRequestException,
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
    const shippingMethod = dto.shippingMethod ?? ShippingMethod.REGULAR;
    const shippingCost = new Prisma.Decimal(this.getShippingCost(shippingMethod));

    const address = await this.prisma.address.findFirst({
      where: { id: dto.addressId, userId },
      select: { id: true },
    });
    if (!address) throw new NotFoundException('Alamat tidak ditemukan');

    return this.prisma.$transaction(async (tx) => {
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

        await tx.product.update({
          where: { id: variant.productId },
          data: { totalSold: { increment: item.quantity } },
        });

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
        ? await this.validateVoucher(tx, dto.voucherCode, subtotal)
        : null;
      const discount = voucher ? this.calculateDiscount(voucher, subtotal) : new Prisma.Decimal(0);
      const total = subtotal.add(shippingCost).sub(discount);
      const orderNumber = this.generateOrderNumber();

      const order = await tx.order.create({
        data: {
          orderNumber,
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

      if (voucher) {
        await tx.voucher.update({
          where: { id: voucher.id },
          data: { usedCount: { increment: 1 } },
        });
      }

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
  }

  async findAll(user: AuthenticatedUser, query: QueryOrderDto) {
    const { page = 1, limit = 20, status } = query;
    const where: Prisma.OrderWhereInput = {
      ...(user.role === UserRole.ADMIN ? {} : { userId: user.id }),
      ...(status ? { status } : {}),
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

  async cancel(id: string, user: AuthenticatedUser): Promise<OrderWithRelations> {
    const order = await this.findOne(id, user);
    if (order.userId !== user.id && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Anda hanya bisa membatalkan pesanan sendiri');
    }
    if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.PAID) {
      throw new BadRequestException('Pesanan tidak bisa dibatalkan pada status ini');
    }

    return this.prisma.$transaction(async (tx) => {
      await this.restoreStock(tx, order);
      const paymentStatus =
        order.paymentStatus === PaymentStatus.PAID ? PaymentStatus.REFUNDED : PaymentStatus.EXPIRED;

      const updated = await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.CANCELLED, paymentStatus, cancelledAt: new Date() },
        include: ORDER_INCLUDE,
      });

      await tx.payment.updateMany({
        where: { orderId: order.id },
        data: { status: paymentStatus },
      });

      await this.createOrderNotification(
        tx,
        order.userId,
        order.id,
        'Pesanan dibatalkan',
        `Pesanan ${order.orderNumber} berhasil dibatalkan.`,
      );

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

    return this.updateOrderAndNotify(order, {
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

    const data: Prisma.OrderUpdateInput = {
      status: dto.status,
      trackingNumber: dto.trackingNumber,
      ...this.statusTimestamp(dto.status),
    };
    if (dto.status === OrderStatus.PAID) data.paymentStatus = PaymentStatus.PAID;
    if (dto.status === OrderStatus.CANCELLED) data.cancelledAt = new Date();

    return this.updateOrderAndNotify(order, data);
  }

  private async updateOrderAndNotify(
    order: OrderWithRelations,
    data: Prisma.OrderUpdateInput,
  ): Promise<OrderWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: order.id },
        data,
        include: ORDER_INCLUDE,
      });

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

  private async validateVoucher(
    tx: Prisma.TransactionClient,
    code: string,
    subtotal: Prisma.Decimal,
  ): Promise<Voucher> {
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
      await tx.product.update({
        where: { id: item.productId },
        data: { totalSold: { decrement: item.quantity } },
      });
    }
  }

  private statusTimestamp(status: OrderStatus): Prisma.OrderUpdateInput {
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

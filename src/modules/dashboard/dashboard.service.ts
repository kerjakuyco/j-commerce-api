import { Injectable } from '@nestjs/common';
import { OrderStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const REVENUE_STATUSES = [
  OrderStatus.PAID,
  OrderStatus.PACKED,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [revenue, ordersThisMonth, ordersPreviousMonth, customers, products, recentOrders] =
      await Promise.all([
        this.prisma.order.aggregate({
          where: { status: { in: REVENUE_STATUSES }, createdAt: { gte: monthStart } },
          _sum: { total: true },
        }),
        this.prisma.order.count({ where: { createdAt: { gte: monthStart } } }),
        this.prisma.order.count({
          where: { createdAt: { gte: previousMonthStart, lt: monthStart } },
        }),
        this.prisma.user.count({
          where: { role: UserRole.CUSTOMER, deletedAt: null },
        }),
        this.prisma.product.count({ where: { deletedAt: null, isActive: true } }),
        this.prisma.order.findMany({
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            user: { select: { id: true, name: true, email: true } },
            _count: { select: { items: true } },
          },
        }),
      ]);

    return {
      totalRevenue: Number(revenue._sum.total ?? 0),
      totalOrders: ordersThisMonth,
      orderGrowthPercent: this.calculateGrowth(ordersThisMonth, ordersPreviousMonth),
      totalCustomers: customers,
      totalProducts: products,
      recentOrders,
    };
  }

  async getRevenueChart(period: '7d' | '30d' | '90d' | '1y' = '30d') {
    const days = this.periodToDays(period);
    const start = new Date();
    start.setDate(start.getDate() - days + 1);
    start.setHours(0, 0, 0, 0);

    const orders = await this.prisma.order.findMany({
      where: { status: { in: REVENUE_STATUSES }, createdAt: { gte: start } },
      select: { createdAt: true, total: true },
      orderBy: { createdAt: 'asc' },
    });

    const buckets = new Map<string, { date: string; total: number; orders: number }>();
    for (let i = 0; i < days; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const key = this.dateKey(date);
      buckets.set(key, { date: key, total: 0, orders: 0 });
    }

    for (const order of orders) {
      const key = this.dateKey(order.createdAt);
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.total += Number(order.total);
        bucket.orders += 1;
      }
    }

    return Array.from(buckets.values());
  }

  async getTopProducts(limit = 10) {
    const grouped = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      _sum: { quantity: true, subtotal: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: limit,
    });

    const products = await this.prisma.product.findMany({
      where: { id: { in: grouped.map((item) => item.productId) } },
      include: { images: { orderBy: { sortOrder: 'asc' }, take: 1 } },
    });
    const productMap = new Map(products.map((product) => [product.id, product]));

    return grouped.map((item) => ({
      product: productMap.get(item.productId),
      totalSold: item._sum.quantity ?? 0,
      revenue: Number(item._sum.subtotal ?? 0),
    }));
  }

  async getOrderStatusBreakdown() {
    const grouped = await this.prisma.order.groupBy({
      by: ['status'],
      _count: true,
    });

    return Object.values(OrderStatus).map((status) => ({
      status,
      count: grouped.find((item) => item.status === status)?._count ?? 0,
    }));
  }

  private periodToDays(period: '7d' | '30d' | '90d' | '1y'): number {
    switch (period) {
      case '7d':
        return 7;
      case '90d':
        return 90;
      case '1y':
        return 365;
      case '30d':
      default:
        return 30;
    }
  }

  private dateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private calculateGrowth(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;

    return Number((((current - previous) / previous) * 100).toFixed(2));
  }
}

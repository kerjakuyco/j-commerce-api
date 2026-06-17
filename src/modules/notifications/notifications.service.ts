import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BroadcastNotificationDto, QueryNotificationDto } from './dto/notification.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, query: QueryNotificationDto) {
    const { page = 1, limit = 20 } = query;
    const where: Prisma.NotificationWhereInput = {
      OR: [{ userId }, { userId: null }],
      ...(query.unreadOnly ? { isRead: false } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async markRead(userId: string, id: string) {
    const notification = await this.findAccessible(userId, id);

    // Broadcast notifications (userId === null) are shared across all users.
    // Mutating isRead on the shared row would mark it read for everyone, so
    // refuse to mark broadcasts read here. A per-user read-state table is the
    // full fix but out of scope; for now we just protect the shared row.
    if (notification.userId === null) {
      throw new ForbiddenException('Notifikasi broadcast tidak bisa ditandai dibaca per user');
    }

    return this.prisma.notification.update({
      where: { id: notification.id },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: string): Promise<{ message: string; count: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return { message: 'Semua notifikasi ditandai sudah dibaca', count: result.count };
  }

  async remove(userId: string, id: string): Promise<{ message: string }> {
    const notification = await this.findAccessible(userId, id);
    if (notification.userId === null) {
      throw new ForbiddenException('Notifikasi broadcast tidak bisa dihapus user');
    }

    await this.prisma.notification.delete({ where: { id: notification.id } });

    return { message: 'Notifikasi berhasil dihapus' };
  }

  broadcast(dto: BroadcastNotificationDto) {
    return this.prisma.notification.create({
      data: {
        userId: null,
        type: dto.type,
        title: dto.title,
        body: dto.body,
        data: dto.data === undefined ? Prisma.JsonNull : (dto.data as Prisma.InputJsonValue),
      },
    });
  }

  createOrderNotification(userId: string, orderId: string, title: string, body: string) {
    return this.prisma.notification.create({
      data: {
        userId,
        type: NotificationType.ORDER,
        title,
        body,
        data: { orderId },
      },
    });
  }

  private async findAccessible(userId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, OR: [{ userId }, { userId: null }] },
    });
    if (!notification) throw new NotFoundException('Notifikasi tidak ditemukan');

    return notification;
  }
}

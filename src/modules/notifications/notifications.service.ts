import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BroadcastNotificationDto, QueryNotificationDto } from './dto/notification.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(userId: string, query: QueryNotificationDto) {
    return this.prisma.notification.findMany({
      where: {
        OR: [{ userId }, { userId: null }],
        ...(query.unreadOnly ? { isRead: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markRead(userId: string, id: string) {
    const notification = await this.findAccessible(userId, id);

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

import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const WISHLIST_ITEM_INCLUDE = {
  product: {
    include: {
      category: { select: { id: true, name: true, slug: true, icon: true } },
      images: { orderBy: { sortOrder: 'asc' }, take: 1 },
    },
  },
} satisfies Prisma.WishlistItemInclude;

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(userId: string) {
    return this.prisma.wishlistItem.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: WISHLIST_ITEM_INCLUDE,
    });
  }

  async add(userId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, deletedAt: null, isActive: true },
      select: { id: true },
    });
    if (!product) {
      throw new NotFoundException('Produk tidak ditemukan');
    }

    return this.prisma.wishlistItem.upsert({
      where: { userId_productId: { userId, productId } },
      update: {},
      create: { userId, productId },
      include: WISHLIST_ITEM_INCLUDE,
    });
  }

  async remove(userId: string, productId: string): Promise<{ message: string }> {
    const result = await this.prisma.wishlistItem.deleteMany({
      where: { userId, productId },
    });
    if (result.count === 0) {
      throw new NotFoundException('Produk tidak ada di wishlist');
    }

    return { message: 'Produk berhasil dihapus dari wishlist' };
  }
}

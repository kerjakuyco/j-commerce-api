import { Injectable, NotFoundException } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { OrderStatus, Prisma, Review } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async findByProduct(productId: string, page = 1, limit = 10, minRating?: number) {
    const where: Prisma.ReviewWhereInput = { productId };
    if (minRating !== undefined) where.rating = { gte: minRating };

    const [data, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { id: true, name: true, avatar: true } } },
      }),
      this.prisma.review.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async create(productId: string, userId: string, dto: CreateReviewDto): Promise<Review> {
    // Eligibility check: user must have ordered AND received this product
    const eligible = await this.prisma.orderItem.findFirst({
      where: {
        productId,
        order: {
          userId,
          status: OrderStatus.DELIVERED,
        },
      },
    });
    if (!eligible) {
      throw new ForbiddenException('Anda hanya bisa review produk yang sudah diterima');
    }

    // Check duplicate
    const existing = await this.prisma.review.findUnique({
      where: { productId_userId: { productId, userId } },
    });
    if (existing) {
      throw new ForbiddenException('Anda sudah mereview produk ini');
    }

    const review = await this.prisma.review.create({
      data: {
        productId,
        userId,
        rating: dto.rating,
        comment: dto.comment,
        images: dto.imageUrls ?? Prisma.JsonNull,
        isVerified: true,
      },
    });

    // Update product rating avg + count
    await this._recalculateProductRating(productId);

    return review;
  }

  async update(id: string, userId: string, dto: Partial<CreateReviewDto>): Promise<Review> {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Review tidak ditemukan');
    if (review.userId !== userId) {
      throw new ForbiddenException('Anda hanya bisa edit review sendiri');
    }
    const updated = await this.prisma.review.update({
      where: { id },
      data: {
        rating: dto.rating,
        comment: dto.comment,
        images: dto.imageUrls ?? undefined,
      },
    });
    await this._recalculateProductRating(review.productId);
    return updated;
  }

  async remove(id: string, userId: string, isAdmin: boolean): Promise<void> {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Review tidak ditemukan');
    if (review.userId !== userId && !isAdmin) {
      throw new ForbiddenException('Anda hanya bisa hapus review sendiri');
    }
    await this.prisma.review.delete({ where: { id } });
    await this._recalculateProductRating(review.productId);
  }

  private async _recalculateProductRating(productId: string): Promise<void> {
    const agg = await this.prisma.review.aggregate({
      where: { productId },
      _avg: { rating: true },
      _count: true,
    });
    await this.prisma.product.update({
      where: { id: productId },
      data: {
        rating: agg._avg.rating ?? 0,
        totalReview: agg._count,
      },
    });
  }
}

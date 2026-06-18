import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma, Review } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReviewDto, UpdateReviewDto } from './dto/create-review.dto';

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

    return this.prisma.$transaction(async (tx) => {
      // Duplicate check + create + rating recalculation must be atomic, with
      // the product row locked, so two concurrent reviews on the same product
      // can't both pass the duplicate check (P2002 -> 500) or race on the
      // aggregate -> product update (lost update undercounting totalReview).
      await tx.$executeRaw`SELECT id FROM products WHERE id = ${productId} FOR UPDATE`;

      const existing = await tx.review.findUnique({
        where: { productId_userId: { productId, userId } },
      });
      if (existing) {
        throw new ForbiddenException('Anda sudah mereview produk ini');
      }

      let review: Review;
      try {
        review = await tx.review.create({
          data: {
            productId,
            userId,
            rating: dto.rating,
            comment: dto.comment,
            images: dto.imageUrls ?? Prisma.JsonNull,
            isVerified: true,
          },
        });
      } catch (e) {
        // Backstop for the duplicate-check TOCTOU: two concurrent creates for
        // the same (product, user) both pass findUnique, the unique constraint
        // rejects the second — surface a clean 403 instead of a 500.
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          throw new ForbiddenException('Anda sudah mereview produk ini');
        }
        throw e;
      }

      await this._recalculateProductRating(tx, productId);
      return review;
    });
  }

  async update(id: string, userId: string, dto: UpdateReviewDto): Promise<Review> {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Review tidak ditemukan');
    if (review.userId !== userId) {
      throw new ForbiddenException('Anda hanya bisa edit review sendiri');
    }

    return this.prisma.$transaction(async (tx) => {
      // Lock the product row so concurrent review mutations on the same
      // product serialize and the aggregate -> product update isn't lost.
      await tx.$executeRaw`SELECT id FROM products WHERE id = ${review.productId} FOR UPDATE`;
      const updated = await tx.review.update({
        where: { id },
        data: {
          rating: dto.rating,
          comment: dto.comment,
          images: dto.imageUrls ?? undefined,
        },
      });
      await this._recalculateProductRating(tx, review.productId);
      return updated;
    });
  }

  async remove(id: string, userId: string, isAdmin: boolean): Promise<void> {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Review tidak ditemukan');
    if (review.userId !== userId && !isAdmin) {
      throw new ForbiddenException('Anda hanya bisa hapus review sendiri');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM products WHERE id = ${review.productId} FOR UPDATE`;
      await tx.review.delete({ where: { id } });
      await this._recalculateProductRating(tx, review.productId);
    });
  }

  private async _recalculateProductRating(
    tx: Prisma.TransactionClient,
    productId: string,
  ): Promise<void> {
    const agg = await tx.review.aggregate({
      where: { productId },
      _avg: { rating: true },
      _count: true,
    });
    await tx.product.update({
      where: { id: productId },
      data: {
        rating: agg._avg.rating ?? 0,
        totalReview: agg._count,
      },
    });
  }
}
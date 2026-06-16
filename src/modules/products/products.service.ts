import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Product } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProductDto, QueryProductDto, UpdateProductDto } from './dto/product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================
  // QUERIES (public)
  // ============================================

  async findAll(query: QueryProductDto) {
    const {
      page = 1,
      limit = 20,
      categoryId,
      search,
      minPrice,
      maxPrice,
      minRating,
      sort = 'newest',
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      isActive: true,
    };
    if (categoryId) where.categoryId = categoryId;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { brand: { contains: search } },
        { description: { contains: search } },
      ];
    }
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.basePrice = {};
      if (minPrice !== undefined) where.basePrice.gte = minPrice;
      if (maxPrice !== undefined) where.basePrice.lte = maxPrice;
    }
    if (minRating !== undefined) where.rating = { gte: minRating };

    const orderBy: Prisma.ProductOrderByWithRelationInput = (() => {
      switch (sort) {
        case 'price_asc':
          return { basePrice: 'asc' };
        case 'price_desc':
          return { basePrice: 'desc' };
        case 'rating':
          return { rating: 'desc' };
        case 'sold':
          return { totalSold: 'desc' };
        case 'newest':
        default:
          return { createdAt: 'desc' };
      }
    })();

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          category: { select: { id: true, name: true, slug: true, icon: true } },
          images: { orderBy: { sortOrder: 'asc' }, take: 1 },
          _count: { select: { variants: true, reviews: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findFeatured(limit = 10) {
    return this.prisma.product.findMany({
      where: { isFeatured: true, deletedAt: null, isActive: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        category: { select: { id: true, name: true, slug: true, icon: true } },
        images: { orderBy: { sortOrder: 'asc' }, take: 1 },
      },
    });
  }

  async findFlashSale(limit = 10) {
    return this.prisma.product.findMany({
      where: {
        isFlashSale: true,
        deletedAt: null,
        isActive: true,
        OR: [{ flashSaleEndsAt: null }, { flashSaleEndsAt: { gt: new Date() } }],
      },
      orderBy: { flashSaleEndsAt: 'asc' },
      take: limit,
      include: {
        category: { select: { id: true, name: true, slug: true, icon: true } },
        images: { orderBy: { sortOrder: 'asc' }, take: 1 },
      },
    });
  }

  async findRelated(productId: string, limit = 6) {
    const me = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { categoryId: true },
    });
    if (!me) return [];
    return this.prisma.product.findMany({
      where: {
        categoryId: me.categoryId,
        id: { not: productId },
        deletedAt: null,
        isActive: true,
      },
      take: limit,
      include: {
        images: { orderBy: { sortOrder: 'asc' }, take: 1 },
      },
    });
  }

  async findOne(idOrSlug: string): Promise<Product> {
    const product = await this.prisma.product.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
        deletedAt: null,
      },
      include: {
        category: true,
        variants: { orderBy: { price: 'asc' } },
        images: { orderBy: { sortOrder: 'asc' } },
        specifications: { orderBy: { sortOrder: 'asc' } },
        reviews: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            user: { select: { id: true, name: true, avatar: true } },
          },
        },
        _count: { select: { reviews: true } },
      },
    });
    if (!product) {
      throw new NotFoundException(`Produk '${idOrSlug}' tidak ditemukan`);
    }
    return product;
  }

  // ============================================
  // MUTATIONS (admin)
  // ============================================

  async create(dto: CreateProductDto): Promise<Product> {
    const { variants, images, ...data } = dto;
    return this.prisma.product.create({
      data: {
        ...data,
        basePrice: new Prisma.Decimal(data.basePrice),
        discountPrice: data.discountPrice ? new Prisma.Decimal(data.discountPrice) : null,
        flashSaleEndsAt: data.flashSaleEndsAt ? new Date(data.flashSaleEndsAt) : null,
        variants: variants
          ? {
              create: variants.map((v) => ({
                ...v,
                price: new Prisma.Decimal(v.price),
              })),
            }
          : undefined,
        images: images
          ? {
              create: images,
            }
          : undefined,
      },
    });
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    const data: Prisma.ProductUpdateInput = { ...dto };
    if (dto.basePrice !== undefined) {
      data.basePrice = new Prisma.Decimal(dto.basePrice);
    }
    if (dto.discountPrice !== undefined) {
      data.discountPrice = new Prisma.Decimal(dto.discountPrice);
    }
    if (dto.flashSaleEndsAt !== undefined) {
      data.flashSaleEndsAt = dto.flashSaleEndsAt ? new Date(dto.flashSaleEndsAt) : null;
    }
    try {
      return await this.prisma.product.update({ where: { id }, data });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException(`Produk '${id}' tidak ditemukan`);
      }
      throw e;
    }
  }

  async remove(id: string): Promise<Product> {
    try {
      return await this.prisma.product.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException(`Produk '${id}' tidak ditemukan`);
      }
      throw e;
    }
  }
}

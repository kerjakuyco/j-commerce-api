import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Product } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProductDto, QueryProductDto, UpdateProductDto } from './dto/product.dto';

const PRODUCT_LIST_SELECT = {
  id: true,
  name: true,
  slug: true,
  brand: true,
  description: true,
  categoryId: true,
  basePrice: true,
  discountPrice: true,
  rating: true,
  totalReview: true,
  totalSold: true,
  isFeatured: true,
  isFlashSale: true,
  flashSaleEndsAt: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} satisfies Prisma.ProductSelect;

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
      inStock,
      hasDiscount,
      featured,
      flash,
      sort = 'newest',
      sortBy,
      sortDir = 'desc',
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      isActive: true,
    };
    const andFilters: Prisma.ProductWhereInput[] = [];
    if (categoryId) where.categoryId = categoryId;
    if (search) {
      // NOTE: the Product schema declares `@@fulltext([name, brand, description])`
      // and enables the `fullTextSearch`/`fullTextIndex` preview features, but
      // this search intentionally stays on `contains` (LIKE). Reasons: no
      // migration is checked into the repo so the on-disk FULLTEXT index
      // state is uncertain, and MySQL FULLTEXT has token-size/stopword
      // differences that would change search semantics for short queries.
      // If the index is confirmed present and short-query behavior is
      // acceptable, this can switch to `{ name: { search } }` etc. with a
      // `contains` fallback for queries below the min token length.
      andFilters.push({
        OR: [
          { name: { contains: search } },
          { brand: { contains: search } },
          { description: { contains: search } },
        ],
      });
    }
    if (minPrice !== undefined || maxPrice !== undefined) {
      const basePriceFilter: Prisma.DecimalFilter = {};
      const discountPriceFilter: Prisma.DecimalNullableFilter = {};
      if (minPrice !== undefined) {
        basePriceFilter.gte = minPrice;
        discountPriceFilter.gte = minPrice;
      }
      if (maxPrice !== undefined) {
        basePriceFilter.lte = maxPrice;
        discountPriceFilter.lte = maxPrice;
      }

      andFilters.push({
        OR: [
          { discountPrice: null, basePrice: basePriceFilter },
          { discountPrice: { ...discountPriceFilter, not: null } },
        ],
      });
    }
    if (minRating !== undefined) where.rating = { gte: minRating };
    if (inStock) where.variants = { some: { stock: { gt: 0 } } };
    if (hasDiscount) where.discountPrice = { not: null };
    if (featured) where.isFeatured = true;
    if (flash) {
      andFilters.push({
        isFlashSale: true,
        OR: [{ flashSaleEndsAt: null }, { flashSaleEndsAt: { gt: new Date() } }],
      });
    }
    if (andFilters.length > 0) where.AND = andFilters;

    const orderBy: Prisma.ProductOrderByWithRelationInput[] = (() => {
      if (sortBy) {
        const direction = sortDir;
        switch (sortBy) {
          case 'category':
            return [{ category: { name: direction } }, { id: 'asc' }];
          case 'basePrice':
            return [{ basePrice: direction }, { id: 'asc' }];
          case 'rating':
            return [{ rating: direction }, { id: 'asc' }];
          case 'totalSold':
            return [{ totalSold: direction }, { id: 'asc' }];
          case 'brand':
            return [{ brand: direction }, { id: 'asc' }];
          case 'name':
            return [{ name: direction }, { id: 'asc' }];
          case 'createdAt':
          default:
            return [{ createdAt: direction }, { id: 'asc' }];
        }
      }

      switch (sort) {
        case 'price_asc':
          return [{ basePrice: 'asc' }, { id: 'asc' }];
        case 'price_desc':
          return [{ basePrice: 'desc' }, { id: 'asc' }];
        case 'rating':
          return [{ rating: 'desc' }, { id: 'asc' }];
        case 'sold':
          return [{ totalSold: 'desc' }, { id: 'asc' }];
        case 'newest':
        default:
          return [{ createdAt: 'desc' }, { id: 'asc' }];
      }
    })();

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: PRODUCT_LIST_SELECT,
      }),
      this.prisma.product.count({ where }),
    ]);

    const productIds = products.map((product) => product.id);
    const categoryIds = [...new Set(products.map((product) => product.categoryId))];
    const [categories, images, variants] = productIds.length
      ? await Promise.all([
          this.prisma.category.findMany({
            where: { id: { in: categoryIds } },
            select: { id: true, name: true, slug: true, icon: true },
          }),
          this.prisma.productImage.findMany({
            where: { productId: { in: productIds } },
            orderBy: [{ productId: 'asc' }, { sortOrder: 'asc' }],
          }),
          this.prisma.productVariant.findMany({
            where: { productId: { in: productIds } },
            orderBy: [{ productId: 'asc' }, { price: 'asc' }],
            select: { id: true, productId: true, name: true, sku: true, price: true, stock: true },
          }),
        ])
      : [[], [], []];

    const categoriesById = new Map(categories.map((category) => [category.id, category]));
    const imagesByProductId = new Map<string, typeof images>();
    for (const image of images) {
      const existing = imagesByProductId.get(image.productId);
      if (existing) existing.push(image);
      else imagesByProductId.set(image.productId, [image]);
    }
    const variantsByProductId = new Map<string, typeof variants>();
    for (const variant of variants) {
      const existing = variantsByProductId.get(variant.productId);
      if (existing) existing.push(variant);
      else variantsByProductId.set(variant.productId, [variant]);
    }
    const data = products.map((product) => {
      const productVariants = variantsByProductId.get(product.id) ?? [];
      return {
        ...product,
        category: categoriesById.get(product.categoryId) ?? null,
        images: (imagesByProductId.get(product.id) ?? []).slice(0, 1),
        variants: productVariants,
        _count: {
          variants: productVariants.length,
          reviews: product.totalReview,
        },
      };
    });

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
        isActive: true,
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
    this.assertValidDiscountPrice(data.basePrice, data.discountPrice);
    try {
      return await this.prisma.product.create({
        data: {
          ...data,
          basePrice: new Prisma.Decimal(data.basePrice),
          discountPrice:
            data.discountPrice !== undefined ? new Prisma.Decimal(data.discountPrice) : null,
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
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Slug atau nama produk sudah digunakan');
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    const current = await this.prisma.product.findUnique({
      where: { id },
      select: { basePrice: true, discountPrice: true },
    });
    if (!current) {
      throw new NotFoundException(`Produk '${id}' tidak ditemukan`);
    }

    this.assertValidDiscountPrice(
      dto.basePrice ?? current.basePrice,
      dto.discountPrice !== undefined ? dto.discountPrice : current.discountPrice,
    );

    const data: Prisma.ProductUpdateInput = { ...dto };
    if (dto.basePrice !== undefined) {
      data.basePrice = new Prisma.Decimal(dto.basePrice);
    }
    if (dto.discountPrice !== undefined) {
      data.discountPrice =
        dto.discountPrice === null ? null : new Prisma.Decimal(dto.discountPrice);
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

  private assertValidDiscountPrice(
    basePrice: Prisma.Decimal.Value,
    discountPrice: Prisma.Decimal.Value | null | undefined,
  ): void {
    if (discountPrice === null || discountPrice === undefined) return;

    const discount = new Prisma.Decimal(discountPrice);
    const base = new Prisma.Decimal(basePrice);
    if (!discount.lessThan(base)) {
      throw new BadRequestException('Harga diskon harus lebih kecil dari harga dasar');
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

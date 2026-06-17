import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { CartEntity, CartItemEntity } from './entities/cart.entity';

const CART_ITEM_INCLUDE = {
  product: {
    include: {
      category: { select: { id: true, name: true, slug: true, icon: true } },
      images: { orderBy: { sortOrder: 'asc' }, take: 1 },
    },
  },
  variant: true,
} satisfies Prisma.CartItemInclude;

type CartItemWithRelations = Prisma.CartItemGetPayload<{
  include: typeof CART_ITEM_INCLUDE;
}>;

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<CartEntity> {
    const items = await this.prisma.cartItem.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: CART_ITEM_INCLUDE,
    });

    return this.toCartEntity(items);
  }

  async add(userId: string, dto: AddToCartDto): Promise<CartEntity> {
    const quantity = dto.quantity ?? 1;

    // Run the read-check-write atomically under a row lock on the variant so
    // two concurrent adds for the same variant can't both pass the stock
    // check and then overshoot (last-writer-wins / exceeding stock). The cart
    // item quantity is updated with an atomic increment.
    await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({
        where: { id: dto.productId, deletedAt: null, isActive: true },
        select: { id: true },
      });
      if (!product) {
        throw new NotFoundException('Produk tidak ditemukan');
      }

      // Lock the variant row so concurrent `add` calls for the same variant
      // serialize here and re-read the authoritative stock value.
      await tx.$executeRaw`SELECT id FROM product_variants WHERE id = ${dto.variantId} FOR UPDATE`;

      const variant = await tx.productVariant.findFirst({
        where: { id: dto.variantId, productId: dto.productId },
        select: { id: true, stock: true },
      });
      if (!variant) {
        throw new NotFoundException('Varian produk tidak ditemukan');
      }

      const existing = await tx.cartItem.findUnique({
        where: {
          userId_productId_variantId: {
            userId,
            productId: dto.productId,
            variantId: dto.variantId,
          },
        },
        select: { id: true, quantity: true },
      });

      const nextQuantity = (existing?.quantity ?? 0) + quantity;
      if (nextQuantity > variant.stock) {
        throw new BadRequestException('Jumlah melebihi stok tersedia');
      }

      if (existing) {
        await tx.cartItem.update({
          where: { id: existing.id },
          data: { quantity: { increment: quantity }, selected: true },
        });
      } else {
        await tx.cartItem.create({
          data: {
            userId,
            productId: dto.productId,
            variantId: dto.variantId,
            quantity,
            selected: true,
          },
        });
      }
    });

    return this.get(userId);
  }

  async update(userId: string, itemId: string, dto: UpdateCartItemDto): Promise<CartEntity> {
    if (dto.quantity === undefined && dto.selected === undefined) {
      throw new BadRequestException('Quantity atau selected wajib diisi');
    }

    const item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, userId },
      include: { variant: true },
    });
    if (!item) {
      throw new NotFoundException('Item cart tidak ditemukan');
    }

    const data: Prisma.CartItemUpdateInput = {};
    if (dto.quantity !== undefined) {
      if (dto.quantity > item.variant.stock) {
        throw new BadRequestException('Jumlah melebihi stok tersedia');
      }
      data.quantity = dto.quantity;
    }
    if (dto.selected !== undefined) {
      data.selected = dto.selected;
    }

    await this.prisma.cartItem.update({ where: { id: item.id }, data });

    return this.get(userId);
  }

  async remove(userId: string, itemId: string): Promise<CartEntity> {
    const item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, userId },
      select: { id: true },
    });
    if (!item) {
      throw new NotFoundException('Item cart tidak ditemukan');
    }

    await this.prisma.cartItem.delete({ where: { id: item.id } });

    return this.get(userId);
  }

  async clear(userId: string): Promise<CartEntity> {
    await this.prisma.cartItem.deleteMany({ where: { userId } });

    return this.get(userId);
  }

  private toCartEntity(items: CartItemWithRelations[]): CartEntity {
    const mapped: CartItemEntity[] = items.map((item) => {
      const price = Number(item.variant.price);
      const subtotal = price * item.quantity;

      return {
        id: item.id,
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        selected: item.selected,
        price,
        subtotal,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        product: {
          id: item.product.id,
          name: item.product.name,
          slug: item.product.slug,
          brand: item.product.brand,
          basePrice: Number(item.product.basePrice),
          discountPrice: item.product.discountPrice ? Number(item.product.discountPrice) : null,
          image: item.product.images[0]?.url ?? null,
          category: item.product.category,
        },
        variant: {
          id: item.variant.id,
          name: item.variant.name,
          sku: item.variant.sku,
          price,
          stock: item.variant.stock,
        },
      };
    });

    const selectedItems = mapped.filter((item) => item.selected);

    return {
      items: mapped,
      summary: {
        totalItems: mapped.length,
        totalQuantity: mapped.reduce((sum, item) => sum + item.quantity, 0),
        selectedQuantity: selectedItems.reduce((sum, item) => sum + item.quantity, 0),
        subtotal: mapped.reduce((sum, item) => sum + item.subtotal, 0),
        selectedSubtotal: selectedItems.reduce((sum, item) => sum + item.subtotal, 0),
      },
    };
  }
}

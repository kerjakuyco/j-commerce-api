import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateVariantDto, UpdateVariantDto } from './dto/variant.dto';

@Injectable()
export class ProductVariantsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(productId: string, dto: CreateVariantDto) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Produk tidak ditemukan');

    return this.prisma.productVariant.create({
      data: {
        productId,
        name: dto.name,
        sku: dto.sku,
        price: new Prisma.Decimal(dto.price),
        stock: dto.stock,
      },
    });
  }

  async update(id: string, dto: UpdateVariantDto) {
    const data: Prisma.ProductVariantUpdateInput = {
      name: dto.name,
      sku: dto.sku,
      stock: dto.stock,
    };
    if (dto.price !== undefined) data.price = new Prisma.Decimal(dto.price);

    try {
      return await this.prisma.productVariant.update({ where: { id }, data });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException('Varian produk tidak ditemukan');
      }
      throw e;
    }
  }

  async remove(id: string): Promise<{ message: string }> {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id },
      include: { _count: { select: { orderItems: true } } },
    });
    if (!variant) {
      throw new NotFoundException('Varian produk tidak ditemukan');
    }
    if ((variant._count?.orderItems ?? 0) > 0) {
      throw new ConflictException(
        'Varian sudah pernah dipesan dan tidak bisa dihapus demi menjaga riwayat pesanan',
      );
    }

    try {
      await this.prisma.productVariant.delete({ where: { id } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException('Varian produk tidak ditemukan');
      }
      throw e;
    }

    return { message: 'Varian produk berhasil dihapus' };
  }
}

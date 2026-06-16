import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProductImageDto, ReorderImagesDto } from './dto/product-image.dto';

@Injectable()
export class ProductImagesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(productId: string, dto: CreateProductImageDto) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Produk tidak ditemukan');

    return this.prisma.productImage.create({ data: { productId, ...dto } });
  }

  async reorder(productId: string, dto: ReorderImagesDto) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Produk tidak ditemukan');

    await this.prisma.$transaction(
      dto.images.map((image) =>
        this.prisma.productImage.updateMany({
          where: { id: image.id, productId },
          data: { sortOrder: image.sortOrder },
        }),
      ),
    );

    return this.prisma.productImage.findMany({
      where: { productId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async remove(id: string): Promise<{ message: string }> {
    try {
      await this.prisma.productImage.delete({ where: { id } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException('Gambar produk tidak ditemukan');
      }
      throw e;
    }

    return { message: 'Gambar produk berhasil dihapus' };
  }
}

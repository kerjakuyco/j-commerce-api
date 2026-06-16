import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/create-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.category.findMany({
      where: { deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: true } } },
    });
  }

  async findOne(idOrSlug: string) {
    const category = await this.prisma.category.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
        deletedAt: null,
      },
      include: { _count: { select: { products: true } } },
    });
    if (!category) {
      throw new NotFoundException(`Kategori '${idOrSlug}' tidak ditemukan`);
    }
    return category;
  }

  async create(dto: CreateCategoryDto) {
    try {
      return await this.prisma.category.create({ data: dto });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Slug kategori sudah digunakan');
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateCategoryDto) {
    try {
      return await this.prisma.category.update({
        where: { id },
        data: dto,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException(`Kategori '${id}' tidak ditemukan`);
      }
      throw e;
    }
  }

  async remove(id: string) {
    const productsCount = await this.prisma.product.count({
      where: { categoryId: id, deletedAt: null },
    });
    if (productsCount > 0) {
      throw new ConflictException(
        `Tidak bisa hapus: kategori masih punya ${productsCount} produk. Hapus atau pindahkan produk terlebih dahulu.`,
      );
    }
    try {
      return await this.prisma.category.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException(`Kategori '${id}' tidak ditemukan`);
      }
      throw e;
    }
  }
}

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Voucher, VoucherType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateVoucherDto,
  QueryVoucherDto,
  UpdateVoucherDto,
  ValidateVoucherDto,
} from './dto/voucher.dto';

@Injectable()
export class VouchersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryVoucherDto) {
    const { page = 1, limit = 20 } = query;
    const now = new Date();
    const where: Prisma.VoucherWhereInput = {
      isActive: true,
      startsAt: { lte: now },
      expiresAt: { gte: now },
      usedCount: { lt: this.prisma.voucher.fields.quota },
    };

    const [data, total] = await Promise.all([
      this.prisma.voucher.findMany({
        where,
        orderBy: { expiresAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.voucher.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findByCode(code: string): Promise<Voucher> {
    const voucher = await this.prisma.voucher.findUnique({
      where: { code: code.toUpperCase() },
    });
    if (!voucher || !this.isUsable(voucher)) {
      throw new NotFoundException('Voucher tidak ditemukan atau tidak aktif');
    }

    return voucher;
  }

  async create(dto: CreateVoucherDto): Promise<Voucher> {
    return this.prisma.voucher.create({
      data: this.toPrismaData(dto) as Prisma.VoucherUncheckedCreateInput,
    });
  }

  async update(id: string, dto: UpdateVoucherDto): Promise<Voucher> {
    try {
      return await this.prisma.voucher.update({
        where: { id },
        data: this.toPrismaData(dto) as Prisma.VoucherUpdateInput,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException('Voucher tidak ditemukan');
      }
      throw e;
    }
  }

  async remove(id: string): Promise<{ message: string }> {
    try {
      await this.prisma.voucher.update({ where: { id }, data: { isActive: false } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException('Voucher tidak ditemukan');
      }
      throw e;
    }

    return { message: 'Voucher berhasil dinonaktifkan' };
  }

  async validate(dto: ValidateVoucherDto) {
    const voucher = await this.findByCode(dto.code);
    const purchaseAmount = new Prisma.Decimal(dto.purchaseAmount);
    const minPurchase = new Prisma.Decimal(voucher.minPurchase);

    if (purchaseAmount.lessThan(minPurchase)) {
      throw new BadRequestException(
        `Minimal pembelian untuk voucher ini adalah Rp ${minPurchase.toNumber()}`,
      );
    }

    const discount = this.calculateDiscount(voucher, purchaseAmount);

    return {
      voucher,
      discount: discount.toNumber(),
      finalAmount: purchaseAmount.minus(discount).toNumber(),
    };
  }

  calculateDiscount(voucher: Voucher, purchaseAmount: Prisma.Decimal): Prisma.Decimal {
    let discount =
      voucher.type === VoucherType.PERCENTAGE
        ? purchaseAmount.mul(new Prisma.Decimal(voucher.value)).div(100)
        : new Prisma.Decimal(voucher.value);

    if (voucher.maxDiscount && discount.greaterThan(voucher.maxDiscount)) {
      discount = new Prisma.Decimal(voucher.maxDiscount);
    }
    if (discount.greaterThan(purchaseAmount)) {
      discount = purchaseAmount;
    }

    return discount;
  }

  isUsable(voucher: Voucher): boolean {
    const now = new Date();
    return (
      voucher.isActive &&
      voucher.startsAt <= now &&
      voucher.expiresAt >= now &&
      voucher.usedCount < voucher.quota
    );
  }

  private toPrismaData(
    dto: CreateVoucherDto | UpdateVoucherDto,
  ): Prisma.VoucherUncheckedCreateInput | Prisma.VoucherUpdateInput {
    return {
      code: dto.code?.toUpperCase(),
      type: dto.type,
      value: dto.value !== undefined ? new Prisma.Decimal(dto.value) : undefined,
      description: dto.description,
      minPurchase: dto.minPurchase !== undefined ? new Prisma.Decimal(dto.minPurchase) : undefined,
      maxDiscount: dto.maxDiscount !== undefined ? new Prisma.Decimal(dto.maxDiscount) : undefined,
      quota: dto.quota,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      isActive: dto.isActive,
    };
  }
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
    const { page = 1, limit = 20, sortBy = 'expiresAt', sortDir = 'asc' } = query;
    const now = new Date();
    const orderBy = this.voucherOrderBy(sortBy, sortDir);
    const where: Prisma.VoucherWhereInput = {
      isActive: true,
      startsAt: { lte: now },
      expiresAt: { gte: now },
    };

    // Prisma can't express `usedCount < quota` (a column-to-column comparison)
    // in `where`, so usable vouchers must be filtered in-app. To keep pagination
    // correct, fetch the active+in-window vouchers, filter by quota, then slice
    // in-memory — `meta.total`/`totalPages` reflect the USABLE set, and pages
    // don't come back short. The voucher catalog is small enough that loading
    // the active set is cheap; paging in DB then filtering post-page would
    // yield short pages and a misleading total.
    const rows = await this.prisma.voucher.findMany({
      where,
      orderBy,
    });

    const usable = rows.filter((voucher) => voucher.usedCount < voucher.quota);
    const total = usable.length;
    const data = usable.slice((page - 1) * limit, (page - 1) * limit + limit);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  /**
   * Admin-only list of ALL vouchers — active, inactive, expired, and
   * quota-exhausted — with the same `{ data, meta }` shape as the public
   * `findAll`. Drops the active/expiry/quota filter so admins can manage
   * every voucher regardless of state.
   */
  async findAllForAdmin(query: QueryVoucherDto) {
    const {
      page = 1,
      limit = 20,
      search,
      type,
      status,
      sortBy = 'createdAt',
      sortDir = 'desc',
    } = query;
    const now = new Date();
    const orderBy = this.voucherOrderBy(sortBy, sortDir);
    const baseWhere: Prisma.VoucherWhereInput = {
      ...(type ? { type } : {}),
      ...(search?.trim()
        ? {
            OR: [
              { code: { contains: search.trim() } },
              { description: { contains: search.trim() } },
            ],
          }
        : {}),
    };

    if (!status) {
      return this.paginatedVouchers(baseWhere, page, limit, orderBy);
    }

    const simpleStatusWhere = this.simpleAdminStatusWhere(status, now);
    if (simpleStatusWhere) {
      return this.paginatedVouchers(
        { ...baseWhere, ...simpleStatusWhere },
        page,
        limit,
        orderBy,
      );
    }

    const inWindowWhere: Prisma.VoucherWhereInput = {
      ...baseWhere,
      isActive: true,
      startsAt: { lte: now },
      expiresAt: { gte: now },
    };
    const rows = await this.prisma.voucher.findMany({
      where: inWindowWhere,
      orderBy,
    });

    const filtered = rows.filter((voucher) => this.adminStatus(voucher, now) === status);
    const total = filtered.length;
    const data = filtered.slice((page - 1) * limit, (page - 1) * limit + limit);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  private async paginatedVouchers(
    where: Prisma.VoucherWhereInput,
    page: number,
    limit: number,
    orderBy: Prisma.VoucherOrderByWithRelationInput[],
  ) {
    const [data, total] = await Promise.all([
      this.prisma.voucher.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.voucher.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  private voucherOrderBy(
    sortBy: NonNullable<QueryVoucherDto['sortBy']>,
    sortDir: NonNullable<QueryVoucherDto['sortDir']>,
  ): Prisma.VoucherOrderByWithRelationInput[] {
    switch (sortBy) {
      case 'code':
        return [{ code: sortDir }, { id: 'asc' }];
      case 'type':
        return [{ type: sortDir }, { id: 'asc' }];
      case 'value':
        return [{ value: sortDir }, { id: 'asc' }];
      case 'quota':
        return [{ quota: sortDir }, { id: 'asc' }];
      case 'usedCount':
        return [{ usedCount: sortDir }, { id: 'asc' }];
      case 'minPurchase':
        return [{ minPurchase: sortDir }, { id: 'asc' }];
      case 'startsAt':
        return [{ startsAt: sortDir }, { id: 'asc' }];
      case 'expiresAt':
        return [{ expiresAt: sortDir }, { id: 'asc' }];
      case 'isActive':
        return [{ isActive: sortDir }, { id: 'asc' }];
      case 'createdAt':
      default:
        return [{ createdAt: sortDir }, { id: 'asc' }];
    }
  }

  private simpleAdminStatusWhere(
    status: NonNullable<QueryVoucherDto['status']>,
    now: Date,
  ): Prisma.VoucherWhereInput | null {
    if (status === 'INACTIVE') return { isActive: false };
    if (status === 'EXPIRED') return { isActive: true, expiresAt: { lt: now } };
    if (status === 'SCHEDULED') return { isActive: true, startsAt: { gt: now } };
    return null;
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
    try {
      return await this.prisma.voucher.create({
        data: this.toPrismaData(dto) as Prisma.VoucherUncheckedCreateInput,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Kode voucher sudah digunakan');
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateVoucherDto): Promise<Voucher> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM vouchers WHERE id = ${id} FOR UPDATE`;
      const voucher = await tx.voucher.findUnique({ where: { id } });
      if (!voucher) throw new NotFoundException('Voucher tidak ditemukan');
      if (dto.quota !== undefined && dto.quota < voucher.usedCount) {
        throw new BadRequestException('Kuota tidak boleh lebih kecil dari jumlah terpakai');
      }

      try {
        return await tx.voucher.update({
          where: { id },
          data: this.toPrismaData(dto) as Prisma.VoucherUpdateInput,
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
          throw new NotFoundException('Voucher tidak ditemukan');
        }
        throw e;
      }
    });
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

  async removePermanent(id: string): Promise<{ message: string }> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const voucher = await tx.voucher.findUnique({ where: { id } });
        if (!voucher) throw new NotFoundException('Voucher tidak ditemukan');

        const orderCount = await tx.order.count({ where: { voucherId: id } });
        if (voucher.usedCount > 0 || orderCount > 0) {
          throw new BadRequestException(
            'Voucher yang sudah digunakan tidak bisa dihapus permanen',
          );
        }

        await tx.voucher.delete({ where: { id } });
        return { message: 'Voucher berhasil dihapus permanen' };
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException('Voucher tidak ditemukan');
      }
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        throw new BadRequestException(
          'Voucher yang sudah digunakan tidak bisa dihapus permanen',
        );
      }
      throw e;
    }
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

  private adminStatus(
    voucher: Voucher,
    now: Date,
  ): 'ACTIVE' | 'INACTIVE' | 'SCHEDULED' | 'EXPIRED' | 'EXHAUSTED' {
    if (!voucher.isActive) return 'INACTIVE';
    if (voucher.expiresAt < now) return 'EXPIRED';
    if (voucher.startsAt > now) return 'SCHEDULED';
    if (voucher.usedCount >= voucher.quota) return 'EXHAUSTED';
    return 'ACTIVE';
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
      maxDiscount:
        dto.maxDiscount === null
          ? null
          : dto.maxDiscount !== undefined
            ? new Prisma.Decimal(dto.maxDiscount)
            : undefined,
      quota: dto.quota,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      isActive: dto.isActive,
    };
  }
}

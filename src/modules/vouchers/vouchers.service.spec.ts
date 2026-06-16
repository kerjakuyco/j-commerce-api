import { Prisma, Voucher, VoucherType } from '@prisma/client';
import { VouchersService } from './vouchers.service';

const baseVoucher = (overrides: Partial<Voucher> = {}): Voucher => ({
  id: 'voucher-1',
  code: 'TEST',
  type: VoucherType.FIXED,
  value: new Prisma.Decimal(10000),
  description: null,
  minPurchase: new Prisma.Decimal(0),
  maxDiscount: null,
  quota: 10,
  usedCount: 0,
  startsAt: new Date(Date.now() - 1000),
  expiresAt: new Date(Date.now() + 1000),
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('VouchersService', () => {
  const service = new VouchersService({} as never);

  it('caps percentage discount by maxDiscount', () => {
    const discount = service.calculateDiscount(
      baseVoucher({
        type: VoucherType.PERCENTAGE,
        value: new Prisma.Decimal(20),
        maxDiscount: new Prisma.Decimal(15000),
      }),
      new Prisma.Decimal(100000),
    );

    expect(discount.toNumber()).toBe(15000);
  });

  it('does not discount more than purchase amount', () => {
    const discount = service.calculateDiscount(
      baseVoucher({ value: new Prisma.Decimal(50000) }),
      new Prisma.Decimal(25000),
    );

    expect(discount.toNumber()).toBe(25000);
  });

  it('detects unusable quota', () => {
    expect(service.isUsable(baseVoucher({ quota: 1, usedCount: 1 }))).toBe(false);
  });
});

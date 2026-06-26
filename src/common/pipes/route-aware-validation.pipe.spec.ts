import { ArgumentMetadata } from '@nestjs/common';
import { VoucherType } from '@prisma/client';
import { IsNotEmpty, IsString } from 'class-validator';
import { QueryNotificationDto } from '../../modules/notifications/dto/notification.dto';
import { QueryProductDto } from '../../modules/products/dto/product.dto';
import { QueryUserDto } from '../../modules/users/dto/query-user.dto';
import { CreateVoucherDto } from '../../modules/vouchers/dto/voucher.dto';
import { LooseValidation, RouteAwareValidationPipe } from './route-aware-validation.pipe';

class StrictDto {
  @IsString()
  @IsNotEmpty()
  order_id!: string;
}

@LooseValidation()
class LooseDto {
  @IsString()
  @IsNotEmpty()
  order_id!: string;
}

describe('RouteAwareValidationPipe', () => {
  // The global pipe runs per-param; ArgumentMetadata.metatype is the DTO class.
  const meta = (metatype: unknown): ArgumentMetadata => ({
    type: 'body',
    metatype: metatype as ArgumentMetadata['metatype'],
    data: undefined,
  });
  const pipe = new RouteAwareValidationPipe();

  it('rejects unknown fields on a strict DTO (forbidNonWhitelisted)', async () => {
    await expect(
      pipe.transform({ order_id: 'o1', gopay_qris: 'x' }, meta(StrictDto)),
    ).rejects.toBeDefined();
  });

  it('strips unknown fields on a @LooseValidation DTO instead of 400-ing', async () => {
    const result = (await pipe.transform(
      // Extra Midtrans-style fields not on the DTO must be stripped, not rejected.
      { order_id: 'o1', status_code: '200', settlement_time: '2026-01-01', va_numbers: [] },
      meta(LooseDto),
    )) as LooseDto;
    expect(result.order_id).toBe('o1');
    expect((result as unknown as Record<string, unknown>).settlement_time).toBeUndefined();
    expect((result as unknown as Record<string, unknown>).va_numbers).toBeUndefined();
  });

  it('still validates required fields on a @LooseValidation DTO', async () => {
    await expect(pipe.transform({ status_code: '200' }, meta(LooseDto))).rejects.toBeDefined();
  });

  it('preserves false boolean query params with implicit conversion enabled', async () => {
    const result = (await pipe.transform(
      { isActive: 'false', limit: '10', page: '1' },
      { ...meta(QueryUserDto), type: 'query' },
    )) as QueryUserDto;

    expect(result.isActive).toBe(false);
  });

  it('preserves false product boolean query params with implicit conversion enabled', async () => {
    const result = (await pipe.transform(
      {
        inStock: 'false',
        hasDiscount: 'false',
        featured: 'false',
        flash: 'false',
        limit: '10',
        page: '1',
      },
      { ...meta(QueryProductDto), type: 'query' },
    )) as QueryProductDto;

    expect(result.inStock).toBe(false);
    expect(result.hasDiscount).toBe(false);
    expect(result.featured).toBe(false);
    expect(result.flash).toBe(false);
  });

  it('preserves false notification boolean query params with implicit conversion enabled', async () => {
    const result = (await pipe.transform(
      { unreadOnly: 'false', limit: '10', page: '1' },
      { ...meta(QueryNotificationDto), type: 'query' },
    )) as QueryNotificationDto;

    expect(result.unreadOnly).toBe(false);
  });

  it('rejects invalid boolean query params', async () => {
    await expect(
      pipe.transform(
        { isActive: 'disabled', limit: '10', page: '1' },
        { ...meta(QueryUserDto), type: 'query' },
      ),
    ).rejects.toBeDefined();
  });

  it('validates fixed voucher values instead of skipping value validators', async () => {
    await expect(
      pipe.transform(
        {
          code: 'FIXED-BAD',
          type: VoucherType.FIXED,
          value: '-1',
          quota: '10',
          expiresAt: '2027-01-01T00:00:00.000Z',
        },
        meta(CreateVoucherDto),
      ),
    ).rejects.toBeDefined();
  });

  it('rejects percentage voucher values over 100', async () => {
    await expect(
      pipe.transform(
        {
          code: 'PERCENT-BAD',
          type: VoucherType.PERCENTAGE,
          value: '101',
          quota: '10',
          expiresAt: '2027-01-01T00:00:00.000Z',
        },
        meta(CreateVoucherDto),
      ),
    ).rejects.toBeDefined();
  });
});

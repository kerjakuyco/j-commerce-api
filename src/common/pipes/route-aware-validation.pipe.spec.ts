import { ArgumentMetadata } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
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
});

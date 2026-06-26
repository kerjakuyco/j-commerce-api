import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus, PaymentStatus, ShippingMethod } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export const ORDER_SORT_FIELDS = [
  'orderNumber',
  'createdAt',
  'status',
  'paymentStatus',
  'total',
] as const;

export const ORDER_SORT_DIRECTIONS = ['asc', 'desc'] as const;

export type OrderSortField = (typeof ORDER_SORT_FIELDS)[number];
export type OrderSortDirection = (typeof ORDER_SORT_DIRECTIONS)[number];

export class QueryOrderDto {
  @ApiProperty({ required: false, enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiProperty({ required: false, enum: PaymentStatus })
  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @ApiProperty({ required: false, enum: ShippingMethod })
  @IsOptional()
  @IsEnum(ShippingMethod)
  shippingMethod?: ShippingMethod;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ required: false, enum: ORDER_SORT_FIELDS, default: 'createdAt' })
  @IsOptional()
  @IsIn(ORDER_SORT_FIELDS)
  sortBy?: OrderSortField = 'createdAt';

  @ApiProperty({ required: false, enum: ORDER_SORT_DIRECTIONS, default: 'desc' })
  @IsOptional()
  @IsIn(ORDER_SORT_DIRECTIONS)
  sortDir?: OrderSortDirection = 'desc';

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

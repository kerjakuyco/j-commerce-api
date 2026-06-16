import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const UPDATABLE_ORDER_STATUSES = [
  OrderStatus.PENDING,
  OrderStatus.PAID,
  OrderStatus.PACKED,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
] as const;

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: UPDATABLE_ORDER_STATUSES })
  @IsEnum(OrderStatus)
  @IsIn(UPDATABLE_ORDER_STATUSES)
  status!: OrderStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  trackingNumber?: string;
}

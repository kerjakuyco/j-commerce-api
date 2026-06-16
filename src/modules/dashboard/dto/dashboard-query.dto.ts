import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class RevenueQueryDto {
  @ApiProperty({ required: false, enum: ['7d', '30d', '90d', '1y'], default: '30d' })
  @IsOptional()
  @IsIn(['7d', '30d', '90d', '1y'])
  period?: '7d' | '30d' | '90d' | '1y' = '30d';
}

export class TopProductsQueryDto {
  @ApiProperty({ required: false, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}

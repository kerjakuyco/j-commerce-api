import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateVariantDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  sku!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  price!: number;

  @ApiProperty({ default: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(99999)
  stock!: number;
}

export class UpdateVariantDto extends PartialType(CreateVariantDto) {
  @ApiProperty({ required: false, description: 'Current stock seen by the admin form' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedStock?: number;
}

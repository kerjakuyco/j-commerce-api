import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateProductImageDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  url!: string;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateProductImageDto extends PartialType(CreateProductImageDto) {}

export class ImageOrderItemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  id!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder!: number;
}

export class ReorderImagesDto {
  @ApiProperty({ type: [ImageOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageOrderItemDto)
  images!: ImageOrderItemDto[];
}

import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAddressDto {
  @ApiProperty({ example: 'Rumah' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  label!: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  recipient!: string;

  @ApiProperty({ example: '081234567890' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phone!: string;

  @ApiProperty({ example: 'DKI Jakarta' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  province!: string;

  @ApiProperty({ example: 'Jakarta Selatan' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city!: string;

  @ApiProperty({ example: 'Kebayoran Baru' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  district!: string;

  @ApiProperty({ example: '12150' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  postalCode!: string;

  @ApiProperty({ example: 'Jl. Senopati No. 1' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  fullAddress!: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateAddressDto extends PartialType(CreateAddressDto) {}

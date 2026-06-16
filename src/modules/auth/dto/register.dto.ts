import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Format email tidak valid' })
  @MaxLength(100)
  email!: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty({ message: 'Nama tidak boleh kosong' })
  @MinLength(3, { message: 'Nama minimal 3 karakter' })
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: '081234567890', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^(\+62|62|0)8[0-9]{8,11}$/, {
    message: 'Format nomor telepon tidak valid (contoh: 081234567890)',
  })
  phone?: string;

  @ApiProperty({ example: 'password123', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Password minimal 8 karakter' })
  @MaxLength(100)
  password!: string;
}

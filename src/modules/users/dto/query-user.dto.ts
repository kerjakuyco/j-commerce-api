import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryUserDto {
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

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ required: false, enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiProperty({ required: false, type: Boolean })
  @IsOptional()
  @Transform(({ value, obj, key }) => {
    const raw = typeof key === 'string' && obj ? (obj as Record<string, unknown>)[key] : value;
    if (raw === true || raw === 'true') return true;
    if (raw === false || raw === 'false') return false;
    return raw;
  })
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false, enum: ['name', 'email', 'role', 'createdAt', 'isActive'] })
  @IsOptional()
  @IsIn(['name', 'email', 'role', 'createdAt', 'isActive'])
  sortBy?: 'name' | 'email' | 'role' | 'createdAt' | 'isActive';

  @ApiProperty({ required: false, enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';
}

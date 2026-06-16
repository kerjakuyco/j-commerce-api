import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class UserResponseEntity {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ required: false })
  phone!: string | null;

  @ApiProperty({ required: false })
  avatar!: string | null;

  @ApiProperty({ enum: UserRole })
  role!: UserRole;

  @ApiProperty()
  createdAt!: Date;
}

export class AuthResponseEntity {
  @ApiProperty({ type: UserResponseEntity })
  user!: UserResponseEntity;

  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  refreshToken!: string;

  @ApiProperty({ example: 900, description: 'Access token TTL in seconds' })
  expiresIn!: number;
}

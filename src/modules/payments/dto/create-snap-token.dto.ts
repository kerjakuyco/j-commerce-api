import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateSnapTokenDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  orderId!: string;
}

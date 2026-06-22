import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class CompleteMockPaymentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @ApiProperty({ enum: ['success', 'pending', 'failed'] })
  @IsString()
  @IsIn(['success', 'pending', 'failed'])
  result!: 'success' | 'pending' | 'failed';
}

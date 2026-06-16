import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class MidtransNotificationDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  order_id!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  status_code!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  gross_amount!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  signature_key!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  transaction_status!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  transaction_id?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  fraud_status?: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { Allow, IsNotEmpty, IsOptional, IsString } from 'class-validator';

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

  @IsOptional()
  @IsString()
  transaction_time?: string;

  @IsOptional()
  @IsString()
  payment_type?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  settlement_time?: string;

  @IsOptional()
  @IsString()
  expiry_time?: string;

  @IsOptional()
  @IsString()
  status_message?: string;

  @IsOptional()
  @IsString()
  merchant_id?: string;

  @IsOptional()
  @IsString()
  payment_code?: string;

  @IsOptional()
  @IsString()
  store?: string;

  @IsOptional()
  @IsString()
  permata_va_number?: string;

  @IsOptional()
  @IsString()
  biller_code?: string;

  @IsOptional()
  @IsString()
  bill_key?: string;

  @IsOptional()
  @IsString()
  bank?: string;

  @IsOptional()
  @IsString()
  approval_code?: string;

  @IsOptional()
  @IsString()
  masked_card?: string;

  @IsOptional()
  @IsString()
  card_type?: string;

  @Allow()
  va_numbers?: unknown;

  @Allow()
  payment_amounts?: unknown;
}

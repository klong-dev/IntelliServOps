import {
  IsString,
  IsNumber,
  IsOptional,
  IsUUID,
  IsEnum,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethodType } from '@prisma/client';

export class CreatePaymentDto {
  @ApiProperty({ description: 'Invoice ID to pay' })
  @IsUUID()
  invoiceId: string;

  @ApiProperty({ example: 15000000 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ enum: PaymentMethodType, default: 'bank_transfer' })
  @IsEnum(PaymentMethodType)
  paymentMethod: PaymentMethodType;

  @ApiPropertyOptional({ description: 'Transaction reference' })
  @IsString()
  @IsOptional()
  transactionReference?: string;

  @ApiPropertyOptional({ description: 'Payment notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}

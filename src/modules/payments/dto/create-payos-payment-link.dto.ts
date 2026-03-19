import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreatePayOSPaymentLinkDto {
  @ApiProperty({ description: 'Invoice ID to create PayOS payment link for' })
  @IsUUID()
  invoiceId: string;

  @ApiPropertyOptional({
    description: 'Return URL after successful payment',
    example: 'https://app.intelliservops.com/payment/success',
  })
  @IsOptional()
  @IsUrl()
  returnUrl?: string;

  @ApiPropertyOptional({
    description: 'Cancel URL when customer cancels payment',
    example: 'https://app.intelliservops.com/payment/cancel',
  })
  @IsOptional()
  @IsUrl()
  cancelUrl?: string;

  @ApiPropertyOptional({
    description: 'Payment description shown on PayOS',
    example: 'Thanh toan hoa don INV-202603-00001',
    maxLength: 25,
  })
  @IsOptional()
  @IsString()
  @MaxLength(25)
  description?: string;
}

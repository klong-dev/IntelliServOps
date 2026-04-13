import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  Matches,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

const PAYOS_REDIRECT_URL_PATTERN =
  /^(https?:\/\/[^\s]+|[a-z][a-z0-9+.-]*:\/\/[^\s]+)$/i;

export class CreatePayOSPaymentLinkDto {
  @ApiProperty({ description: 'Invoice ID to create PayOS payment link for' })
  @IsUUID()
  invoiceId: string;

  @ApiPropertyOptional({
    description:
      'Return URL after successful payment. Supports both web URLs and app deep links such as homeiq://payment/success',
    example: 'https://app.intelliservops.com/payment/success',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(PAYOS_REDIRECT_URL_PATTERN, {
    message:
      'returnUrl must be a valid http/https URL or app URI scheme (e.g. homeiq://...)',
  })
  returnUrl?: string;

  @ApiPropertyOptional({
    description:
      'Cancel URL when customer cancels payment. Supports both web URLs and app deep links such as homeiq://payment/cancel',
    example: 'https://app.intelliservops.com/payment/cancel',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(PAYOS_REDIRECT_URL_PATTERN, {
    message:
      'cancelUrl must be a valid http/https URL or app URI scheme (e.g. homeiq://...)',
  })
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

import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  InvoiceStatus,
  InvoiceType,
  PaymentMethodType,
  PaymentStatus,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';

export enum InvoiceMeActorScope {
  auto = 'auto',
  staff_worklist = 'staff_worklist',
  user_payable = 'user_payable',
  partner_receivable = 'partner_receivable',
}

export class InvoiceMeQueryDto {
  @ApiPropertyOptional({
    enum: InvoiceMeActorScope,
    description:
      'Optional scope override. Use auto to let system resolve based on current actor.',
    default: InvoiceMeActorScope.auto,
  })
  @IsOptional()
  @IsEnum(InvoiceMeActorScope)
  actorScope?: InvoiceMeActorScope;

  @ApiPropertyOptional({ enum: InvoiceType })
  @IsOptional()
  @IsEnum(InvoiceType)
  invoiceType?: InvoiceType;

  @ApiPropertyOptional({ enum: InvoiceStatus })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  invoiceStatus?: InvoiceStatus;

  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @ApiPropertyOptional({ enum: PaymentMethodType })
  @IsOptional()
  @IsEnum(PaymentMethodType)
  paymentMethod?: PaymentMethodType;

  @ApiPropertyOptional({
    description: 'Billing month in YYYY-MM format',
    example: '2026-04',
  })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  billingMonth?: string;

  @ApiPropertyOptional({
    description: 'Filter by payer user id',
    example: 'c8f1ff12-d4bd-4ec8-aec8-d5d1945a860f',
  })
  @IsOptional()
  @IsUUID()
  payerUserId?: string;

  @ApiPropertyOptional({
    description: 'Filter by receiver user id',
    example: '7c2bd59f-e25d-4b76-b9a6-1f1f91d25f71',
  })
  @IsOptional()
  @IsUUID()
  receiverUserId?: string;

  @ApiPropertyOptional({
    description: 'Filter invoices due date from (inclusive)',
    example: '2026-04-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  dueFrom?: string;

  @ApiPropertyOptional({
    description: 'Filter invoices due date to (inclusive)',
    example: '2026-04-30T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  dueTo?: string;

  @ApiPropertyOptional({
    description: 'Filter paid date from (inclusive)',
    example: '2026-04-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  paidFrom?: string;

  @ApiPropertyOptional({
    description: 'Filter paid date to (inclusive)',
    example: '2026-04-30T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  paidTo?: string;

  @ApiPropertyOptional({
    description:
      'Text search for invoiceNumber, contractNumber, apartmentNumber or partner name',
    example: 'INV-202604',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

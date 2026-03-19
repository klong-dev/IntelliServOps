import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  IsUUID,
  IsArray,
  IsEnum,
  ValidateNested,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InvoiceType } from '@prisma/client';
import { Type } from 'class-transformer';

export class InvoiceItemDto {
  @ApiProperty({ example: 'Monthly Rent' })
  @IsString()
  description: string;

  @ApiProperty({ example: 15000000 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ example: 1 })
  @IsNumber()
  @IsOptional()
  quantity?: number;

  @ApiPropertyOptional({ example: 'rent' })
  @IsString()
  @IsOptional()
  itemType?: string;
}

export class CreateInvoiceDto {
  @ApiProperty({ description: 'Contract ID for this invoice' })
  @IsUUID()
  rentalContractId: string;

  @ApiProperty({ example: '2026-02-15', description: 'Due date' })
  @IsDateString()
  dueDate: string;

  @ApiProperty({ example: '2026-02-01', description: 'Billing period start' })
  @IsDateString()
  billingPeriodStart: string;

  @ApiProperty({ example: '2026-02-28', description: 'Billing period end' })
  @IsDateString()
  billingPeriodEnd: string;

  @ApiProperty({ type: [InvoiceItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items: InvoiceItemDto[];

  @ApiPropertyOptional({
    enum: InvoiceType,
    default: InvoiceType.rent,
    description: 'Invoice type for payment routing and display',
  })
  @IsOptional()
  @IsEnum(InvoiceType)
  invoiceType?: InvoiceType;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}

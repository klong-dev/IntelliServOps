import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ApartmentStatus,
  PartnerCooperationContractStatus,
} from '@prisma/client';
import {
  Allow,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class SignCooperationContractDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Signed cooperation contract PDF file (required)',
  })
  @Allow()
  contractPdf: any;

  @ApiPropertyOptional({
    description: 'Signed date for cooperation contract (ISO 8601)',
    example: '2026-03-24T14:00:00.000Z',
  })
  @IsDateString()
  @IsOptional()
  signedDate?: string;
}

export class SignCooperationContractResultDto {
  @ApiProperty({ example: 'ca5f5756-2748-4e63-86cb-179cfb966f27' })
  apartmentId: string;

  @ApiProperty({ example: 'P-1205' })
  apartmentNumber: string;

  @ApiProperty({ enum: ApartmentStatus, example: ApartmentStatus.available })
  apartmentStatus: ApartmentStatus;

  @ApiProperty({ example: '3f5369be-815f-42cb-8a8b-971fbe4a3557' })
  cooperationContractId: string;

  @ApiProperty({ example: 'COOP-2026-00001' })
  cooperationContractNumber: string;

  @ApiProperty({
    enum: PartnerCooperationContractStatus,
    example: PartnerCooperationContractStatus.signed,
  })
  cooperationContractStatus: PartnerCooperationContractStatus;

  @ApiPropertyOptional({
    type: Date,
    format: 'date-time',
    nullable: true,
    example: '2026-03-24T14:00:00.000Z',
  })
  signedDate: Date | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example:
      'https://cdn.example.com/apartment-cooperation-contracts/apt-1/partner-signed.pdf',
  })
  contractDocumentUrl: string | null;

  @ApiProperty({
    example:
      '/apartments/cooperation-contracts/3f5369be-815f-42cb-8a8b-971fbe4a3557/pdf',
    description: 'Internal API URL to download signed cooperation contract PDF',
  })
  cooperationContractPdfUrl: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example:
      '/apartments/cooperation-contracts/pdf/view?token=eyJhY2Nlc3MiOiJwZGYifQ',
    description:
      'Public signed-token URL to view signed cooperation contract PDF',
  })
  cooperationContractPublicPdfUrl: string | null;
}

export class CancelCooperationContractDto {
  @ApiPropertyOptional({
    example: 'Partner khong tiep tuc hop tac trong giai doan nay',
    description:
      'Reason provided by partner when cancelling cooperation contract',
  })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  reason?: string;
}

export class CancelCooperationContractResultDto {
  @ApiProperty({ example: 'ca5f5756-2748-4e63-86cb-179cfb966f27' })
  apartmentId: string;

  @ApiProperty({ example: 'P-1205' })
  apartmentNumber: string;

  @ApiProperty({ enum: ApartmentStatus, example: ApartmentStatus.inactive })
  apartmentStatus: ApartmentStatus;

  @ApiProperty({ example: '3f5369be-815f-42cb-8a8b-971fbe4a3557' })
  cooperationContractId: string;

  @ApiProperty({ example: 'COOP-2026-00001' })
  cooperationContractNumber: string;

  @ApiProperty({
    enum: PartnerCooperationContractStatus,
    example: PartnerCooperationContractStatus.cancelled,
  })
  cooperationContractStatus: PartnerCooperationContractStatus;

  @ApiProperty({
    format: 'date-time',
    example: '2026-03-24T16:20:00.000Z',
  })
  cancelledAt: Date;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Partner khong tiep tuc hop tac trong giai doan nay',
  })
  cancelReason: string | null;
}

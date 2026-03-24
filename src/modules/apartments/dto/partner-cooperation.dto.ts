import { OmitType, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateApartmentDto } from './create-apartment.dto';
import { UpdateApartmentDto } from './update-apartment.dto';
import {
  Allow,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  ApartmentStatus,
  PartnerCooperationContractStatus,
} from '@prisma/client';

export class CreatePartnerCooperationApartmentDto extends OmitType(
  CreateApartmentDto,
  ['images', 'videoTourUrl', 'ownerId'] as const,
) {}

export class SubmitPartnerCooperationRequestDto extends CreatePartnerCooperationApartmentDto {
  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'string', format: 'binary' },
    description: 'Apartment images (JPEG, PNG, WebP), max 10 files',
  })
  @Allow()
  images?: any[];

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Apartment video (MP4, MOV, WEBM), max 1 file',
  })
  @Allow()
  video?: any;
}

export class UpdatePartnerCooperationApartmentInUploadDto extends OmitType(
  UpdateApartmentDto,
  ['status'] as const,
) {}

export class UploadPartnerCooperationMediaRequestDto extends OmitType(
  UpdatePartnerCooperationApartmentInUploadDto,
  ['images', 'videoTourUrl', 'ownerId'] as const,
) {
  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'string', format: 'binary' },
    description: 'Apartment images (JPEG, PNG, WebP), max 10 files',
  })
  @Allow()
  images?: any[];

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Apartment video (MP4, MOV, WEBM), max 1 file',
  })
  @Allow()
  video?: any;
}

export class PartnerCooperationSubmitResultDto {
  @ApiProperty({ example: 'ca5f5756-2748-4e63-86cb-179cfb966f27' })
  id: string;

  @ApiProperty({ example: 'P-1205' })
  apartmentNumber: string;

  @ApiProperty({
    enum: ApartmentStatus,
    example: ApartmentStatus.inactive,
    description:
      'inactive when media is missing, verified when both image and video are uploaded at submit',
  })
  status: ApartmentStatus;

  @ApiProperty({ example: 'e33f798c-7978-4a86-b243-b3ac43e020ba' })
  ownerId: string;

  @ApiPropertyOptional({
    type: [String],
    nullable: true,
    example: null,
    description: 'Apartment images uploaded in submit step (if provided)',
  })
  images: string[] | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: null,
    description: 'Apartment video uploaded in submit step (if provided)',
  })
  videoTourUrl: string | null;

  @ApiProperty({
    format: 'date-time',
    example: '2026-03-24T09:15:00.000Z',
  })
  createdAt: Date;
}

export class ApartmentMediaUploadResultDto {
  @ApiProperty({ example: 'ca5f5756-2748-4e63-86cb-179cfb966f27' })
  id: string;

  @ApiProperty({ example: 'P-1205' })
  apartmentNumber: string;

  @ApiProperty({ enum: ApartmentStatus, example: ApartmentStatus.verified })
  status: ApartmentStatus;

  @ApiPropertyOptional({
    type: [String],
    nullable: true,
    example: [
      'https://cdn.example.com/apartment-cooperation/apt-1-1.jpg',
      'https://cdn.example.com/apartment-cooperation/apt-1-2.jpg',
    ],
  })
  images: string[] | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'https://cdn.example.com/apartment-cooperation/apt-1-tour.mp4',
  })
  videoTourUrl: string | null;

  @ApiProperty({
    format: 'date-time',
    example: '2026-03-24T09:30:00.000Z',
  })
  updatedAt: Date;
}

export class ApprovePartnerCooperationResultDto {
  @ApiProperty({ example: 'ca5f5756-2748-4e63-86cb-179cfb966f27' })
  id: string;

  @ApiProperty({ example: 'P-1205' })
  apartmentNumber: string;

  @ApiProperty({ enum: ApartmentStatus, example: ApartmentStatus.pending })
  status: ApartmentStatus;

  @ApiPropertyOptional({
    type: [String],
    nullable: true,
    example: ['https://cdn.example.com/apartment-cooperation/apt-1-1.jpg'],
  })
  images: string[] | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'https://cdn.example.com/apartment-cooperation/apt-1-tour.mp4',
  })
  videoTourUrl: string | null;

  @ApiPropertyOptional({
    type: Date,
    format: 'date-time',
    nullable: true,
    example: '2026-03-24T10:30:00.000Z',
  })
  approvedAt: Date | null;

  @ApiProperty({
    example: '3f5369be-815f-42cb-8a8b-971fbe4a3557',
    description: 'Generated cooperation contract ID',
  })
  cooperationContractId: string;

  @ApiProperty({
    example: 'COOP-2026-00001',
    description: 'Generated cooperation contract number',
  })
  cooperationContractNumber: string;

  @ApiProperty({
    enum: PartnerCooperationContractStatus,
    example: PartnerCooperationContractStatus.pending,
    description: 'Cooperation contract status',
  })
  cooperationContractStatus: PartnerCooperationContractStatus;

  @ApiProperty({
    example:
      '/apartments/cooperation-contracts/3f5369be-815f-42cb-8a8b-971fbe4a3557/pdf',
    description: 'Internal API URL to download generated contract PDF',
  })
  cooperationContractPdfUrl: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example:
      '/apartments/cooperation-contracts/pdf/view?token=eyJhY2Nlc3MiOiJwZGYifQ',
    description: 'Public signed-token URL to view generated contract PDF',
  })
  cooperationContractPublicPdfUrl: string | null;
}

export class SignPartnerCooperationContractDto {
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

export class PartnerSignCooperationContractResultDto {
  @ApiProperty({ example: 'ca5f5756-2748-4e63-86cb-179cfb966f27' })
  apartmentId: string;

  @ApiProperty({ example: 'P-1205' })
  apartmentNumber: string;

  @ApiProperty({
    enum: ApartmentStatus,
    example: ApartmentStatus.available,
    description: 'Apartment status after partner signs cooperation contract',
  })
  apartmentStatus: ApartmentStatus;

  @ApiProperty({
    example: '3f5369be-815f-42cb-8a8b-971fbe4a3557',
    description: 'Signed cooperation contract ID',
  })
  cooperationContractId: string;

  @ApiProperty({
    example: 'COOP-2026-00001',
    description: 'Signed cooperation contract number',
  })
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

export class PartnerCooperationContractDetailDto {
  @ApiProperty({ example: 'ca5f5756-2748-4e63-86cb-179cfb966f27' })
  apartmentId: string;

  @ApiProperty({ example: 'P-1205' })
  apartmentNumber: string;

  @ApiProperty({
    example: '3f5369be-815f-42cb-8a8b-971fbe4a3557',
  })
  cooperationContractId: string;

  @ApiProperty({
    example: 'COOP-2026-00001',
  })
  cooperationContractNumber: string;

  @ApiProperty({
    enum: PartnerCooperationContractStatus,
    example: PartnerCooperationContractStatus.pending,
  })
  cooperationContractStatus: PartnerCooperationContractStatus;

  @ApiProperty({
    format: 'date-time',
    example: '2026-03-24T10:30:00.000Z',
  })
  startDate: Date;

  @ApiProperty({
    format: 'date-time',
    example: '2027-03-24T10:30:00.000Z',
  })
  endDate: Date;

  @ApiProperty({
    example: 10,
    description: 'Monthly revenue commission rate (%)',
  })
  commissionRate: number;

  @ApiPropertyOptional({
    type: Date,
    format: 'date-time',
    nullable: true,
    example: '2026-03-25T08:00:00.000Z',
  })
  signedDate: Date | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example:
      'https://cdn.example.com/apartment-cooperation-contracts/apt-1/partner-signed.pdf',
  })
  contractDocumentUrl: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example:
      '/apartments/cooperation-contracts/3f5369be-815f-42cb-8a8b-971fbe4a3557/pdf',
    description: 'Internal API URL to download cooperation contract PDF',
  })
  cooperationContractPdfUrl: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example:
      '/apartments/cooperation-contracts/pdf/view?token=eyJhY2Nlc3MiOiJwZGYifQ',
    description: 'Public signed-token URL to view cooperation contract PDF',
  })
  cooperationContractPublicPdfUrl: string | null;

  @ApiProperty({
    format: 'date-time',
    example: '2026-03-24T10:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    format: 'date-time',
    example: '2026-03-24T10:30:00.000Z',
  })
  updatedAt: Date;
}

export class CancelPartnerCooperationContractDto {
  @ApiPropertyOptional({
    example: 'Partner khong tiep tuc hop tac trong giai doan nay',
    description: 'Ly do huy hop dong hop tac',
  })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  reason?: string;
}

export class CancelPartnerCooperationContractResultDto {
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

export class RejectPartnerCooperationApartmentDto {
  @ApiProperty({
    example: 'Thong tin can ho chua day du, vui long cap nhat lai',
    description: 'Ly do reject cooperation apartment',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}

export class RejectPartnerCooperationResultDto {
  @ApiProperty({ example: 'ca5f5756-2748-4e63-86cb-179cfb966f27' })
  id: string;

  @ApiProperty({ example: 'P-1205' })
  apartmentNumber: string;

  @ApiProperty({ enum: ApartmentStatus, example: ApartmentStatus.inactive })
  status: ApartmentStatus;

  @ApiProperty({
    format: 'date-time',
    example: '2026-03-24T16:20:00.000Z',
  })
  rejectedAt: Date;

  @ApiProperty({
    example: 'Thong tin can ho chua day du, vui long cap nhat lai',
  })
  rejectionReason: string;
}

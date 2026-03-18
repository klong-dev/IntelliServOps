import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class UploadContractPdfDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Signed contract PDF file (required)',
  })
  contractPdf: any;

  @ApiPropertyOptional({
    description: 'Signed date for the contract (ISO 8601)',
    example: '2026-03-17T10:30:00.000Z',
  })
  @IsDateString()
  @IsOptional()
  signedDate?: string;

  @ApiPropertyOptional({
    description: 'URL to the signed contract document',
    example: 'https://storage.example.com/contracts/signed/CTR-2026-00001.pdf',
  })
  @IsString()
  @IsOptional()
  contractDocumentUrl?: string;
}

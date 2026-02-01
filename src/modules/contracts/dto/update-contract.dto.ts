import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateContractDto } from './create-contract.dto';
import { IsEnum, IsOptional, IsString, IsDateString, IsNumber, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ContractStatus } from '@prisma/client';

export class UpdateContractDto extends PartialType(
  OmitType(CreateContractDto, ['apartmentId', 'members'] as const),
) {
  @ApiPropertyOptional({ enum: ContractStatus })
  @IsEnum(ContractStatus)
  @IsOptional()
  status?: ContractStatus;

  @ApiPropertyOptional({ description: 'Signed date when contract is activated' })
  @IsDateString()
  @IsOptional()
  signedDate?: string;

  @ApiPropertyOptional({ description: 'URL to signed contract document' })
  @IsString()
  @IsOptional()
  contractDocumentUrl?: string;

  @ApiPropertyOptional({ description: 'Date of early termination' })
  @IsDateString()
  @IsOptional()
  terminationDate?: string;

  @ApiPropertyOptional({ description: 'Reason for termination' })
  @IsString()
  @IsOptional()
  terminationReason?: string;

  @ApiPropertyOptional({ description: 'Early termination fee' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  earlyTerminationFee?: number;
}

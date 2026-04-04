import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContractDetailDto } from './contract-response.dto';

export enum RenewalOption {
  KEEP_CURRENT = 'keep_current',
  CUSTOMIZE = 'customize',
}

export class RenewContractDto {
  @ApiProperty({
    enum: RenewalOption,
    example: RenewalOption.KEEP_CURRENT,
    description:
      'Renew option. keep_current: keep old duration and members. customize: provide new extensionMonths and optional memberNationalIds.',
  })
  @IsEnum(RenewalOption)
  renewalOption: RenewalOption;

  @ApiPropertyOptional({
    example: 12,
    description:
      'Number of months to extend. Required when renewalOption is customize.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  extensionMonths?: number;

  @ApiPropertyOptional({
    type: [String],
    example: ['079203009999', '079203008888'],
    description:
      'List of member CCCD numbers. Only applied when renewalOption is customize. Final members will be current user + this list, old members are not kept.',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  memberNationalIds?: string[];
}

export class RenewContractResponseDto {
  @ApiProperty({
    example: '9fbc9e7e-5a4d-4f38-9ba8-cc96af4f0eaf',
    description: 'Source contract ID used for renewal',
  })
  sourceContractId: string;

  @ApiProperty({
    example: 'CTR-2026-00001',
    description: 'Source contract number used for renewal',
  })
  sourceContractNumber: string;

  @ApiPropertyOptional({
    example: 12,
    nullable: true,
    description: 'Effective extension months used to calculate new endDate',
  })
  extensionMonths: number | null;

  @ApiProperty({
    enum: RenewalOption,
    example: RenewalOption.KEEP_CURRENT,
    description: 'Applied renewal option for this request',
  })
  renewalOption: RenewalOption;

  @ApiProperty({
    type: ContractDetailDto,
    description: 'New renewed contract in draft status (unsigned)',
  })
  renewedContract: ContractDetailDto;
}

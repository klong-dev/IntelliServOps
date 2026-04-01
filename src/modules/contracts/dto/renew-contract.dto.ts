import {
  IsArray,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  PartialType,
  OmitType,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CreateContractDto } from './create-contract.dto';
import { AddContractMemberDto } from './add-contract-member.dto';
import { ContractDetailDto } from './contract-response.dto';

export class RenewContractDto extends PartialType(
  OmitType(CreateContractDto, ['apartmentId', 'members'] as const),
) {
  @ApiPropertyOptional({
    example: 12,
    description:
      'Number of months to extend. If startDate/endDate are not provided, system auto-calculates next term from previous endDate.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  extensionMonths?: number;

  @ApiPropertyOptional({
    type: [AddContractMemberDto],
    description:
      'Additional members to append into renewed contract by CCCD number.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddContractMemberDto)
  additionalMembers?: AddContractMemberDto[];
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
    type: ContractDetailDto,
    description: 'New renewed contract in draft status (unsigned)',
  })
  renewedContract: ContractDetailDto;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
} from 'class-validator';
import { MemberType } from '@prisma/client';

export class AddContractMemberDto {
  @ApiProperty({
    description: 'CCCD number of the user to add into contract',
    example: '079203001234',
  })
  @IsString()
  nationalId: string;

  @ApiPropertyOptional({ enum: MemberType, default: MemberType.co_tenant })
  @IsOptional()
  @IsEnum(MemberType)
  memberType?: MemberType;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isPrimaryContact?: boolean;

  @ApiPropertyOptional({ example: 50, description: 'Share percentage' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  sharePercentage?: number;
}

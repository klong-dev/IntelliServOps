import { IsString, IsOptional, IsEmail, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePartnerProfileDto {
  @ApiPropertyOptional({ example: 'Nguyễn Văn A' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  fullName?: string;

  @ApiPropertyOptional({ example: '0901234567' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ example: 'partner@company.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: 'Công ty TNHH ABC' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  companyName?: string;

  @ApiPropertyOptional({ example: '0123456789' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  taxCode?: string;

  @ApiPropertyOptional({ example: '9704 0000 1234 5678' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  bankAccountNumber?: string;

  @ApiPropertyOptional({ example: 'Vietcombank' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  bankName?: string;

  @ApiPropertyOptional({ example: '123 Nguyễn Huệ, Q1, TP.HCM' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  address?: string;
}

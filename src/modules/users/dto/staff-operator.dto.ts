import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OperatorShift, StaffRole } from '@prisma/client';

export class SearchStaffDto {
  @ApiPropertyOptional({
    example: 'nguyen',
    description: 'Search by fullName, email, phone, employeeCode',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;
}

export class SearchOperatorDto {
  @ApiPropertyOptional({
    example: 'tran',
    description: 'Search by fullName, email, phone, employeeCode',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;
}

export class CreateStaffDto {
  @ApiProperty({ example: 'staff1@intelliservops.vn' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '0901234567' })
  @IsString()
  phone!: string;

  @ApiProperty({ example: 'Nguyen Van Staff' })
  @IsString()
  fullName!: string;

  @ApiProperty({ example: 'STF-001' })
  @IsString()
  employeeCode!: string;

  @ApiProperty({ enum: StaffRole, example: StaffRole.general })
  @IsEnum(StaffRole)
  role!: StaffRole;

  @ApiPropertyOptional({ example: 'Operations' })
  @IsString()
  @IsOptional()
  department?: string;

  @ApiPropertyOptional({ example: 'HCM' })
  @IsString()
  @IsOptional()
  workingCity?: string;

  @ApiPropertyOptional({ example: 'District 1' })
  @IsString()
  @IsOptional()
  workingDistrict?: string;

  @ApiPropertyOptional({ example: 10.7769 })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  latitude?: number;

  @ApiPropertyOptional({ example: 106.7009 })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  longitude?: number;

  @ApiProperty({ example: '2026-04-06' })
  @IsString()
  hireDate!: string;

  @ApiProperty({ example: 'Staff@1234', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateStaffDto extends PartialType(CreateStaffDto) {}

export class CreateOperatorDto {
  @ApiProperty({ example: 'operator1@intelliservops.vn' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '0901234567' })
  @IsString()
  phone!: string;

  @ApiProperty({ example: 'Tran Van Operator' })
  @IsString()
  fullName!: string;

  @ApiProperty({ example: 'OP-001' })
  @IsString()
  employeeCode!: string;

  @ApiPropertyOptional({ enum: OperatorShift, example: OperatorShift.flexible })
  @IsEnum(OperatorShift)
  @IsOptional()
  shift?: OperatorShift;

  @ApiProperty({ example: 'Operator@1234', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateOperatorDto extends PartialType(CreateOperatorDto) {}

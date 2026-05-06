import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class UpdateGlobalUtilityRateDto {
  @ApiPropertyOptional({
    example: 3500,
    description: 'Default electricity rate in VND per kWh for new meters',
  })
  @IsNumber()
  @Min(1)
  @IsOptional()
  electricityRatePerUnit?: number;

  @ApiPropertyOptional({
    example: 15000,
    description: 'Default water rate in VND per m3 for new meters',
  })
  @IsNumber()
  @Min(1)
  @IsOptional()
  waterRatePerUnit?: number;

  @ApiPropertyOptional({
    example: 'Default rates for new utility meters',
  })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class CurrentUtilityRateQueryDto {
  @ApiProperty({ description: 'Apartment ID' })
  @IsUUID()
  apartmentId: string;
}

export class UpdateCurrentUtilityRateDto {
  @ApiProperty({ description: 'Apartment ID' })
  @IsUUID()
  apartmentId: string;

  @ApiPropertyOptional({
    example: 3500,
    description: 'Electricity rate in VND per kWh',
  })
  @IsNumber()
  @Min(1)
  @IsOptional()
  electricityRatePerUnit?: number;

  @ApiPropertyOptional({
    example: 15000,
    description: 'Water rate in VND per m3',
  })
  @IsNumber()
  @Min(1)
  @IsOptional()
  waterRatePerUnit?: number;
}

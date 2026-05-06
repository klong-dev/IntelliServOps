import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

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

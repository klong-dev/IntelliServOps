import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsBoolean,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IoTDeviceType } from '@prisma/client';

export class CreateIoTDeviceDto {
  @ApiProperty({ example: 'Smart Lock - Front Door' })
  @IsString()
  @MaxLength(255)
  deviceName: string;

  @ApiProperty({ enum: IoTDeviceType })
  @IsEnum(IoTDeviceType)
  deviceType: IoTDeviceType;

  @ApiPropertyOptional({ example: 'Tuya' })
  @IsString()
  @IsOptional()
  brand?: string;

  @ApiPropertyOptional({ example: 'ZM-100' })
  @IsString()
  @IsOptional()
  model?: string;

  @ApiPropertyOptional({ example: 'SN-123456' })
  @IsString()
  @IsOptional()
  serialNumber?: string;

  @ApiPropertyOptional({ example: 'AA:BB:CC:DD:EE:FF' })
  @IsString()
  @IsOptional()
  macAddress?: string;

  @ApiProperty({ description: 'Apartment ID' })
  @IsUUID()
  apartmentId: string;

  @ApiPropertyOptional({ description: 'Room ID' })
  @IsUUID()
  @IsOptional()
  roomId?: string;

  @ApiPropertyOptional({ example: 'Installed at main entrance' })
  @IsString()
  @IsOptional()
  locationDescription?: string;

  @ApiPropertyOptional({ example: '1.2.3' })
  @IsString()
  @IsOptional()
  firmwareVersion?: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isControllableByTenant?: boolean;

  @ApiPropertyOptional({ example: '2026-01-15' })
  @IsDateString()
  @IsOptional()
  installationDate?: string;

  @ApiPropertyOptional({ example: '2028-01-15' })
  @IsDateString()
  @IsOptional()
  warrantyExpiryDate?: string;

  @ApiPropertyOptional({ description: 'Device configuration JSON' })
  @IsOptional()
  configuration?: Record<string, any>;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

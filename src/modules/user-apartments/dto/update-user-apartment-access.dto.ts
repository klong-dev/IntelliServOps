import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateUserApartmentAccessDto {
  @ApiPropertyOptional({
    example: '2580',
    description: 'Apartment door password/PIN',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  apartmentDoorPassword?: string;

  @ApiPropertyOptional({
    example: 'GATE-9911',
    description: 'Building gate code',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  buildingGateCode?: string;

  @ApiPropertyOptional({
    example: 'SL-8899',
    description: 'Smart lock PIN/code',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  smartLockPin?: string;

  @ApiPropertyOptional({ example: 'MB-1188', description: 'Mailbox code' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  mailboxCode?: string;

  @ApiPropertyOptional({
    example: 'PARK-B2-99',
    description: 'Parking access code/card number',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  parkingAccessCode?: string;

  @ApiPropertyOptional({
    example: 'INTELLI_HOME_12A',
    description: 'WiFi SSID name',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  wifiName?: string;

  @ApiPropertyOptional({
    example: 'Wifi@2026#Safe',
    description: 'WiFi password',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  wifiPassword?: string;

  @ApiPropertyOptional({
    example: 'To ky thuat toa A',
    description: 'Emergency contact name for apartment support',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  emergencyContactName?: string;

  @ApiPropertyOptional({
    example: '0901234567',
    description: 'Emergency contact phone',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  emergencyContactPhone?: string;

  @ApiPropertyOptional({
    example: 'Khong cung cap cho ben thu ba',
    description: 'Internal notes for access instructions',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

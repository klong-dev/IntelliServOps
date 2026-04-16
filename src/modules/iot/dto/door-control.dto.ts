import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsString, Matches } from 'class-validator';

const normalizeAction = (value: unknown) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export const DOOR_CONTROL_ACTIONS = ['LOCK', 'UNLOCK'] as const;

export class DoorControlDto {
  @ApiProperty({
    enum: DOOR_CONTROL_ACTIONS,
    example: 'UNLOCK',
    description: 'Door action from app',
  })
  @Transform(({ value }) => normalizeAction(value))
  @IsIn(DOOR_CONTROL_ACTIONS)
  action: (typeof DOOR_CONTROL_ACTIONS)[number];
}

export class UpdateDoorPinDto {
  @ApiProperty({
    example: '258036',
    description: 'Current 6-digit door PIN',
  })
  @IsString()
  @Matches(/^\d{6}$/, {
    message: 'oldPin must be exactly 6 digits',
  })
  oldPin: string;

  @ApiProperty({
    example: '290304',
    description: 'New 6-digit door PIN',
  })
  @IsString()
  @Matches(/^\d{6}$/, {
    message: 'newPin must be exactly 6 digits',
  })
  newPin: string;
}

export class UnlockDoorDto {
  @ApiProperty({
    example: '290304',
    description: 'Current 6-digit PIN used to unlock the smart door',
  })
  @IsString()
  @Matches(/^\d{6}$/, {
    message: 'pin must be exactly 6 digits',
  })
  pin: string;
}

export class ResetDoorPinDto {
  @ApiProperty({
    example: '290304',
    description: 'New 6-digit door PIN set by staff/operator/admin',
  })
  @IsString()
  @Matches(/^\d{6}$/, {
    message: 'newPin must be exactly 6 digits',
  })
  newPin: string;
}

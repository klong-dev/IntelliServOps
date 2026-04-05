import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn } from 'class-validator';

export const IOT_DEVICE_ACTIONS = [
  'ON',
  'OFF',
  'OPEN',
  'CLOSE',
  'LOCK',
  'UNLOCK',
] as const;

const normalizeAction = (value: unknown) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class DeviceActionDto {
  @ApiProperty({
    enum: IOT_DEVICE_ACTIONS,
    example: 'ON',
    description:
      'MQTT action to send to the target device. Legacy routes still accept OPEN/CLOSE and LOCK/UNLOCK.',
  })
  @Transform(({ value }) => normalizeAction(value))
  @IsIn(IOT_DEVICE_ACTIONS)
  action: (typeof IOT_DEVICE_ACTIONS)[number];
}

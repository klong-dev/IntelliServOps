import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn } from 'class-validator';

export const IOT_DEVICE_ACTIONS = ['ON', 'OFF', 'OPEN', 'CLOSE'] as const;

export class DeviceActionDto {
  @ApiProperty({
    enum: IOT_DEVICE_ACTIONS,
    example: 'ON',
    description: 'MQTT action to send to the target device channel',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsIn(IOT_DEVICE_ACTIONS)
  action: (typeof IOT_DEVICE_ACTIONS)[number];
}

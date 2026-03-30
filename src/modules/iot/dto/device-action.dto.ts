import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export const IOT_DEVICE_ACTIONS = ['on', 'off', 'open', 'close'] as const;

export class DeviceActionDto {
  @ApiProperty({
    enum: IOT_DEVICE_ACTIONS,
    example: 'on',
    description: 'MQTT action to send to the target device channel',
  })
  @IsIn(IOT_DEVICE_ACTIONS)
  action: (typeof IOT_DEVICE_ACTIONS)[number];
}

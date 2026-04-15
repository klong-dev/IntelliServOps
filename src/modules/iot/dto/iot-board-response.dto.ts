import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IoTStatus } from '@prisma/client';
import { BOARD_DEVICE_STATES, type BoardDeviceState } from './create-iot-board.dto';

class IoTBoardApartmentSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'A101' })
  apartmentNumber: string;

  @ApiProperty({ example: '123 Nguyen Hue, Q1' })
  address: string;
}

export class IoTBoardDeviceItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Front Door Lock' })
  deviceName: string;

  @ApiProperty({ example: 1 })
  deviceId: number;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'door-lock' })
  icon: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'door' })
  topic: string | null;

  @ApiPropertyOptional({
    enum: BOARD_DEVICE_STATES,
    nullable: true,
    example: 'OFF',
  })
  state: BoardDeviceState | null;

  @ApiProperty({ enum: IoTStatus, example: IoTStatus.active })
  status: IoTStatus;
}

export class IoTBoardListItemDto {
  @ApiProperty({ example: 'ESP_A101' })
  id: string;

  @ApiProperty({ example: 'A101 Main Board' })
  name: string;

  @ApiProperty({ enum: IoTStatus, example: IoTStatus.active })
  status: IoTStatus;

  @ApiProperty({ example: 3 })
  deviceCount: number;

  @ApiPropertyOptional({ type: IoTBoardApartmentSummaryDto, nullable: true })
  apartment: IoTBoardApartmentSummaryDto | null;

  @ApiProperty({ type: [IoTBoardDeviceItemDto] })
  devices: IoTBoardDeviceItemDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class IoTBoardDetailDto extends IoTBoardListItemDto {
  @ApiPropertyOptional({ type: Date, nullable: true })
  lastOnlineAt: Date | null;
}

export class IoTBoardDeleteResultDto {
  @ApiProperty({ example: 'ESP_A101' })
  id: string;

  @ApiProperty({ example: 'A101 Main Board' })
  name: string;

  @ApiProperty({ example: 3 })
  affectedDevices: number;

  @ApiProperty({ enum: IoTStatus, example: IoTStatus.inactive })
  status: IoTStatus;
}

export class IoTBoardDeviceDeleteResultDto {
  @ApiProperty({ example: '36ed4722-82e2-49e9-8175-4d099e80102d' })
  id: string;

  @ApiProperty({ example: 'Tmp Light 2' })
  deviceName: string;

  @ApiProperty({ enum: IoTStatus, example: IoTStatus.inactive })
  status: IoTStatus;
}

export class IoTBoardUnlinkResultDto {
  @ApiProperty({ example: 'ESP_A101' })
  boardId: string;

  @ApiProperty({ example: 'A101 Main Board' })
  boardName: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  previousApartmentId: string | null;

  @ApiProperty({ example: 3 })
  affectedDevices: number;
}

export class IoTApartmentBoardsUnlinkResultDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  apartmentId: string;

  @ApiProperty({ example: 2 })
  affectedBoards: number;

  @ApiProperty({ example: 5 })
  affectedDevices: number;
}

export class IoTUtilityMeterItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'MTR-001' })
  meterNumber: string;

  @ApiProperty({ example: 'electricity' })
  meterType: string;

  @ApiPropertyOptional({ example: '1250.00', nullable: true })
  currentReading: string | null;

  @ApiPropertyOptional({ example: '1100.00', nullable: true })
  previousReading: string | null;

  @ApiPropertyOptional({ example: '3500.00', nullable: true })
  ratePerUnit: string | null;

  @ApiPropertyOptional({ example: 'kWh', nullable: true })
  unitOfMeasurement: string | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  readingDate: Date | null;

  @ApiProperty({ example: 'active' })
  status: string;
}

export class IoTBoardMetersDto {
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'ESP_A101',
  })
  boardId: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  apartmentId: string | null;

  @ApiPropertyOptional({ type: IoTUtilityMeterItemDto, nullable: true })
  electric: IoTUtilityMeterItemDto | null;

  @ApiPropertyOptional({ type: IoTUtilityMeterItemDto, nullable: true })
  water: IoTUtilityMeterItemDto | null;
}

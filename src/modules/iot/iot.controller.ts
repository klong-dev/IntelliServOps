import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IoTService } from './iot.service';
import {
  ControlDeviceDto,
  ControlDeviceResponseDto,
  CreateIoTDeviceDto,
  CreateUtilityMeterDto,
  CreateUtilityReadingDto,
  DeviceActionDto,
  IoTDeviceDetailDto,
  IoTDeviceListItemDto,
  IoTGatewayStatusDto,
  IoTMqttCommandResultDto,
  IoTTestSequenceResponseDto,
  SetDoorPasswordDto,
  TestSequenceDto,
  UpdateIoTDeviceDto,
  UpdateUtilityMeterDto,
  UtilityMeterDetailDto,
  UtilityMeterListItemDto,
  UtilityReadingDto,
} from './dto';
import { ApiJsonResponse } from '../../common/dto';
import { CurrentUser, Public, Roles } from '../../common/decorators';
import { Role } from '../../common/enums/role.enum';
import type { JwtPayload } from '../auth/auth.service';
import { IoTStatus, MeterStatus } from '@prisma/client';

@ApiTags('IoT')
@Controller('iot')
export class IoTController {
  constructor(private readonly iotService: IoTService) {}

  @Get('online')
  @Public()
  @ApiOperation({ summary: 'Check MQTT gateway availability' })
  @ApiJsonResponse(IoTGatewayStatusDto, {
    description: 'IoT MQTT gateway status',
  })
  getGatewayStatus() {
    return this.iotService.getGatewayStatus();
  }

  // ============================================================================
  // Direct MQTT Routes Compatible With control-iot-server
  // ============================================================================

  @Post('devices/:espId/light/:id')
  @Public()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Publish light command to MQTT device' })
  @ApiJsonResponse(IoTMqttCommandResultDto, {
    description: 'Light command published to MQTT broker',
  })
  triggerLight(
    @Param('espId') espId: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: DeviceActionDto,
  ) {
    return this.iotService.triggerLight(espId, id, body.action);
  }

  @Post('devices/:espId/alarm/:id')
  @Public()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Publish alarm command to MQTT device' })
  @ApiJsonResponse(IoTMqttCommandResultDto, {
    description: 'Alarm command published to MQTT broker',
  })
  triggerAlarm(
    @Param('espId') espId: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: DeviceActionDto,
  ) {
    return this.iotService.triggerAlarm(espId, id, body.action);
  }

  @Post('devices/:espId/door/:id')
  @Public()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Publish door command to MQTT device' })
  @ApiJsonResponse(IoTMqttCommandResultDto, {
    description: 'Door command published to MQTT broker',
  })
  triggerDoor(
    @Param('espId') espId: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: DeviceActionDto,
  ) {
    return this.iotService.triggerDoor(espId, id, body.action);
  }

  @Post('devices/:espId/curtain/:id')
  @Public()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Publish curtain command to MQTT device' })
  @ApiJsonResponse(IoTMqttCommandResultDto, {
    description: 'Curtain command published to MQTT broker',
  })
  triggerCurtain(
    @Param('espId') espId: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: DeviceActionDto,
  ) {
    return this.iotService.triggerCurtain(espId, id, body.action);
  }

  @Post('devices/:espId/config-door-password/:id')
  @Public()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Send door password directly to MQTT device' })
  @ApiJsonResponse(IoTMqttCommandResultDto, {
    description: 'Door password published to MQTT broker',
  })
  configureDoorPassword(
    @Param('espId') espId: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: SetDoorPasswordDto,
  ) {
    return this.iotService.configureDoorPassword(espId, id, body.password);
  }

  @Post('devices/:espId/test-sequence')
  @Public()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Run MQTT device test sequence' })
  @ApiJsonResponse(IoTTestSequenceResponseDto, {
    description: 'MQTT test sequence completed',
  })
  runTestSequence(
    @Param('espId') espId: string,
    @Body() body: TestSequenceDto,
  ) {
    return this.iotService.runDeviceTestSequence(espId, body.holdMs);
  }

  // ============================================================================
  // IoT Devices
  // ============================================================================

  @Get('devices')
  @Public()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'List all IoT devices' })
  @ApiQuery({ name: 'apartmentId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: IoTStatus })
  @ApiJsonResponse(IoTDeviceListItemDto, {
    isArray: true,
    description: 'List of IoT devices',
  })
  async findAllDevices(
    @Query('apartmentId') apartmentId?: string,
    @Query('status') status?: IoTStatus,
  ) {
    return this.iotService.findAllDevices(apartmentId, status);
  }

  @Get('devices/:id')
  @Public()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Get IoT device details' })
  @ApiJsonResponse(IoTDeviceDetailDto, { description: 'Device details' })
  @ApiResponse({ status: 404, description: 'Device not found' })
  async findOneDevice(@Param('id', ParseUUIDPipe) id: string) {
    return this.iotService.findOneDevice(id);
  }

  @Get('apartments/:apartmentId/devices')
  @Public()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({
    summary: 'Get devices by apartment',
    description: 'Tenants see only controllable active devices.',
  })
  @ApiJsonResponse(IoTDeviceListItemDto, {
    isArray: true,
    description: 'List of apartment devices',
  })
  async findDevicesByApartment(
    @Param('apartmentId', ParseUUIDPipe) apartmentId: string,
    @CurrentUser() currentUser?: JwtPayload,
  ) {
    return this.iotService.findDevicesByApartment(apartmentId, currentUser);
  }

  @Post('devices')
  @Public()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Register new IoT device' })
  @ApiJsonResponse(IoTDeviceDetailDto, {
    status: 201,
    description: 'Device registered',
  })
  async createDevice(@Body() createDto: CreateIoTDeviceDto) {
    return this.iotService.createDevice(createDto);
  }

  @Patch('devices/:id')
  @Public()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Update IoT device' })
  @ApiJsonResponse(IoTDeviceDetailDto, { description: 'Device updated' })
  async updateDevice(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateIoTDeviceDto,
  ) {
    return this.iotService.updateDevice(id, updateDto);
  }

  @Delete('devices/:id')
  @Public()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Deactivate IoT device' })
  @ApiResponse({ status: 200, description: 'Device deactivated' })
  async removeDevice(@Param('id', ParseUUIDPipe) id: string) {
    return this.iotService.removeDevice(id);
  }

  @Post('devices/:id/control')
  @Public()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({
    summary: 'Send command to IoT device',
    description:
      'Control device over MQTT using stored device metadata. Tenants must have an active contract.',
  })
  @ApiJsonResponse(ControlDeviceResponseDto, { description: 'Command sent' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async controlDevice(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() controlDto: ControlDeviceDto,
    @CurrentUser() currentUser?: JwtPayload,
  ) {
    return this.iotService.controlDevice(id, controlDto.command, currentUser);
  }

  // ============================================================================
  // Utility Meters
  // ============================================================================

  @Get('meters')
  @Public()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'List all utility meters' })
  @ApiQuery({ name: 'apartmentId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: MeterStatus })
  @ApiJsonResponse(UtilityMeterListItemDto, {
    isArray: true,
    description: 'List of utility meters',
  })
  async findAllMeters(
    @Query('apartmentId') apartmentId?: string,
    @Query('status') status?: MeterStatus,
  ) {
    return this.iotService.findAllMeters(apartmentId, status);
  }

  @Get('meters/:id')
  @Public()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Get utility meter details with readings history' })
  @ApiJsonResponse(UtilityMeterDetailDto, {
    description: 'Meter details with readings',
  })
  async findOneMeter(@Param('id', ParseUUIDPipe) id: string) {
    return this.iotService.findOneMeter(id);
  }

  @Post('meters')
  @Public()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Register new utility meter' })
  @ApiJsonResponse(UtilityMeterDetailDto, {
    status: 201,
    description: 'Meter registered',
  })
  async createMeter(@Body() createDto: CreateUtilityMeterDto) {
    return this.iotService.createMeter(createDto);
  }

  @Patch('meters/:id')
  @Public()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Update utility meter' })
  @ApiJsonResponse(UtilityMeterDetailDto, { description: 'Meter updated' })
  async updateMeter(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateUtilityMeterDto,
  ) {
    return this.iotService.updateMeter(id, updateDto);
  }

  // ============================================================================
  // Utility Readings
  // ============================================================================

  @Post('readings')
  @Public()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Record utility reading' })
  @ApiJsonResponse(UtilityReadingDto, {
    status: 201,
    description: 'Reading recorded',
  })
  async createReading(
    @Body() createDto: CreateUtilityReadingDto,
    @CurrentUser() currentUser?: JwtPayload,
  ) {
    return this.iotService.createReading(createDto, currentUser);
  }

  @Get('meters/:meterId/readings')
  @Public()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'Get meter reading history' })
  @ApiQuery({ name: 'limit', required: false, example: 12 })
  @ApiJsonResponse(UtilityReadingDto, {
    isArray: true,
    description: 'Reading history',
  })
  async getReadings(
    @Param('meterId', ParseUUIDPipe) meterId: string,
    @Query('limit') limit?: number,
  ) {
    return this.iotService.getReadings(meterId, limit);
  }

  @Patch('readings/:id/verify')
  @Public()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Verify utility reading' })
  @ApiJsonResponse(UtilityReadingDto, { description: 'Reading verified' })
  async verifyReading(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser?: JwtPayload,
  ) {
    return this.iotService.verifyReading(id, currentUser?.sub);
  }
}

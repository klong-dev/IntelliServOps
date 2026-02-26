import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { IoTService } from './iot.service';
import {
  CreateIoTDeviceDto,
  UpdateIoTDeviceDto,
  CreateUtilityMeterDto,
  UpdateUtilityMeterDto,
  CreateUtilityReadingDto,
  ControlDeviceDto,
  IoTDeviceListItemDto,
  IoTDeviceDetailDto,
  ControlDeviceResponseDto,
  UtilityMeterListItemDto,
  UtilityMeterDetailDto,
  UtilityReadingDto,
} from './dto';
import { Roles, CurrentUser } from '../../common/decorators';
import { Role } from '../../common/enums/role.enum';
import type { JwtPayload } from '../auth/auth.service';
import { IoTStatus, MeterStatus } from '@prisma/client';

@ApiTags('IoT')
@ApiBearerAuth()
@Controller('iot')
export class IoTController {
  constructor(private readonly iotService: IoTService) {}

  // ============================================================================
  // IoT Devices
  // ============================================================================

  @Get('devices')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'List all IoT devices' })
  @ApiQuery({ name: 'apartmentId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: IoTStatus })
  @ApiResponse({ status: 200, description: 'List of IoT devices', type: [IoTDeviceListItemDto] })
  async findAllDevices(
    @Query('apartmentId') apartmentId?: string,
    @Query('status') status?: IoTStatus,
  ) {
    return this.iotService.findAllDevices(apartmentId, status);
  }

  @Get('devices/:id')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Get IoT device details' })
  @ApiResponse({ status: 200, description: 'Device details', type: IoTDeviceDetailDto })
  @ApiResponse({ status: 404, description: 'Device not found' })
  async findOneDevice(@Param('id', ParseUUIDPipe) id: string) {
    return this.iotService.findOneDevice(id);
  }

  @Get('apartments/:apartmentId/devices')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({
    summary: 'Get devices by apartment',
    description: 'Tenants see only controllable active devices.',
  })
  @ApiResponse({ status: 200, description: 'List of apartment devices', type: [IoTDeviceListItemDto] })
  async findDevicesByApartment(
    @Param('apartmentId', ParseUUIDPipe) apartmentId: string,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.iotService.findDevicesByApartment(apartmentId, currentUser);
  }

  @Post('devices')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Register new IoT device' })
  @ApiResponse({ status: 201, description: 'Device registered', type: IoTDeviceDetailDto })
  async createDevice(@Body() createDto: CreateIoTDeviceDto) {
    return this.iotService.createDevice(createDto);
  }

  @Patch('devices/:id')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Update IoT device' })
  @ApiResponse({ status: 200, description: 'Device updated', type: IoTDeviceDetailDto })
  async updateDevice(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateIoTDeviceDto,
  ) {
    return this.iotService.updateDevice(id, updateDto);
  }

  @Delete('devices/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Deactivate IoT device' })
  @ApiResponse({ status: 200, description: 'Device deactivated' })
  async removeDevice(@Param('id', ParseUUIDPipe) id: string) {
    return this.iotService.removeDevice(id);
  }

  @Post('devices/:id/control')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({
    summary: 'Send command to IoT device',
    description:
      'Control device (lock/unlock, on/off). Tenants must have active contract.',
  })
  @ApiResponse({ status: 200, description: 'Command sent', type: ControlDeviceResponseDto })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async controlDevice(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() controlDto: ControlDeviceDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.iotService.controlDevice(id, controlDto.command, currentUser);
  }

  // ============================================================================
  // Utility Meters
  // ============================================================================

  @Get('meters')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'List all utility meters' })
  @ApiQuery({ name: 'apartmentId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: MeterStatus })
  @ApiResponse({ status: 200, description: 'List of utility meters', type: [UtilityMeterListItemDto] })
  async findAllMeters(
    @Query('apartmentId') apartmentId?: string,
    @Query('status') status?: MeterStatus,
  ) {
    return this.iotService.findAllMeters(apartmentId, status);
  }

  @Get('meters/:id')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Get utility meter details with readings history' })
  @ApiResponse({ status: 200, description: 'Meter details with readings', type: UtilityMeterDetailDto })
  async findOneMeter(@Param('id', ParseUUIDPipe) id: string) {
    return this.iotService.findOneMeter(id);
  }

  @Post('meters')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Register new utility meter' })
  @ApiResponse({ status: 201, description: 'Meter registered', type: UtilityMeterDetailDto })
  async createMeter(@Body() createDto: CreateUtilityMeterDto) {
    return this.iotService.createMeter(createDto);
  }

  @Patch('meters/:id')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Update utility meter' })
  @ApiResponse({ status: 200, description: 'Meter updated', type: UtilityMeterDetailDto })
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
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Record utility reading' })
  @ApiResponse({ status: 201, description: 'Reading recorded', type: UtilityReadingDto })
  async createReading(
    @Body() createDto: CreateUtilityReadingDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.iotService.createReading(createDto, currentUser);
  }

  @Get('meters/:meterId/readings')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'Get meter reading history' })
  @ApiQuery({ name: 'limit', required: false, example: 12 })
  @ApiResponse({ status: 200, description: 'Reading history', type: [UtilityReadingDto] })
  async getReadings(
    @Param('meterId', ParseUUIDPipe) meterId: string,
    @Query('limit') limit?: number,
  ) {
    return this.iotService.getReadings(meterId, limit);
  }

  @Patch('readings/:id/verify')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Verify utility reading' })
  @ApiResponse({ status: 200, description: 'Reading verified', type: UtilityReadingDto })
  async verifyReading(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.iotService.verifyReading(id, currentUser.sub);
  }
}

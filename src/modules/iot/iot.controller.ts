import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IoTService } from './iot.service';
import {
  CreateUtilityMeterDto,
  CreateUtilityReadingDto,
  CreateIoTBoardDeviceDto,
  CreateIoTBoardDto,
  DirectMqttControlDto,
  IoTBoardDeleteResultDto,
  IoTBoardDetailDto,
  IoTBoardListItemDto,
  IoTBoardUnlinkResultDto,
  IoTApartmentBoardsUnlinkResultDto,
  IoTGatewayStatusDto,
  IoTMqttCommandResultDto,
  IoTMqttSignalResultDto,
  IoTTestSequenceResponseDto,
  SetDoorPasswordDto,
  TestSequenceDto,
  UpdateUtilityMeterDto,
  UpdateIoTBoardDeviceDto,
  UpdateIoTBoardDto,
  UtilityMeterDetailDto,
  UtilityMeterListItemDto,
  UtilityReadingDto,
} from './dto';
import { ApiJsonResponse } from '../../common/dto';
import { CurrentUser, Public, Roles } from '../../common/decorators';
import { Role } from '../../common/enums/role.enum';
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

  @Post('devices/:espId/get-telemetry')
  @Public()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Request telemetry from MQTT board' })
  @ApiJsonResponse(IoTMqttSignalResultDto, {
    description: 'Telemetry request published to MQTT broker',
  })
  requestTelemetry(@Param('espId') espId: string) {
    return this.iotService.requestTelemetry(espId);
  }

  @Get('devices/:espId/check-health')
  @Public()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Send health check signal to MQTT board' })
  @ApiJsonResponse(IoTMqttSignalResultDto, {
    description: 'Health check signal published to MQTT broker',
  })
  checkHealth(@Param('espId') espId: string) {
    return this.iotService.checkHealth(espId);
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

  @Post('devices/:espId/:deviceId')
  @Public()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({
    summary: 'Publish a generic MQTT device command by topic and device id',
  })
  @ApiJsonResponse(IoTMqttCommandResultDto, {
    status: 201,
    description: 'Generic MQTT command published to MQTT broker',
  })
  controlDeviceByTopic(
    @Param('espId') espId: string,
    @Param('deviceId', ParseIntPipe) deviceId: number,
    @Body() body: DirectMqttControlDto,
  ) {
    return this.iotService.controlDeviceByTopic(
      espId,
      deviceId,
      body.topic,
      body.action,
    );
  }

  @Get('boards')
  @Public()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'List IoT boards with their child devices' })
  @ApiQuery({ name: 'apartmentId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: IoTStatus })
  @ApiJsonResponse(IoTBoardListItemDto, {
    isArray: true,
    description: 'List of MQTT boards with grouped devices',
  })
  async findAllBoards(
    @Query('apartmentId') apartmentId?: string,
    @Query('status') status?: IoTStatus,
  ) {
    return this.iotService.findAllBoards(apartmentId, status);
  }

  @Get('boards/:boardId')
  @Public()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Get IoT board details with grouped child devices' })
  @ApiJsonResponse(IoTBoardDetailDto, {
    description: 'Board details with child devices',
  })
  @ApiResponse({ status: 404, description: 'IoT board not found' })
  async findOneBoard(@Param('boardId') boardId: string) {
    return this.iotService.findOneBoard(boardId);
  }

  @Post('boards')
  @Public()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Create IoT board with child devices' })
  @ApiJsonResponse(IoTBoardDetailDto, {
    status: 201,
    description: 'Board created successfully',
  })
  async createBoard(@Body() createDto: CreateIoTBoardDto) {
    return this.iotService.createBoard(createDto);
  }

  @Patch('boards/:boardId')
  @Public()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Update IoT board metadata' })
  @ApiJsonResponse(IoTBoardDetailDto, {
    description: 'Board updated successfully',
  })
  async updateBoard(
    @Param('boardId') boardId: string,
    @Body() updateDto: UpdateIoTBoardDto,
  ) {
    return this.iotService.updateBoard(boardId, updateDto);
  }

  @Delete('boards/:boardId')
  @Public()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Deactivate IoT board and all its child devices' })
  @ApiJsonResponse(IoTBoardDeleteResultDto, {
    description: 'Board deactivated successfully',
  })
  async removeBoard(@Param('boardId') boardId: string) {
    return this.iotService.removeBoard(boardId);
  }

  @Patch('boards/:boardId/unlink-apartment')
  @Public()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Remove apartment link from a board and its child devices' })
  @ApiJsonResponse(IoTBoardUnlinkResultDto, {
    description: 'Board-to-apartment link removed successfully',
  })
  async unlinkBoardApartment(@Param('boardId') boardId: string) {
    return this.iotService.unlinkBoardApartment(boardId);
  }

  @Patch('boards/unlink-apartment-by-apartment/:apartmentId')
  @Public()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Remove apartment link from all boards currently assigned to an apartment' })
  @ApiJsonResponse(IoTApartmentBoardsUnlinkResultDto, {
    description: 'Apartment-to-boards links removed successfully',
  })
  async unlinkBoardsByApartment(
    @Param('apartmentId') apartmentId: string,
  ) {
    return this.iotService.unlinkBoardsByApartment(apartmentId);
  }

  @Post('boards/:boardId/devices')
  @Public()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Add a child device to an IoT board' })
  @ApiJsonResponse(IoTBoardDetailDto, {
    status: 201,
    description: 'Child device created successfully',
  })
  async createBoardDevice(
    @Param('boardId') boardId: string,
    @Body() createDto: CreateIoTBoardDeviceDto,
  ) {
    return this.iotService.createBoardDevice(boardId, createDto);
  }

  @Patch('boards/:boardId/devices/:deviceId')
  @Public()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Update an IoT board child device' })
  @ApiJsonResponse(IoTBoardDetailDto, {
    description: 'Child device updated successfully',
  })
  async updateBoardDevice(
    @Param('boardId') boardId: string,
    @Param('deviceId') deviceId: string,
    @Body() updateDto: UpdateIoTBoardDeviceDto,
  ) {
    return this.iotService.updateBoardDevice(boardId, deviceId, updateDto);
  }

  @Delete('boards/:boardId/devices/:deviceId')
  @Public()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Deactivate a child device from an IoT board' })
  @ApiJsonResponse(IoTBoardDetailDto, {
    description: 'Child device deactivated successfully',
  })
  async removeBoardDevice(
    @Param('boardId') boardId: string,
    @Param('deviceId') deviceId: string,
  ) {
    return this.iotService.removeBoardDevice(boardId, deviceId);
  }

  @Get('meters')
  @Public()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'List utility meters' })
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
  @ApiOperation({ summary: 'Get utility meter details' })
  @ApiJsonResponse(UtilityMeterDetailDto, {
    description: 'Utility meter details',
  })
  async findOneMeter(@Param('id') id: string) {
    return this.iotService.findOneMeter(id);
  }

  @Post('meters')
  @Public()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Create utility meter' })
  @ApiJsonResponse(UtilityMeterDetailDto, {
    status: 201,
    description: 'Utility meter created successfully',
  })
  async createMeter(@Body() createDto: CreateUtilityMeterDto) {
    return this.iotService.createMeter(createDto);
  }

  @Patch('meters/:id')
  @Public()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Update utility meter' })
  @ApiJsonResponse(UtilityMeterDetailDto, {
    description: 'Utility meter updated successfully',
  })
  async updateMeter(
    @Param('id') id: string,
    @Body() updateDto: UpdateUtilityMeterDto,
  ) {
    return this.iotService.updateMeter(id, updateDto);
  }

  @Post('readings')
  @Public()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Create utility meter reading' })
  @ApiJsonResponse(UtilityReadingDto, {
    status: 201,
    description: 'Utility reading created successfully',
  })
  async createReading(
    @Body() createDto: CreateUtilityReadingDto,
    @CurrentUser() currentUser?: any,
  ) {
    return this.iotService.createReading(createDto, currentUser);
  }

  @Get('meters/:meterId/readings')
  @Public()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'List readings of a utility meter' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiJsonResponse(UtilityReadingDto, {
    isArray: true,
    description: 'Utility meter readings',
  })
  async getReadings(
    @Param('meterId') meterId: string,
    @Query('limit') limit?: number,
  ) {
    return this.iotService.getReadings(meterId, limit);
  }

  @Patch('readings/:id/verify')
  @Public()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Verify utility reading' })
  @ApiJsonResponse(UtilityReadingDto, {
    description: 'Utility reading verified successfully',
  })
  async verifyReading(
    @Param('id') id: string,
    @CurrentUser() currentUser?: any,
  ) {
    return this.iotService.verifyReading(id, currentUser?.actorType === 'staff' ? currentUser.sub : undefined);
  }
}

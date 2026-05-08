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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { IoTService } from './iot.service';
import {
  CreateIoTBoardDeviceDto,
  CreateIoTBoardDto,
  CreateUtilityMeterDto,
  CreateUtilityReadingDto,
  CurrentUtilityRateQueryDto,
  DoorHistoryListDto,
  DoorHistoryQueryDto,
  DirectMqttControlDto,
  FakeFireAlertDto,
  IoTBoardDeleteResultDto,
  IoTBoardDeviceDeleteResultDto,
  IoTBoardDeviceControlResultDto,
  IoTBoardDetailDto,
  IoTBoardListItemDto,
  IoTBoardMetersDto,
  IoTBoardUnlinkResultDto,
  IoTHealthCheckResultDto,
  IoTApartmentBoardsUnlinkResultDto,
  IoTMqttSignalResultDto,
  UnlockDoorDto,
  ResetDoorPinDto,
  UpdateIoTBoardDeviceDto,
  UpdateIoTBoardDto,
  UpdateDoorPinDto,
  UpdateCurrentUtilityRateDto,
  UpdateGlobalUtilityRateDto,
  UpdateUtilityMeterDto,
  UtilityReadingListQueryDto,
} from './dto';
import { ApiJsonResponse } from '../../common/dto';
import { CurrentUser, Public, Roles } from '../../common/decorators';
import { Role } from '../../common/enums/role.enum';
import { IoTStatus, MeterStatus } from '@prisma/client';
import type { JwtPayload } from '../auth/auth.service';

@ApiTags('IoT')
@ApiBearerAuth('JWT-auth')
@Controller('iot')
export class IoTController {
  constructor(private readonly iotService: IoTService) {}

  @Post('test/fire-alert')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({
    summary:
      'Fake a FIRE MQTT status event to test resident push notifications',
  })
  async fakeFireAlert(@Body() body: FakeFireAlertDto) {
    return this.iotService.fakeFireAlert(body.espId, body.deviceId);
  }

  @Get('devices/:espId/check-health')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({
    summary: 'Check whether board is online (based on latest status seen)',
  })
  @ApiJsonResponse(IoTHealthCheckResultDto, {
    description: 'Returns current online/offline state for the board',
  })
  async checkHealth(@Param('espId') espId: string) {
    return this.iotService.checkHealth(espId);
  }

  @Post('devices/:espId/:deviceId')
  @Public()
  @ApiOperation({
    summary:
      'Control a board device directly by espId/topic/deviceId and wait for board acknowledgement',
  })
  @ApiJsonResponse(IoTBoardDeviceControlResultDto, {
    status: 201,
    description:
      'Returns success only when the board responds with the expected state for this device',
  })
  async controlDeviceByTopic(
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
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
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
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'Get IoT board details with grouped child devices' })
  @ApiJsonResponse(IoTBoardDetailDto, {
    description: 'Board details with child devices',
  })
  @ApiResponse({ status: 404, description: 'IoT board not found' })
  async findOneBoard(@Param('boardId') boardId: string) {
    return this.iotService.findOneBoard(boardId);
  }

  @Get('meter')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({
    summary:
      'Get utility meters separated from board devices (electric and water)',
  })
  @ApiQuery({ name: 'boardId', required: false })
  @ApiQuery({ name: 'apartmentId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: MeterStatus })
  @ApiJsonResponse(IoTBoardMetersDto, {
    description:
      'Returns electric/water utility meters for the given apartment or board',
  })
  async findUtilityMeters(
    @Query('boardId') boardId?: string,
    @Query('apartmentId') apartmentId?: string,
    @Query('status') status?: MeterStatus,
  ) {
    return this.iotService.findUtilityMeters(boardId, apartmentId, status);
  }

  @Get('utility-rates/global')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({
    summary: 'Get global default electricity/water rates for new meters',
  })
  async getGlobalUtilityRates() {
    return this.iotService.getGlobalUtilityRates();
  }

  @Patch('utility-rates/global')
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({
    summary:
      'Update global default electricity/water rates used when creating new meters',
  })
  async updateGlobalUtilityRates(@Body() body: UpdateGlobalUtilityRateDto) {
    return this.iotService.updateGlobalUtilityRates(body);
  }

  @Get('utility-rates/current')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({
    summary: 'Get current flat electricity/water rates for an apartment',
  })
  async getCurrentUtilityRates(@Query() query: CurrentUtilityRateQueryDto) {
    return this.iotService.getCurrentUtilityRates(query.apartmentId);
  }

  @Patch('utility-rates/current')
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({
    summary: 'Update current flat electricity/water rates for an apartment',
  })
  async updateCurrentUtilityRates(@Body() body: UpdateCurrentUtilityRateDto) {
    return this.iotService.updateCurrentUtilityRates(body);
  }

  @Get('meters')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'List utility meters' })
  @ApiQuery({ name: 'apartmentId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: MeterStatus })
  async findAllMeters(
    @Query('apartmentId') apartmentId?: string,
    @Query('status') status?: MeterStatus,
  ) {
    return this.iotService.findAllMeters(apartmentId, status);
  }

  @Get('meters/:id/readings')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'List utility meter readings' })
  async getMeterReadings(
    @Param('id') id: string,
    @Query() query: UtilityReadingListQueryDto,
  ) {
    return this.iotService.getReadings(id, query.limit ?? 12);
  }

  @Get('meters/:id')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'Get utility meter detail' })
  async findOneMeter(@Param('id') id: string) {
    return this.iotService.findOneMeter(id);
  }

  @Post('meters')
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Create utility meter' })
  async createMeter(@Body() body: CreateUtilityMeterDto) {
    return this.iotService.createMeter(body);
  }

  @Patch('meters/:id')
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Update utility meter' })
  async updateMeter(
    @Param('id') id: string,
    @Body() body: UpdateUtilityMeterDto,
  ) {
    return this.iotService.updateMeter(id, body);
  }

  @Post('readings')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Create utility meter reading' })
  async createReading(
    @Body() body: CreateUtilityReadingDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.iotService.createReading(body, currentUser);
  }

  @Patch('readings/:id/verify')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Verify utility meter reading' })
  async verifyReading(
    @Param('id') id: string,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.iotService.verifyReading(
      id,
      currentUser.actorType === 'staff' ? currentUser.sub : undefined,
    );
  }

  @Post('boards')
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
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Deactivate IoT board and all its child devices' })
  @ApiJsonResponse(IoTBoardDeleteResultDto, {
    description: 'Board deactivated successfully',
  })
  async removeBoard(@Param('boardId') boardId: string) {
    return this.iotService.removeBoard(boardId);
  }

  @Patch('boards/:boardId/unlink-apartment')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({
    summary: 'Remove apartment link from a board and its child devices',
  })
  @ApiJsonResponse(IoTBoardUnlinkResultDto, {
    description: 'Board-to-apartment link removed successfully',
  })
  async unlinkBoardApartment(@Param('boardId') boardId: string) {
    return this.iotService.unlinkBoardApartment(boardId);
  }

  @Patch('boards/unlink-apartment-by-apartment/:apartmentId')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({
    summary:
      'Remove apartment link from all boards currently assigned to an apartment',
  })
  @ApiJsonResponse(IoTApartmentBoardsUnlinkResultDto, {
    description: 'Apartment-to-boards links removed successfully',
  })
  async unlinkBoardsByApartment(@Param('apartmentId') apartmentId: string) {
    return this.iotService.unlinkBoardsByApartment(apartmentId);
  }

  @Post('boards/:boardId/devices')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({
    summary:
      'Add a child device to an IoT board (topics: light, alarm, door, curtain)',
  })
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

  @Post('doors/:boardId/:deviceId/unlock')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.USER, Role.STAFF, Role.OPERATOR, Role.ADMIN)
  @ApiOperation({
    summary:
      'Unlock smart door with a 6-digit PIN and wait for board acknowledgement',
  })
  @ApiJsonResponse(IoTBoardDeviceControlResultDto, {
    status: 201,
    description:
      'Returns success only when the board confirms the door unlock action',
  })
  async unlockDoor(
    @Param('boardId') boardId: string,
    @Param('deviceId', ParseIntPipe) deviceId: number,
    @Body() body: UnlockDoorDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.iotService.unlockDoor(boardId, deviceId, body.pin, currentUser);
  }

  @Get('doors/history')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.USER, Role.STAFF, Role.OPERATOR, Role.ADMIN)
  @ApiOperation({
    summary: 'List door open and close history',
  })
  @ApiJsonResponse(DoorHistoryListDto, {
    description:
      'Door open and close history derived from MQTT board state updates',
  })
  async findDoorHistory(
    @Query() query: DoorHistoryQueryDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.iotService.findDoorHistory(query, currentUser);
  }

  @Patch('doors/:boardId/:deviceId/pin')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.USER, Role.STAFF, Role.OPERATOR)
  @ApiOperation({
    summary:
      'Update smart door PIN for tenant flow with board acknowledgement; old PIN is only required after the first setup',
  })
  @ApiJsonResponse(IoTBoardDeviceControlResultDto, {
    description: 'Returns success only when the board confirms the PIN update',
  })
  async updateDoorPin(
    @Param('boardId') boardId: string,
    @Param('deviceId', ParseIntPipe) deviceId: number,
    @Body() body: UpdateDoorPinDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.iotService.updateDoorPin(
      boardId,
      deviceId,
      body.oldPin,
      body.newPin,
      currentUser,
    );
  }

  @Patch('doors/:boardId/:deviceId/pin/reset')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.STAFF, Role.OPERATOR, Role.ADMIN)
  @ApiOperation({
    summary:
      'Reset smart door PIN by staff/operator/admin and wait for board acknowledgement',
  })
  @ApiJsonResponse(IoTBoardDeviceControlResultDto, {
    description: 'Returns success only when the board confirms the PIN reset',
  })
  async resetDoorPin(
    @Param('boardId') boardId: string,
    @Param('deviceId', ParseIntPipe) deviceId: number,
    @Body() body: ResetDoorPinDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.iotService.resetDoorPin(
      boardId,
      deviceId,
      body.newPin,
      currentUser,
    );
  }

  @Patch('boards/:boardId/devices/:deviceId')
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
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Deactivate a child device from an IoT board' })
  @ApiJsonResponse(IoTBoardDeviceDeleteResultDto, {
    description: 'Child device deactivated successfully',
  })
  async removeBoardDevice(
    @Param('boardId') boardId: string,
    @Param('deviceId') deviceId: string,
  ) {
    return this.iotService.removeBoardDevice(boardId, deviceId);
  }
}

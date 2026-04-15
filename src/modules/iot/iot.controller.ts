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
  CreateIoTBoardDeviceDto,
  CreateIoTBoardDto,
  DirectMqttControlDto,
  IoTBoardDeleteResultDto,
  IoTBoardDeviceDeleteResultDto,
  IoTBoardDetailDto,
  IoTBoardListItemDto,
  IoTBoardMetersDto,
  IoTBoardUnlinkResultDto,
  IoTApartmentBoardsUnlinkResultDto,
  IoTMqttCommandResultDto,
  IoTMqttSignalResultDto,
  UpdateIoTBoardDeviceDto,
  UpdateIoTBoardDto,
} from './dto';
import { ApiJsonResponse } from '../../common/dto';
import { Public, Roles } from '../../common/decorators';
import { Role } from '../../common/enums/role.enum';
import { IoTStatus, MeterStatus } from '@prisma/client';

@ApiTags('IoT')
@Controller('iot')
export class IoTController {
  constructor(private readonly iotService: IoTService) {}

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

  @Get('meter')
  @Public()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
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

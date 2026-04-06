import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IoTService } from './iot.service';
import {
  DirectMqttControlDto,
  IoTGatewayStatusDto,
  IoTMqttCommandResultDto,
  IoTMqttSignalResultDto,
  IoTTestSequenceResponseDto,
  SetDoorPasswordDto,
  TestSequenceDto,
} from './dto';
import { ApiJsonResponse } from '../../common/dto';
import { Public, Roles } from '../../common/decorators';
import { Role } from '../../common/enums/role.enum';

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

}

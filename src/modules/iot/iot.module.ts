import { Module } from '@nestjs/common';
import { IoTController } from './iot.controller';
import { IoTService } from './iot.service';
import { IoTMqttService } from './iot-mqtt.service';

@Module({
  controllers: [IoTController],
  providers: [IoTService, IoTMqttService],
  exports: [IoTService, IoTMqttService],
})
export class IoTModule {}

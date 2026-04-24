import { Module } from '@nestjs/common';
import { IoTController } from './iot.controller';
import { IoTService } from './iot.service';
import { IoTMqttService } from './iot-mqtt.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [IoTController],
  providers: [IoTService, IoTMqttService],
  exports: [IoTService, IoTMqttService],
})
export class IoTModule {}

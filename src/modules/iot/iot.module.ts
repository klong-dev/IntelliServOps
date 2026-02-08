import { Module } from '@nestjs/common';
import { IoTController } from './iot.controller';
import { IoTService } from './iot.service';

@Module({
  controllers: [IoTController],
  providers: [IoTService],
  exports: [IoTService],
})
export class IoTModule {}

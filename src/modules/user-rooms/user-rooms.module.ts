import { Module } from '@nestjs/common';
import { UserRoomsController } from './user-rooms.controller';
import { UserRoomsService } from './user-rooms.service';

@Module({
  controllers: [UserRoomsController],
  providers: [UserRoomsService],
  exports: [UserRoomsService],
})
export class UserRoomsModule {}

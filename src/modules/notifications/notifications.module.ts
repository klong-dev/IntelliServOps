import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { FirebaseService } from './firebase.service';
import { NotificationTriggers } from './notification-triggers';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, FirebaseService, NotificationTriggers],
  exports: [NotificationsService, FirebaseService],
})
export class NotificationsModule {}

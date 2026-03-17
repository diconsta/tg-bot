import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TelegramUpdateHandler } from './telegram-update.handler';
import { TelegramAdminCommandsHandler } from './telegram-admin-commands.handler';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { ObjectsModule } from '../objects/objects.module';
import { StagesModule } from '../stages/stages.module';
import { PhotosModule } from '../photos/photos.module';
import { HistoryModule } from '../history/history.module';
import { CoordinatorsModule } from '../coordinators/coordinators.module';
import { StorageModule } from '../storage/storage.module';
import { SessionsModule } from '../sessions/sessions.module';

@Module({
  imports: [
    ObjectsModule,
    StagesModule,
    PhotosModule,
    HistoryModule,
    CoordinatorsModule,
    StorageModule,
    SessionsModule,
  ],
  controllers: [TelegramWebhookController],
  providers: [
    TelegramService,
    TelegramUpdateHandler,
    TelegramAdminCommandsHandler,
  ],
  exports: [TelegramService],
})
export class TelegramModule {}

import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DailyReminderJob } from './daily-reminder.job';
import { StalledStageAlertJob } from './stalled-stage-alert.job';
import { ObjectsModule } from '../objects/objects.module';
import { StagesModule } from '../stages/stages.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ObjectsModule,
    StagesModule,
    TelegramModule,
  ],
  providers: [DailyReminderJob, StalledStageAlertJob],
})
export class SchedulerModule {}

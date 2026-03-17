import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { ConfigService } from '@nestjs/config';
import { ObjectsService } from '../objects/objects.service';
import { StagesService } from '../stages/stages.service';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class DailyReminderJob implements OnModuleInit {
  private readonly logger = new Logger(DailyReminderJob.name);

  constructor(
    private objectsService: ObjectsService,
    private stagesService: StagesService,
    private telegramService: TelegramService,
    private configService: ConfigService,
    private schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit() {
    const reminderTime = this.configService.get<string>('app.scheduler.reminderTime');
    const timezone = this.configService.get<string>('app.scheduler.reminderTimezone');

    // Parse time format HH:MM
    const [hours, minutes] = reminderTime.split(':').map(num => parseInt(num, 10));

    // Create cron expression: minute hour * * *
    const cronExpression = `${minutes} ${hours} * * *`;

    this.logger.log(`Scheduling daily reminder at ${reminderTime} (${timezone}) - cron: ${cronExpression}`);

    const job = new CronJob(
      cronExpression,
      () => this.sendDailyReminders(),
      null,
      true,
      timezone,
    );

    this.schedulerRegistry.addCronJob('dailyReminder', job);
    job.start();

    this.logger.log('Daily reminder job registered and started');
  }

  async sendDailyReminders() {
    this.logger.log('Starting daily reminder job...');

    try {
      const objects = await this.objectsService.findObjectsForReminder();

      this.logger.log(`Found ${objects.length} objects to send reminders to`);

      for (const object of objects) {
        try {
          if (!object.currentStage) {
            this.logger.warn(`Object ${object.id} has no current stage, skipping`);
            continue;
          }

          const message = this.formatReminderMessage(
            object.name,
            object.currentStage.stageIndex,
            object.currentStage.stageName,
          );

          const keyboard = this.telegramService.createStageActionButtons();

          await this.telegramService.sendMessageToThread(
            object.telegramChatId,
            object.telegramThreadId,
            message,
            keyboard,
          );

          await this.objectsService.updateLastPromptAt(object.id);

          this.logger.log(`Sent reminder to object: ${object.name} (ID: ${object.id})`);
        } catch (error) {
          this.logger.error(
            `Failed to send reminder to object ${object.id}: ${error.message}`,
          );
        }
      }

      this.logger.log('Daily reminder job completed');
    } catch (error) {
      this.logger.error(`Daily reminder job failed: ${error.message}`, error.stack);
    }
  }

  private formatReminderMessage(
    objectName: string,
    stageNumber: number,
    stageName: string,
  ): string {
    return `📅 <b>Dzienne przypomnienie</b>\n\nObiekt: <b>${objectName}</b>\nAktualny etap: <b>${stageNumber} — ${stageName}</b>\n\nNie zapomnij przesłać zdjęć i zakończyć etap!`;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { ObjectsService } from '../objects/objects.service';
import { StagesService } from '../stages/stages.service';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class StalledStageAlertJob {
  private readonly logger = new Logger(StalledStageAlertJob.name);
  private readonly stalledDays: number;

  constructor(
    private objectsService: ObjectsService,
    private stagesService: StagesService,
    private telegramService: TelegramService,
    private configService: ConfigService,
  ) {
    this.stalledDays = this.configService.get<number>(
      'app.scheduler.stalledStageDays',
    );
  }

  @Cron(CronExpression.EVERY_DAY_AT_10AM, {
    timeZone: 'Europe/Warsaw',
  })
  async sendStalledStageAlerts() {
    this.logger.log('Starting stalled stage alert job...');

    try {
      const stalledObjects = await this.objectsService.findStalledStages(
        this.stalledDays,
      );

      this.logger.log(
        `Found ${stalledObjects.length} objects with stalled stages (>${this.stalledDays} days)`,
      );

      for (const object of stalledObjects) {
        try {
          if (!object.currentStage) {
            this.logger.warn(`Object ${object.id} has no current stage, skipping`);
            continue;
          }

          const message = this.formatStalledMessage(
            object.name,
            object.currentStage.stageIndex,
            object.currentStage.stageName,
            this.stalledDays,
          );

          const keyboard = this.telegramService.createStageActionButtons();

          await this.telegramService.sendMessageToThread(
            object.telegramChatId,
            object.telegramThreadId,
            message,
            keyboard,
          );

          this.logger.log(
            `Sent stalled stage alert to object: ${object.name} (ID: ${object.id})`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to send stalled alert to object ${object.id}: ${error.message}`,
          );
        }
      }

      this.logger.log('Stalled stage alert job completed');
    } catch (error) {
      this.logger.error(
        `Stalled stage alert job failed: ${error.message}`,
        error.stack,
      );
    }
  }

  private formatStalledMessage(
    objectName: string,
    stageNumber: number,
    stageName: string,
    days: number,
  ): string {
    return `⚠️ <b>OSTRZEŻENIE: ZABLOKOWANY ETAP</b>\n\nObiekt: <b>${objectName}</b>\nEtap: <b>${stageNumber} — ${stageName}</b>\n\n⏰ Ten etap nie został zakończony od <b>${days} dni</b>.\n\nPodejmij działania, aby posunąć projekt do przodu!`;
  }
}

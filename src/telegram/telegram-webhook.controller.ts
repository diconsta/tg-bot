import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { TelegramUpdateHandler } from './telegram-update.handler';
import TelegramBot from 'node-telegram-bot-api';

@Controller('webhook')
export class TelegramWebhookController {
  constructor(private readonly updateHandler: TelegramUpdateHandler) {}

  @Post('telegram')
  @HttpCode(200)
  async handleUpdate(@Body() update: TelegramBot.Update): Promise<void> {
    await this.updateHandler.handleUpdate(update);
  }
}

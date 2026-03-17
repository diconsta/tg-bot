import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import TelegramBot from 'node-telegram-bot-api';

@Controller('webhook')
export class TelegramWebhookController {
  constructor(private readonly telegramService: TelegramService) {}

  @Post('telegram')
  @HttpCode(200)
  handleUpdate(@Body() update: TelegramBot.Update): void {
    this.telegramService.processUpdate(update);
  }
}

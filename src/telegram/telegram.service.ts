import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import TelegramBot from 'node-telegram-bot-api';
import * as https from 'https';

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);
  private bot: TelegramBot;
  private botToken: string;
  private webhookUrl: string;

  constructor(private configService: ConfigService) {
    this.botToken = this.configService.get<string>('app.telegram.botToken');
    this.webhookUrl = this.configService.get<string>('app.telegram.webhookUrl');

    if (!this.botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN is not configured');
    }
  }

  async onModuleInit() {
    // Initialize bot without polling — updates come via webhook
    this.bot = new TelegramBot(this.botToken, { polling: false });

    if (this.webhookUrl) {
      const fullWebhookUrl = `${this.webhookUrl}/webhook/telegram`;
      await this.bot.setWebHook(fullWebhookUrl);
      this.logger.log(`Telegram webhook registered: ${fullWebhookUrl}`);
    } else {
      this.logger.warn('TELEGRAM_WEBHOOK_URL not set — webhook not registered');
    }

    this.logger.log('Telegram bot initialized (webhook mode)');
  }


  getBot(): TelegramBot {
    return this.bot;
  }

  async sendMessage(
    chatId: string,
    text: string,
    options?: TelegramBot.SendMessageOptions,
  ): Promise<TelegramBot.Message> {
    try {
      return await this.bot.sendMessage(chatId, text, options);
    } catch (error) {
      this.logger.error(`Failed to send message to ${chatId}: ${error.message}`);
      throw error;
    }
  }

  async sendMessageToThread(
    chatId: string,
    threadId: string,
    text: string,
    replyMarkup?: TelegramBot.InlineKeyboardMarkup,
  ): Promise<TelegramBot.Message> {
    const options: TelegramBot.SendMessageOptions = {
      message_thread_id: parseInt(threadId, 10),
      parse_mode: 'HTML',
    };

    if (replyMarkup) {
      options.reply_markup = replyMarkup;
    }

    try {
      return await this.sendMessage(chatId, text, options);
    } catch (error) {
      // Handle thread not found gracefully
      if (error.message.includes('message thread not found')) {
        this.logger.warn(`Thread ${threadId} not found - topic may have been deleted`);
        throw error; // Re-throw so caller can handle it
      }
      throw error;
    }
  }

  async editMessageReplyMarkup(
    chatId: string,
    messageId: number,
    replyMarkup?: TelegramBot.InlineKeyboardMarkup,
  ): Promise<TelegramBot.Message | boolean> {
    try {
      return await this.bot.editMessageReplyMarkup(replyMarkup, {
        chat_id: chatId,
        message_id: messageId,
      });
    } catch (error) {
      this.logger.error(`Failed to edit message markup: ${error.message}`);
      throw error;
    }
  }

  async answerCallbackQuery(
    callbackQueryId: string,
    text?: string,
  ): Promise<boolean> {
    try {
      return await this.bot.answerCallbackQuery(callbackQueryId, { text });
    } catch (error) {
      this.logger.error(`Failed to answer callback query: ${error.message}`);
      throw error;
    }
  }

  async downloadPhoto(fileId: string): Promise<Buffer> {
    try {
      const fileLink = await this.bot.getFileLink(fileId);

      return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];

        https
          .get(fileLink, (response) => {
            response.on('data', (chunk) => chunks.push(chunk));
            response.on('end', () => resolve(Buffer.concat(chunks)));
            response.on('error', reject);
          })
          .on('error', reject);
      });
    } catch (error) {
      this.logger.error(`Failed to download photo ${fileId}: ${error.message}`);
      throw error;
    }
  }

  createInlineKeyboard(
    buttons: TelegramBot.InlineKeyboardButton[][],
  ): TelegramBot.InlineKeyboardMarkup {
    return {
      inline_keyboard: buttons,
    };
  }

  createStageActionButtons(): TelegramBot.InlineKeyboardMarkup {
    return this.createInlineKeyboard([
      [
        {
          text: '📷 Dodaj zdjęcia etapu',
          callback_data: 'action:add_photos',
        },
        {
          text: '📸 Zobacz zdjęcia',
          callback_data: 'action:view_photos',
        },
      ],
      [
        {
          text: '✅ Zakończ etap',
          callback_data: 'action:complete_stage',
        },
      ],
      [
        {
          text: '📊 Generuj raport',
          callback_data: 'action:generate_report',
        },
      ],
      [
        {
          text: '⏸ Wstrzymaj',
          callback_data: 'action:pause',
        },
      ],
    ]);
  }

  createPausedActionButtons(): TelegramBot.InlineKeyboardMarkup {
    return this.createInlineKeyboard([
      [
        {
          text: '▶️ Wznów',
          callback_data: 'action:resume',
        },
      ],
    ]);
  }

  async sendProcessingMessage(
    chatId: string,
    threadId: string,
    text: string = '⏳ Processing...',
  ): Promise<TelegramBot.Message> {
    return this.sendMessageToThread(chatId, threadId, text);
  }

  async deleteMessage(chatId: string, messageId: number): Promise<boolean> {
    try {
      await this.bot.deleteMessage(chatId, messageId);
      return true;
    } catch (error) {
      this.logger.warn(`Failed to delete message ${messageId}: ${error.message}`);
      return false;
    }
  }
}

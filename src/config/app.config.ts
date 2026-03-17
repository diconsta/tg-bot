import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    webhookUrl: process.env.TELEGRAM_WEBHOOK_URL,
    coordinatorChatId: process.env.TELEGRAM_COORDINATOR_CHAT_ID,
    superadminIds: process.env.TELEGRAM_SUPERADMIN_IDS?.split(',').map(id => id.trim()) || [],
  },

  scheduler: {
    reminderTime: process.env.REMINDER_TIME || '16:00',
    reminderTimezone: process.env.REMINDER_TIMEZONE || 'Europe/Warsaw',
    stalledStageDays: parseInt(process.env.STALLED_STAGE_DAYS, 10) || 7,
  },

  photos: {
    minPhotosPerStage: parseInt(process.env.MIN_PHOTOS_PER_STAGE, 10) || 3,
    maxPhotosPerStage: parseInt(process.env.MAX_PHOTOS_PER_STAGE, 10) || 20,
  },

  googleDrive: {
    serviceAccountPath: process.env.GOOGLE_SERVICE_ACCOUNT_PATH,
    sharedDriveId: process.env.GOOGLE_SHARED_DRIVE_ID,
  },
}));

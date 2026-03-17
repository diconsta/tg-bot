# Telegram Construction Stage Tracking Bot

A production-grade Telegram bot backend for tracking construction/repair objects through multiple stages. Built with NestJS, TypeScript, TypeORM, and PostgreSQL.

## Features

- **Automatic Object Creation**: Creates objects when new forum topics are created in Telegram
- **Stage Management**: Track progress through configurable construction stages
- **Photo Management**: Upload 3-10 photos per stage with Google Drive integration
- **Album Support**: Handles both single photos and photo albums (media groups)
- **Daily Reminders**: Automated reminders at 4 PM (Europe/Warsaw timezone)
- **Stalled Stage Alerts**: Warnings for stages not completed within 7 days
- **Pause/Resume**: Temporarily pause object tracking
- **History Tracking**: Complete audit trail of all actions
- **Interactive Buttons**: Telegram inline keyboard for easy interaction

## Tech Stack

- **Node.js** & **TypeScript**
- **NestJS** - Framework
- **TypeORM** - ORM
- **PostgreSQL** - Database
- **Telegram Bot API** - Bot interface
- **Google Drive API** - Photo storage
- **node-telegram-bot-api** - Telegram client
- **@nestjs/schedule** - Cron jobs

## Project Structure

```
src/
├── common/
│   └── enums/                  # Shared enums (ObjectStatus, HistoryAction)
├── config/
│   ├── app.config.ts           # Application configuration
│   └── database.config.ts      # Database configuration
├── database/
│   ├── data-source.ts          # TypeORM data source
│   └── migrations/             # Database migrations
├── google-drive/
│   ├── google-drive.service.ts # Google Drive integration
│   └── google-drive.module.ts
├── history/
│   ├── entities/
│   │   └── stage-history.entity.ts
│   ├── dto/
│   │   └── create-history.dto.ts
│   ├── history.service.ts
│   └── history.module.ts
├── objects/
│   ├── entities/
│   │   └── object.entity.ts
│   ├── dto/
│   │   └── create-object.dto.ts
│   ├── objects.service.ts
│   └── objects.module.ts
├── photos/
│   ├── entities/
│   │   └── stage-photo.entity.ts
│   ├── photos.service.ts
│   └── photos.module.ts
├── scheduler/
│   ├── daily-reminder.job.ts      # 4 PM daily reminders
│   ├── stalled-stage-alert.job.ts # Stalled stage warnings
│   └── scheduler.module.ts
├── stages/
│   ├── entities/
│   │   └── stage.entity.ts
│   ├── stages.service.ts
│   └── stages.module.ts
├── telegram/
│   ├── interfaces/
│   │   └── user-session.interface.ts
│   ├── telegram.service.ts         # Telegram API wrapper
│   ├── telegram-update.handler.ts  # Message & callback handlers
│   └── telegram.module.ts
├── app.module.ts
└── main.ts
```

## Database Schema

### Objects Table
- `id` (UUID, PK)
- `telegramChatId` - Telegram group chat ID
- `telegramThreadId` - Forum topic thread ID
- `name` - Object name (from topic name)
- `currentStage` - Current stage number
- `paused` - Pause status
- `status` - ACTIVE | DONE | ARCHIVED
- `lastPromptAt` - Last reminder timestamp
- `createdAt`, `updatedAt`

### Stages Table
- `id` (UUID, PK)
- `objectId` (FK)
- `stageNumber` - Stage number (1-5)
- `stageName` - Stage name
- `isCompleted` - Completion status
- `completedAt` - Completion timestamp
- `createdAt`

### Stage Photos Table
- `id` (UUID, PK)
- `objectId` (FK)
- `stageNumber` - Associated stage
- `driveFileId` - Google Drive file ID
- `driveUrl` - Public URL
- `createdAt`

### Stage History Table
- `id` (UUID, PK)
- `objectId` (FK)
- `stageNumber` - Stage at time of action
- `action` - PHOTO_ADDED | STAGE_COMPLETED | PAUSED | RESUMED
- `telegramUserId` - User who performed action
- `username` - Telegram username
- `createdAt`

## Installation

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Telegram Bot Token
- Google Service Account with Drive API enabled

### Setup

1. **Clone and install dependencies:**

```bash
npm install
```

2. **Configure environment variables:**

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required variables:
- `TELEGRAM_BOT_TOKEN` - Get from @BotFather
- `TELEGRAM_COORDINATOR_CHAT_ID` - Your forum group chat ID
- `DB_*` - PostgreSQL credentials
- `GOOGLE_CLIENT_EMAIL` - Service account email
- `GOOGLE_PRIVATE_KEY` - Service account private key
- `GOOGLE_DRIVE_FOLDER_ID` - Root folder ID for uploads

3. **Set up PostgreSQL database:**

```bash
createdb tg_building_bot
```

4. **Run migrations:**

```bash
npm run migration:run
```

5. **Start the application:**

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

## Usage

### 1. Set up Telegram Group

1. Create a Telegram group
2. Enable forum topics (Topics) in group settings
3. Add your bot to the group
4. Give the bot admin permissions

### 2. Create an Object

Simply create a new forum topic in the group. The bot will automatically:
- Create an `ObjectEntity` in the database
- Create all stages (1-5)
- Set up Google Drive folder structure
- Send a welcome message with action buttons

### 3. Manage Stages

Use the inline keyboard buttons:

**📷 Add stage photos**
- Click to enter photo upload mode
- Send 3-10 photos (can be album or individual)
- Bot confirms upload and shows photo count

**✅ Complete stage**
- Validates minimum 3 photos uploaded
- Marks current stage as complete
- Progresses to next stage
- Creates history record

**⏸ Pause / ▶️ Resume**
- Pause to stop daily reminders
- Resume to restart tracking

### 4. Daily Reminders

At 16:00 Europe/Warsaw, the bot sends reminders to all active, non-paused objects:

```
📅 Daily Reminder

Object: Green City Apartment
Current stage: 2 — Rough construction

Don't forget to upload photos and complete the stage!
```

### 5. Stalled Stage Alerts

At 10:00 AM daily, the bot checks for stages not completed in 7+ days:

```
⚠️ STALLED STAGE WARNING

Object: Green City Apartment
Stage: 2 — Rough construction

⏰ This stage has not been completed for 7 days.

Please take action to move this project forward!
```

## Configuration

### Stage Names

Configure in `.env`:

```env
STAGE_NAMES=Preparation,Rough construction,Engineering,Finishing,Final check
```

### Photo Limits

```env
MIN_PHOTOS_PER_STAGE=3
MAX_PHOTOS_PER_STAGE=10
```

### Scheduler Settings

```env
REMINDER_TIME=16:00
REMINDER_TIMEZONE=Europe/Warsaw
STALLED_STAGE_DAYS=7
```

## Google Drive Setup

### 1. Create Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable Google Drive API
4. Create a Service Account
5. Generate JSON key
6. Extract `client_email` and `private_key`

### 2. Share Drive Folder

1. Create a folder in Google Drive
2. Share it with the service account email
3. Give "Editor" permissions
4. Copy the folder ID from URL

### Folder Structure

The bot creates:

```
Your Root Folder/
├── Object Name 1/
│   ├── Stage_1_Preparation/
│   ├── Stage_2_Rough construction/
│   ├── Stage_3_Engineering/
│   ├── Stage_4_Finishing/
│   └── Stage_5_Final check/
└── Object Name 2/
    └── ...
```

## API Endpoints

This bot uses Telegram's polling mechanism. No HTTP webhooks are required.

However, the NestJS server runs on port 3000 for health checks:

```bash
curl http://localhost:3000
```

## Development

### Build

```bash
npm run build
```

### Run Tests

```bash
npm run test
npm run test:watch
npm run test:cov
```

### Linting

```bash
npm run lint
npm run format
```

### Migrations

```bash
# Generate new migration
npm run migration:generate -- src/database/migrations/MigrationName

# Run migrations
npm run migration:run

# Revert last migration
npm run migration:revert
```

## Troubleshooting

### Bot not responding

- Check `TELEGRAM_BOT_TOKEN` is correct
- Verify bot has admin permissions in group
- Check logs: `npm run start:dev`

### Photos not uploading

- Verify Google Service Account credentials
- Check Drive folder is shared with service account
- Ensure Drive API is enabled in Google Cloud Console

### Database connection issues

- Verify PostgreSQL is running
- Check `DB_*` credentials in `.env`
- Ensure database exists: `createdb tg_building_bot`

### Reminders not working

- Check timezone configuration: `REMINDER_TIMEZONE`
- Verify scheduler module is imported
- Check logs for cron job execution

## Production Deployment

### Environment Variables

Ensure all production values are set:

```env
NODE_ENV=production
```

### Database

Use connection pooling and set proper limits:

```env
DB_HOST=your-db-host
DB_PORT=5432
DB_USERNAME=production_user
DB_PASSWORD=strong_password
DB_DATABASE=tg_building_bot_prod
```

### Process Management

Use PM2 or similar:

```bash
npm install -g pm2
pm2 start dist/main.js --name tg-building-bot
pm2 save
pm2 startup
```

### Security

- Never commit `.env` file
- Rotate Google Service Account keys regularly
- Use read-only database user for queries
- Enable PostgreSQL SSL connections
- Set up database backups

## License

UNLICENSED - Private project

---

Built with NestJS and TypeScript

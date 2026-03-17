# Quick Start Guide

This guide will help you get the Telegram Construction Bot up and running quickly.

## Prerequisites Checklist

- [ ] Node.js 18+ installed
- [ ] PostgreSQL 14+ installed and running
- [ ] Telegram bot created via @BotFather
- [ ] Google Cloud project with Drive API enabled
- [ ] Google Service Account created with JSON key

## Step-by-Step Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Create PostgreSQL Database

```bash
# Using psql
createdb tg_building_bot

# Or via SQL
psql -U postgres
CREATE DATABASE tg_building_bot;
\q
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
# Database - Update with your credentials
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_DATABASE=tg_building_bot

# Telegram Bot - Get from @BotFather
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11

# Get this after adding bot to group
TELEGRAM_COORDINATOR_CHAT_ID=-1001234567890

# Google Drive - From service account JSON
GOOGLE_CLIENT_EMAIL=your-bot@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_DRIVE_FOLDER_ID=1AbCdEfGhIjKlMnOpQrStUvWxYz
```

### 4. Run Database Migrations

```bash
npm run migration:run
```

### 5. Start the Bot

```bash
# Development mode with hot reload
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

You should see:

```
[Bootstrap] Application is running on: http://localhost:3000
[Bootstrap] Telegram bot is active and listening for updates
[TelegramService] Telegram bot initialized with polling
```

## Setting Up Telegram Group

### 1. Create Group

1. Open Telegram
2. Create a new group
3. Give it a name (e.g., "Construction Projects")

### 2. Enable Forum Topics

1. Go to Group Settings
2. Enable "Topics" (this makes it a forum group)

### 3. Add Your Bot

1. Add your bot to the group as a member
2. Promote bot to administrator
3. Give bot permissions:
   - Delete messages
   - Manage topics
   - Send messages

### 4. Get Chat ID

There are two ways:

**Method 1: Using API**

```bash
# Send a message in your group mentioning the bot
# Then run:
curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates

# Look for "chat":{"id":-1001234567890} in the response
```

**Method 2: Using Bot**

```bash
# Add this bot to your group: @userinfobot
# It will show the chat ID
```

Update `.env` with the chat ID:

```env
TELEGRAM_COORDINATOR_CHAT_ID=-1001234567890
```

Restart the bot after updating.

## Setting Up Google Drive

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project or select existing
3. Name it (e.g., "Construction Bot")

### 2. Enable Drive API

1. Go to "APIs & Services" > "Library"
2. Search for "Google Drive API"
3. Click "Enable"

### 3. Create Service Account

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "Service Account"
3. Name it (e.g., "construction-bot")
4. Click "Create and Continue"
5. Skip optional steps
6. Click "Done"

### 4. Generate Key

1. Click on the service account you just created
2. Go to "Keys" tab
3. Click "Add Key" > "Create new key"
4. Choose "JSON"
5. Download the JSON file

### 5. Extract Credentials

Open the downloaded JSON file and find:

```json
{
  "client_email": "construction-bot@your-project.iam.gserviceaccount.com",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
}
```

Copy these to your `.env` file.

### 6. Create Drive Folder

1. Go to [Google Drive](https://drive.google.com)
2. Create a new folder (e.g., "Construction Objects")
3. Right-click > "Share"
4. Add the service account email (from step 5)
5. Give it "Editor" permissions
6. Copy the folder ID from URL:
   - URL: `https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz`
   - ID: `1AbCdEfGhIjKlMnOpQrStUvWxYz`

Update `.env`:

```env
GOOGLE_DRIVE_FOLDER_ID=1AbCdEfGhIjKlMnOpQrStUvWxYz
```

## Testing the Bot

### 1. Create a Forum Topic

1. Go to your Telegram group
2. Click "New Topic"
3. Name it (e.g., "Green City Apartment")
4. Create the topic

The bot should automatically respond with:

```
🏗 New Object Created

Object: Green City Apartment
Stage: 1 — Preparation

Use the buttons below to manage this object.

[📷 Add stage photos] [✅ Complete stage] [⏸ Pause]
```

### 2. Test Photo Upload

1. Click "📷 Add stage photos"
2. Send 3-10 photos to the topic
3. Bot should confirm upload

### 3. Test Stage Completion

1. Click "✅ Complete stage"
2. Bot should validate photos (minimum 3)
3. Bot should progress to Stage 2

### 4. Check Google Drive

1. Go to your Drive folder
2. You should see:
   ```
   Construction Objects/
   └── Green City Apartment/
       ├── Stage_1_Preparation/
       │   └── photo_1234567890_1.jpg
       ├── Stage_2_Rough construction/
       └── ...
   ```

## Troubleshooting

### Bot doesn't respond to topic creation

- Check bot is admin in the group
- Check `TELEGRAM_BOT_TOKEN` is correct
- Check logs for errors: `npm run start:dev`
- Verify bot has "Manage Topics" permission

### Photos not uploading to Drive

- Verify service account email is shared on folder
- Check folder has "Editor" permissions
- Verify `GOOGLE_PRIVATE_KEY` includes `\n` characters
- Check Drive API is enabled in Google Cloud Console

### Database connection error

```bash
# Check PostgreSQL is running
pg_isready

# Test connection
psql -U postgres -d tg_building_bot

# Check credentials in .env match
```

### "Cannot find module" errors

```bash
# Clear build and reinstall
rm -rf dist node_modules
npm install
npm run build
```

## Next Steps

- Customize stage names in `.env`
- Set up PM2 for production
- Configure backup schedule for PostgreSQL
- Set up monitoring/logging
- Review daily reminder schedule

## Useful Commands

```bash
# View logs
npm run start:dev

# Run migrations
npm run migration:run

# Revert last migration
npm run migration:revert

# Format code
npm run format

# Lint code
npm run lint

# Run tests
npm run test
```

## Getting Help

1. Check main [README.md](./README.md) for detailed documentation
2. Review logs in development mode
3. Check PostgreSQL logs
4. Verify all environment variables are set
5. Test Google Drive access separately

## Production Checklist

Before deploying to production:

- [ ] Set `NODE_ENV=production`
- [ ] Use strong database password
- [ ] Enable PostgreSQL SSL
- [ ] Set up database backups
- [ ] Use PM2 or similar process manager
- [ ] Set up monitoring (errors, uptime)
- [ ] Configure log rotation
- [ ] Test disaster recovery
- [ ] Document deployment process
- [ ] Set up staging environment

---

Need help? Review the full [README.md](./README.md) for more details.

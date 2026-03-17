# Complete Setup Guide - From Zero to Running Bot

This guide will take you from nothing to a fully functional Telegram construction tracking bot.

**Estimated time:** 30-45 minutes

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Step 1: Install Software](#step-1-install-software)
3. [Step 2: Create Telegram Bot](#step-2-create-telegram-bot)
4. [Step 3: Set Up Google Drive](#step-3-set-up-google-drive)
5. [Step 4: Set Up PostgreSQL Database](#step-4-set-up-postgresql-database)
6. [Step 5: Configure the Bot](#step-5-configure-the-bot)
7. [Step 6: Install Dependencies](#step-6-install-dependencies)
8. [Step 7: Run Database Migrations](#step-7-run-database-migrations)
9. [Step 8: Create Your Admin Account](#step-8-create-your-admin-account)
10. [Step 9: Set Up Telegram Group](#step-9-set-up-telegram-group)
11. [Step 10: Start the Bot](#step-10-start-the-bot)
12. [Step 11: Test Everything](#step-11-test-everything)
13. [Troubleshooting](#troubleshooting)

---

## Prerequisites

You'll need:
- A computer (Mac, Linux, or Windows)
- Internet connection
- Telegram account
- Google account
- Basic command line knowledge

---

## Step 1: Install Software

### 1.1 Install Node.js

**Mac (using Homebrew):**
```bash
brew install node
```

**Ubuntu/Debian:**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Windows:**
Download from https://nodejs.org/ (LTS version)

**Verify installation:**
```bash
node --version  # Should show v18.x.x or higher
npm --version   # Should show 9.x.x or higher
```

### 1.2 Install PostgreSQL

**Mac:**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**Windows:**
Download from https://www.postgresql.org/download/windows/

**Verify installation:**
```bash
psql --version  # Should show 14.x or higher
```

### 1.3 Clone/Download the Project

If you already have the code, skip this. Otherwise:
```bash
cd ~/Desktop/PET-projects/tg-bot-buildings/
# Your code should be in tg-building-bot/
```

---

## Step 2: Create Telegram Bot

### 2.1 Create Bot with BotFather

1. Open Telegram
2. Search for `@BotFather`
3. Send `/start`
4. Send `/newbot`
5. Choose a name (e.g., "Construction Tracker")
6. Choose a username (e.g., "construction_tracker_bot")
7. **Save the token** (looks like: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 2.2 Configure Bot Settings

Send these commands to @BotFather:

```
/setprivacy
[Select your bot]
Disable

/setjoingroups
[Select your bot]
Enable
```

**Save your bot token!** You'll need it later.

---

## Step 3: Set Up Google Drive

### 3.1 Create Google Cloud Project

1. Go to https://console.cloud.google.com/
2. Click "Select a project" → "New Project"
3. Name it: "Construction Bot"
4. Click "Create"
5. Wait for project to be created (~30 seconds)

### 3.2 Enable Google Drive API

1. In Google Cloud Console, go to "APIs & Services" → "Library"
2. Search for "Google Drive API"
3. Click it
4. Click "Enable"
5. Wait for it to enable (~10 seconds)

### 3.3 Create Service Account

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "Service Account"
3. Fill in:
   - Service account name: `construction-bot`
   - Service account ID: `construction-bot` (auto-filled)
4. Click "Create and Continue"
5. Skip optional steps (click "Continue" → "Done")

### 3.4 Generate Service Account Key

1. Click on the service account you just created
2. Go to "Keys" tab
3. Click "Add Key" → "Create new key"
4. Choose "JSON"
5. Click "Create"
6. **A JSON file will download** - Save it safely!

### 3.5 Extract Credentials from JSON

Open the downloaded JSON file. You'll see something like:

```json
{
  "type": "service_account",
  "project_id": "construction-bot-123456",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n",
  "client_email": "construction-bot@construction-bot-123456.iam.gserviceaccount.com",
  ...
}
```

**Copy these two values:**
- `client_email` - entire email address
- `private_key` - entire key including BEGIN/END lines

### 3.6 Create Google Drive Folder

1. Go to https://drive.google.com/
2. Click "New" → "Folder"
3. Name it: "Construction Projects"
4. Right-click the folder → "Share"
5. Paste the `client_email` from the JSON file
6. Give it "Editor" permission
7. Click "Share"
8. **Copy the folder ID from the URL:**
   - URL: `https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz`
   - Folder ID: `1AbCdEfGhIjKlMnOpQrStUvWxYz`

---

## Step 4: Set Up PostgreSQL Database

### 4.1 Access PostgreSQL

**Mac/Linux:**
```bash
psql postgres
```

**If that doesn't work, try:**
```bash
sudo -u postgres psql
```

**Windows:**
Open "SQL Shell (psql)" from Start menu

### 4.2 Create Database and User

```sql
-- Create database
CREATE DATABASE tg_building_bot;

-- Create user (change password!)
CREATE USER bot_user WITH PASSWORD 'your_secure_password_here';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE tg_building_bot TO bot_user;

-- Connect to the database
\c tg_building_bot

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO bot_user;

-- Exit
\q
```

**Test connection:**
```bash
psql -U bot_user -d tg_building_bot -h localhost
# Enter password when prompted
# If it works, type \q to exit
```

---

## Step 5: Configure the Bot

### 5.1 Create .env File

```bash
cd ~/Desktop/PET-projects/tg-bot-buildings/tg-building-bot/
cp .env.example .env
```

### 5.2 Edit .env File

Open `.env` in your text editor and fill in:

```env
# Application
NODE_ENV=development
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=bot_user
DB_PASSWORD=your_secure_password_here
DB_DATABASE=tg_building_bot

# Telegram Bot (from Step 2)
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_COORDINATOR_CHAT_ID=  # Leave empty for now, will fill later

# Google Drive API (from Step 3)
GOOGLE_CLIENT_EMAIL=construction-bot@construction-bot-123456.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour key here\n-----END PRIVATE KEY-----\n"
GOOGLE_DRIVE_FOLDER_ID=1AbCdEfGhIjKlMnOpQrStUvWxYz

# Scheduler
REMINDER_TIME=16:00
REMINDER_TIMEZONE=Europe/Warsaw
STALLED_STAGE_DAYS=7

# Stage Configuration
STAGE_NAMES=Preparation,Rough construction,Engineering,Finishing,Final check
MIN_PHOTOS_PER_STAGE=3
MAX_PHOTOS_PER_STAGE=10
```

**Important notes:**
- Keep the `\n` in the private key
- Use the full key including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`
- Quote the private key with double quotes

---

## Step 6: Install Dependencies

```bash
cd ~/Desktop/PET-projects/tg-bot-buildings/tg-building-bot/

# Install dependencies
npm install
```

**Expected output:**
```
added 900+ packages in 30s
```

**If you see errors about Python or build tools:**

**Mac:**
```bash
xcode-select --install
```

**Ubuntu:**
```bash
sudo apt-get install build-essential
```

---

## Step 7: Run Database Migrations

### 7.1 Run Migrations

```bash
npm run migration:run
```

**Expected output:**
```
query: SELECT * FROM "migrations" ...
query: CREATE TYPE "object_status_enum" ...
query: CREATE TABLE "objects" ...
migration InitialSchema1710000000000 has been executed successfully.
migration AddCoordinators1710000000001 has been executed successfully.
```

### 7.2 Verify Tables Created

```bash
psql -U bot_user -d tg_building_bot -h localhost
```

```sql
-- List all tables
\dt

-- Should see:
-- objects
-- stages
-- stage_photos
-- stage_history
-- coordinators
-- object_coordinators
-- migrations

-- Exit
\q
```

---

## Step 8: Create Your Admin Account

### 8.1 Get Your Telegram User ID

1. Open Telegram
2. Search for `@userinfobot`
3. Send it any message
4. It will reply with your user ID (e.g., `123456789`)
5. **Save this number!**

### 8.2 Create Admin in Database

```bash
psql -U bot_user -d tg_building_bot -h localhost
```

```sql
-- Replace YOUR_USER_ID and your_username
INSERT INTO coordinators (
  id,
  "telegramUserId",
  username,
  role,
  "isActive",
  "createdAt",
  "updatedAt"
)
VALUES (
  gen_random_uuid(),
  '123456789',           -- YOUR Telegram user ID
  'your_telegram_username',  -- YOUR username (without @)
  'ADMIN',
  true,
  NOW(),
  NOW()
);

-- Verify
SELECT * FROM coordinators;

-- Should show your admin account

-- Exit
\q
```

---

## Step 9: Set Up Telegram Group

### 9.1 Create Group

1. Open Telegram
2. Click "New Group"
3. Name it: "Construction Projects"
4. Add at least one person (can be yourself)
5. Create the group

### 9.2 Enable Forum Topics

1. Open the group
2. Click group name at top
3. Click "..." (three dots)
4. Select "Group Type"
5. Enable "Topics"
6. Save

### 9.3 Add Bot to Group

1. In the group, click "Add Members"
2. Search for your bot (by username from Step 2)
3. Add it
4. Click "Add as Administrator"
5. Give it these permissions:
   - ✅ Delete messages
   - ✅ Manage topics
   - ✅ Send messages
   - ✅ Send photos
6. Save

### 9.4 Get Group Chat ID

**Method 1: Using Bot API**

1. Send a message in the group (mention the bot)
2. Open this URL in browser (replace BOT_TOKEN):
   ```
   https://api.telegram.org/botYOUR_BOT_TOKEN/getUpdates
   ```
3. Look for `"chat":{"id":-1001234567890`
4. Copy the number (including the minus sign)

**Method 2: Using Another Bot**

1. Add `@RawDataBot` to your group
2. It will send the chat ID
3. Remove the bot after

### 9.5 Update .env with Chat ID

Edit `.env` and add the chat ID:
```env
TELEGRAM_COORDINATOR_CHAT_ID=-1001234567890
```

---

## Step 10: Start the Bot

### 10.1 Start in Development Mode

```bash
npm run start:dev
```

**Expected output:**
```
[Nest] 12345  - 01/01/2024, 10:00:00 AM     LOG [NestFactory] Starting Nest application...
[Nest] 12345  - 01/01/2024, 10:00:00 AM     LOG [InstanceLoader] AppModule dependencies initialized
[Nest] 12345  - 01/01/2024, 10:00:00 AM     LOG [InstanceLoader] TypeOrmModule dependencies initialized
[Nest] 12345  - 01/01/2024, 10:00:00 AM     LOG [TelegramService] Telegram bot initialized with polling
[Nest] 12345  - 01/01/2024, 10:00:00 AM     LOG [Bootstrap] Application is running on: http://localhost:3000
[Nest] 12345  - 01/01/2024, 10:00:00 AM     LOG [Bootstrap] Telegram bot is active and listening for updates
```

✅ **If you see this, the bot is running!**

**Leave this terminal open** - the bot is now running.

---

## Step 11: Test Everything

Open a **new terminal** for testing commands.

### 11.1 Test Admin Commands

In Telegram, send this to your bot (in private message):
```
/help_admin
```

**Expected response:**
```
🔧 Admin Commands

Coordinator Management:
/assign @username object_name - Assign coordinator to object
...
```

✅ **If you see this, admin system works!**

### 11.2 Test Object Creation

1. Go to your Telegram group
2. Click "Create Topic"
3. Name it: "Test Project"
4. Create the topic

**Bot should respond in the topic:**
```
🏗 New Object Created

Object: Test Project
Stage: 1 — Preparation

Use the buttons below to manage this object.

[📷 Add stage photos] [✅ Complete stage] [⏸ Pause]
```

✅ **If you see this, object creation works!**

### 11.3 Test Photo Upload

1. Click "📷 Add stage photos"
2. Bot should ask for photos
3. Send 3 photos to the topic
4. Bot should confirm upload

✅ **If photos upload, Google Drive integration works!**

### 11.4 Verify Google Drive

1. Go to https://drive.google.com/
2. Open "Construction Projects" folder
3. You should see "Test Project" folder
4. Inside should be stage folders with photos

✅ **If you see folders and photos, everything works!**

### 11.5 Test Stage Completion

1. Click "✅ Complete stage"
2. Bot should complete stage 1
3. Bot should move to stage 2

✅ **If stage progresses, completion works!**

### 11.6 Test Coordinator Assignment

In private message to bot:
```
/assign @your_friend Test Project
```

(Ask your friend to send any message to bot first)

**Expected response:**
```
✅ Assigned @your_friend to "Test Project"
```

✅ **If assignment works, RBAC works!**

---

## Troubleshooting

### Bot doesn't start

**Check 1: Dependencies installed?**
```bash
ls node_modules/
# Should show many folders
```

**Check 2: .env file exists?**
```bash
cat .env
# Should show your configuration
```

**Check 3: Database running?**
```bash
psql -U bot_user -d tg_building_bot -h localhost
\q
```

**Check 4: Look at error messages**
The error usually tells you what's wrong.

### Bot starts but doesn't respond

**Check 1: Bot token correct?**
Test the token:
```bash
curl https://api.telegram.org/botYOUR_TOKEN/getMe
```

Should return bot info.

**Check 2: Bot is admin in group?**
Go to group → Info → Administrators → Your bot should be there

**Check 3: Forum topics enabled?**
Group settings → Group Type → Topics should be ON

### "Cannot find module" errors

```bash
rm -rf node_modules package-lock.json
npm install
npm run build
npm run start:dev
```

### Database connection errors

**Check credentials in .env:**
```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=bot_user
DB_PASSWORD=your_password
DB_DATABASE=tg_building_bot
```

**Test connection manually:**
```bash
psql -U bot_user -d tg_building_bot -h localhost -p 5432
```

### Google Drive upload fails

**Check 1: Service account email shared?**
1. Go to your Drive folder
2. Right-click → Share
3. The service account email should be in "People with access"

**Check 2: Private key correct in .env?**
- Must have `\n` characters
- Must be wrapped in quotes
- Must include BEGIN/END lines

**Check 3: Drive API enabled?**
Go to https://console.cloud.google.com/apis/library/drive.googleapis.com
Should show "API enabled"

### Photos upload but not visible

**Check folder permissions:**
1. Go to Drive folder
2. Right-click → Share
3. Service account should have "Editor" access (not "Viewer")

### Migration fails

**Check 1: UUID extension**
```bash
psql -U bot_user -d tg_building_bot
```
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
\q
```

**Check 2: Run migrations again**
```bash
npm run migration:run
```

**Check 3: Verify tables**
```sql
\dt
```

---

## Production Deployment

Once everything works in development:

### 1. Update .env for Production

```env
NODE_ENV=production
```

### 2. Build the Application

```bash
npm run build
```

### 3. Use Process Manager

```bash
# Install PM2
npm install -g pm2

# Start bot
pm2 start dist/main.js --name construction-bot

# View logs
pm2 logs construction-bot

# Make it restart on reboot
pm2 startup
pm2 save
```

### 4. Set Up Backups

**Database backup:**
```bash
# Create backup script
cat > backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -U bot_user tg_building_bot > backup_$DATE.sql
EOF

chmod +x backup.sh

# Add to cron (daily at 2 AM)
crontab -e
# Add: 0 2 * * * /path/to/backup.sh
```

---

## Quick Reference Card

### Start Bot
```bash
npm run start:dev
```

### Stop Bot
Press `Ctrl+C` in the terminal

### View Logs
They appear in the terminal

### Restart Bot
Stop (Ctrl+C) then start again

### Admin Commands
```
/help_admin - Show commands
/assign @user object - Assign coordinator
/list_coordinators - Show all coordinators
```

### Database Access
```bash
psql -U bot_user -d tg_building_bot -h localhost
```

### Check Bot Status
```bash
curl http://localhost:3000
# Should return OK
```

---

## Next Steps

✅ **Bot is now running!**

**What to do next:**

1. Read [RBAC_QUICK_START.md](./RBAC_QUICK_START.md) for permission management
2. Create more topics for real projects
3. Assign coordinators to projects
4. Configure stage names in `.env` if needed
5. Set up automated backups
6. Monitor bot logs regularly

**For more help:**
- Main documentation: [README.md](./README.md)
- RBAC guide: [RBAC_SETUP_GUIDE.md](./RBAC_SETUP_GUIDE.md)
- Architecture: [ARCHITECTURE.md](./ARCHITECTURE.md)
- API reference: [API.md](./API.md)

---

## Support Checklist

If you get stuck, check:
- [ ] Node.js 18+ installed: `node --version`
- [ ] PostgreSQL running: `psql --version`
- [ ] Database created: `psql -U bot_user -d tg_building_bot`
- [ ] Migrations run: `SELECT * FROM objects;` works
- [ ] .env file exists and filled out
- [ ] Bot token valid: Test with curl
- [ ] Bot is admin in group
- [ ] Forum topics enabled in group
- [ ] Google Drive folder shared with service account
- [ ] Admin account created in database
- [ ] Bot started: `npm run start:dev`

**Still stuck?** Review the error message carefully - it usually tells you exactly what's wrong!

---

**Congratulations! 🎉 Your construction tracking bot is now running!**

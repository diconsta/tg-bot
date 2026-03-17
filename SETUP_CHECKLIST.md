# Setup Checklist

Print this and check off as you go!

## Phase 1: Software Installation

- [ ] Node.js 18+ installed
  ```bash
  node --version
  ```

- [ ] PostgreSQL 14+ installed
  ```bash
  psql --version
  ```

- [ ] Project code downloaded
  ```bash
  cd ~/Desktop/PET-projects/tg-bot-buildings/tg-building-bot/
  ```

## Phase 2: Telegram Bot

- [ ] Bot created with @BotFather
- [ ] Bot token saved (looks like: `123456789:ABC...`)
- [ ] Privacy disabled (`/setprivacy` → Disable)
- [ ] Join groups enabled (`/setjoingroups` → Enable)

## Phase 3: Google Drive

- [ ] Google Cloud project created
- [ ] Google Drive API enabled
- [ ] Service account created
- [ ] JSON key downloaded
- [ ] `client_email` copied from JSON
- [ ] `private_key` copied from JSON (with `\n`)
- [ ] Drive folder "Construction Projects" created
- [ ] Folder shared with service account email (Editor access)
- [ ] Folder ID copied from URL

## Phase 4: Database

- [ ] PostgreSQL running
- [ ] Database `tg_building_bot` created
  ```sql
  CREATE DATABASE tg_building_bot;
  ```

- [ ] User `bot_user` created with password
  ```sql
  CREATE USER bot_user WITH PASSWORD 'password';
  GRANT ALL PRIVILEGES ON DATABASE tg_building_bot TO bot_user;
  ```

- [ ] UUID extension enabled
  ```sql
  \c tg_building_bot
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
  ```

- [ ] Connection tested
  ```bash
  psql -U bot_user -d tg_building_bot -h localhost
  ```

## Phase 5: Configuration

- [ ] `.env` file created
  ```bash
  cp .env.example .env
  ```

- [ ] `TELEGRAM_BOT_TOKEN` filled in
- [ ] `DB_USERNAME` and `DB_PASSWORD` filled in
- [ ] `GOOGLE_CLIENT_EMAIL` filled in
- [ ] `GOOGLE_PRIVATE_KEY` filled in (in quotes, with `\n`)
- [ ] `GOOGLE_DRIVE_FOLDER_ID` filled in
- [ ] Dependencies installed
  ```bash
  npm install
  ```

## Phase 6: Database Setup

- [ ] Migrations run successfully
  ```bash
  npm run migration:run
  ```

- [ ] Tables created (verify with psql)
  ```sql
  \dt
  ```
  Should see: objects, stages, stage_photos, stage_history, coordinators, object_coordinators

## Phase 7: Admin Account

- [ ] Your Telegram user ID obtained (from @userinfobot)
- [ ] Admin account created in database
  ```sql
  INSERT INTO coordinators (id, "telegramUserId", username, role, "isActive", "createdAt", "updatedAt")
  VALUES (gen_random_uuid(), 'YOUR_ID', 'username', 'ADMIN', true, NOW(), NOW());
  ```

- [ ] Admin verified
  ```sql
  SELECT * FROM coordinators;
  ```

## Phase 8: Telegram Group

- [ ] Group created
- [ ] Forum Topics enabled
- [ ] Bot added to group
- [ ] Bot promoted to admin with permissions:
  - [ ] Delete messages
  - [ ] Manage topics
  - [ ] Send messages
  - [ ] Send photos
- [ ] Group chat ID obtained
- [ ] `TELEGRAM_COORDINATOR_CHAT_ID` updated in `.env`

## Phase 9: Start Bot

- [ ] Bot started
  ```bash
  npm run start:dev
  ```

- [ ] Startup logs show success
  ```
  [Bootstrap] Application is running on: http://localhost:3000
  [Bootstrap] Telegram bot is active and listening for updates
  ```

## Phase 10: Testing

- [ ] Admin commands work
  - Send `/help_admin` to bot → See commands

- [ ] Object creation works
  - Create topic in group → Bot responds

- [ ] Photo upload works
  - Click "Add photos" → Send photos → Upload succeeds

- [ ] Google Drive works
  - Check Drive folder → Folders and photos appear

- [ ] Stage completion works
  - Click "Complete stage" → Stage progresses

- [ ] RBAC works
  - Assign coordinator → They can manage object
  - Non-assigned user → Gets "not authorized"

## Success Criteria

✅ All items checked above

## Quick Test Commands

```bash
# 1. Check bot running
curl http://localhost:3000

# 2. Check database
psql -U bot_user -d tg_building_bot -h localhost -c "SELECT COUNT(*) FROM objects;"

# 3. Check admin
psql -U bot_user -d tg_building_bot -h localhost -c "SELECT * FROM coordinators WHERE role='ADMIN';"

# 4. Test bot token
curl https://api.telegram.org/botYOUR_TOKEN/getMe
```

## If Something Fails

**Checklist not complete?** → Go back and complete missing items

**Bot won't start?** → Check logs for error messages

**Database errors?** → Verify credentials in `.env`

**Google Drive errors?** → Verify service account is shared on folder

**Bot doesn't respond?** → Check bot is admin in group

**"Not authorized" for admin?** → Verify admin created correctly in database

## Files to Keep Safe

- [ ] `.env` file (contains secrets)
- [ ] Google service account JSON file
- [ ] Database password
- [ ] Bot token

**Never commit these to git!**

## Documentation Reference

- Full setup: [COMPLETE_SETUP_GUIDE.md](./COMPLETE_SETUP_GUIDE.md)
- RBAC setup: [RBAC_QUICK_START.md](./RBAC_QUICK_START.md)
- Troubleshooting: [README.md](./README.md)

---

**Date setup completed:** _______________

**Notes:**
```





```

**Working? YES / NO**

If YES: 🎉 Congratulations!
If NO: Review COMPLETE_SETUP_GUIDE.md troubleshooting section

# Telegram Storage Migration Guide

## Overview

The bot has been successfully migrated from Google Drive storage to native Telegram file storage. This eliminates the need for external storage services and simplifies the architecture.

## What Changed

### 1. Photo Storage Method
- **Before**: Photos were downloaded from Telegram, uploaded to Google Drive, and URLs stored in database
- **After**: Photos are stored directly in Telegram using `file_id`, no download/upload needed

### 2. Database Schema
The `stage_photos` table was updated:

**Removed columns:**
- `driveFileId` (VARCHAR)
- `driveUrl` (TEXT)

**Added columns:**
- `telegramFileId` (VARCHAR) - Telegram's file identifier for retrieving photos
- `telegramFileUniqueId` (VARCHAR) - Telegram's unique file identifier
- `fileName` (VARCHAR) - Optional file name
- `fileSize` (INT) - Optional file size in bytes

### 3. New Feature: View Photos by Stage

Users can now view all photos for any stage of any object directly in Telegram:

1. Click **"📸 View photos"** button in the object topic
2. Select the stage you want to view
3. Bot sends all photos for that stage in the chat

## Benefits

### No External Dependencies
- ✅ No Google Drive setup required
- ✅ No service account authentication
- ✅ No storage quota limitations
- ✅ No API rate limits

### Simpler Architecture
- ✅ Fewer moving parts
- ✅ Less configuration needed
- ✅ Faster photo uploads (no download/upload cycle)
- ✅ Lower latency

### Better Integration
- ✅ Photos stored where they're used (Telegram)
- ✅ Permanent file IDs that never expire
- ✅ Can retrieve any photo instantly using `file_id`
- ✅ Native Telegram media group support

## Migration Steps

### 1. Apply Database Migration

The migration will automatically:
- Drop Google Drive columns
- Add Telegram storage columns
- Preserve existing data structure

```bash
npm run migration:run
```

### 2. Environment Variables

**Removed (no longer needed):**
```bash
GOOGLE_SERVICE_ACCOUNT_PATH=./building-tg-bot-ad5d02731a3b.json
GOOGLE_DRIVE_FOLDER_ID=1Y4jwTfwfXDuxUZMnJuwDULNbBM2fZQzr
```

**Current .env configuration:**
```bash
# Application
NODE_ENV=development
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=tg-bot-local

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_COORDINATOR_CHAT_ID=your_chat_id

# Superadmin Configuration
TELEGRAM_SUPERADMIN_IDS=your_telegram_user_id

# Scheduler
REMINDER_TIME=16:00
REMINDER_TIMEZONE=Europe/Warsaw
STALLED_STAGE_DAYS=7

# Photos Configuration
MIN_PHOTOS_PER_STAGE=3
MAX_PHOTOS_PER_STAGE=10
```

### 3. Start the Bot

```bash
npm run start:dev
```

## How It Works

### Uploading Photos

1. User uploads photo to Telegram topic
2. Bot receives photo message with `file_id`
3. Bot saves `file_id` directly to database
4. **No download or external upload happens**

**Code flow:**
```typescript
// Extract photo data from Telegram message
const photo = msg.photo[msg.photo.length - 1];
const photoData: TelegramPhotoData = {
  fileId: photo.file_id,              // Used to retrieve photo
  fileUniqueId: photo.file_unique_id, // Unique identifier
  fileSize: photo.file_size,          // Size in bytes
};

// Save to database
await photosService.addPhoto(objectId, stageId, photoData);
```

### Viewing Photos

1. User clicks "📸 View photos" button
2. Bot shows list of all stages with photo counts
3. User selects a stage
4. Bot retrieves photos from database using `objectId` and `stageId`
5. Bot sends photos using stored `file_id`

**Code flow:**
```typescript
// Get photos for stage
const photos = await photosService.findByObjectAndStage(objectId, stageId);

// Send photos using file_id
for (const photo of photos) {
  await bot.sendPhoto(chatId, photo.telegramFileId, {
    message_thread_id: threadId,
  });
}
```

## API Changes

### PhotosService

**Before:**
```typescript
async addMultiplePhotos(
  objectId: string,
  objectName: string,
  stageId: string,
  stageIndex: number,
  stageName: string,
  photoBuffers: Buffer[],
): Promise<StagePhotoEntity[]>
```

**After:**
```typescript
async addMultiplePhotos(
  objectId: string,
  stageId: string,
  photosData: TelegramPhotoData[],
): Promise<StagePhotoEntity[]>
```

### New Interface

```typescript
export interface TelegramPhotoData {
  fileId: string;          // Required: Telegram file ID
  fileUniqueId: string;    // Required: Unique identifier
  fileName?: string;       // Optional: Original file name
  fileSize?: number;       // Optional: File size in bytes
}
```

## Files Modified

### Database
- `src/photos/entities/stage-photo.entity.ts` - Updated entity schema
- `src/database/migrations/1710000000004-MigrateToTelegramStorage.ts` - Migration file

### Services
- `src/photos/photos.service.ts` - Removed Google Drive, added Telegram storage
- `src/telegram/telegram-update.handler.ts` - Updated photo handling logic
- `src/telegram/telegram.service.ts` - Added "View photos" button

### Modules
- `src/photos/photos.module.ts` - Removed GoogleDriveModule import
- `src/telegram/telegram.module.ts` - Removed GoogleDriveModule import

### Configuration
- `.env` - Removed Google Drive variables
- `src/config/app.config.ts` - Removed Google Drive configuration

## Testing

### 1. Upload Photos
1. Create a new forum topic (creates new object)
2. Click "📷 Add stage photos"
3. Upload one or multiple photos
4. Verify success message appears

### 2. View Photos
1. Click "📸 View photos" button
2. Select any stage
3. Verify photos are displayed correctly

### 3. Complete Stage
1. Upload minimum required photos (default: 3)
2. Click "✅ Complete stage"
3. Verify stage completes and advances to next stage

## Troubleshooting

### Photos not appearing
- Ensure bot has access to the forum topic
- Check database has `telegramFileId` populated
- Verify bot token is valid

### "Error loading photos"
- Check bot permissions in the chat
- Verify `file_id` is still valid (they should never expire)
- Check database connection

### Migration fails
- Ensure no active connections to database
- Backup database before running migration
- Check migration file for syntax errors

## Rollback (If Needed)

If you need to rollback the migration:

```bash
npm run migration:revert
```

This will:
- Restore `driveFileId` and `driveUrl` columns
- Remove Telegram storage columns
- Preserve data structure (but data will be lost)

**Note:** This is only for emergency rollback. Photos uploaded after migration will be lost if you rollback.

## Performance Considerations

### Advantages
- **Faster uploads**: No download/upload cycle (was ~2-3 seconds per photo)
- **No rate limits**: Telegram doesn't rate limit file_id retrieval
- **Instant retrieval**: Photos load immediately from Telegram servers
- **No storage costs**: Unlimited photo storage in Telegram

### Limitations
- **File ID lifespan**: Telegram file IDs are permanent but tied to bot
- **Download size**: If you need to download photos externally, you'd need to download from Telegram
- **No folder organization**: Photos are stored flat in database, organized by objectId/stageId

## Future Enhancements

Possible improvements:
1. Add photo captions/descriptions
2. Allow photo deletion
3. Export photos to ZIP archive
4. Share photos with external users
5. Photo comparison between stages
6. Thumbnails for faster browsing

## Support

For issues or questions:
1. Check logs: `npm run start:dev`
2. Verify database schema: Check `stage_photos` table structure
3. Test with simple photo upload first
4. Check Telegram bot permissions

## Summary

The migration to Telegram storage simplifies the architecture while providing:
- ✅ Zero external dependencies
- ✅ Unlimited free storage
- ✅ Faster photo operations
- ✅ Better user experience with photo viewing
- ✅ Native Telegram integration

All existing functionality remains the same, with the added benefit of being able to view photos directly in the chat!

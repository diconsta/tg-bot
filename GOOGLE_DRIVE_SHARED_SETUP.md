# Google Drive Shared Drive Integration - Setup Guide

## Overview
The bot now supports automatic backup of photos to **Google Shared Drives** (formerly Team Drives). When users upload photos via Telegram, the bot will:
1. Store the Telegram `file_id` (for fast retrieval from Telegram)
2. Download the photo from Telegram
3. Upload it to your Google Shared Drive
4. Store the Google Drive file ID and URL in the database

**Important:** This integration uses **Shared Drives**, which are NOT affected by the April 2025 Google service account changes. Service accounts can upload to Shared Drives without any restrictions.

---

## Google Drive Folder Structure

Photos are organized in your Shared Drive with the following structure:

```
Shared Drive: "Building Projects"
  ├── Building A - Warsaw/          # Object name
  │   ├── Stage 1 - Demontaż/       # Stage name
  │   │   ├── photo_1234567890_1.jpg
  │   │   ├── photo_1234567890_2.jpg
  │   │   └── photo_1234567891_1.jpg
  │   ├── Stage 2 - Instalacje/
  │   │   ├── photo_1234567892_1.jpg
  │   │   └── photo_1234567893_1.jpg
  │   └── ...
  ├── Building B - Krakow/
  │   └── ...
  └── ...
```

**Filename format:** `photo_<timestamp>_<index>.jpg`
- `timestamp`: Unix timestamp in milliseconds
- `index`: Photo number in the batch (1, 2, 3, etc.)

---

## Google Cloud Setup

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Project name: `TG Building Bot`
4. Click "Create"
5. Wait for project creation to complete

### Step 2: Enable Google Drive API

1. In your project, go to "APIs & Services" → "Library"
2. Search for "Google Drive API"
3. Click on "Google Drive API"
4. Click "Enable"
5. Wait for API to be enabled

### Step 3: Create a Service Account

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "Service Account"
3. Service account details:
   - **Name**: `tg-building-bot`
   - **Service account ID**: `tg-building-bot` (auto-generated)
   - **Description**: "Service account for Telegram building bot to upload photos"
4. Click "Create and Continue"
5. Grant role: **Skip this step** (click "Continue")
6. Click "Done"

### Step 4: Create Service Account Key

1. In "Credentials" page, find your service account in the list
2. Click on the service account name
3. Go to "Keys" tab
4. Click "Add Key" → "Create new key"
5. Key type: **JSON**
6. Click "Create"
7. A JSON file will be downloaded (e.g., `tg-building-bot-xyz123.json`)
8. **Save this file securely** - you'll need it later

### Step 5: Note the Service Account Email

In the service account details, copy the email address:
- Format: `tg-building-bot@your-project.iam.gserviceaccount.com`
- You'll need this to share the Shared Drive

---

## Google Workspace Setup (Shared Drive)

### Step 1: Create a Shared Drive

**Note:** Shared Drives require Google Workspace (not available for personal Gmail accounts).

1. Go to [Google Drive](https://drive.google.com/)
2. In the left sidebar, click "Shared drives"
3. Click "New" at the top
4. Name: `Building Projects` (or any name you prefer)
5. Click "Create"

### Step 2: Share the Shared Drive with Service Account

1. Click on your newly created Shared Drive
2. Click the ⚙️ (settings icon) in the top right
3. Select "Manage members"
4. Click "Add members"
5. Paste your service account email:
   ```
   tg-building-bot@your-project.iam.gserviceaccount.com
   ```
6. Set permission level: **Content manager** or **Manager**
   - **Content manager**: Can upload, create folders, edit files (recommended)
   - **Manager**: Full control including member management
7. **Uncheck** "Notify people" (service accounts don't need notifications)
8. Click "Send"

### Step 3: Get Shared Drive ID

1. In Google Drive, click on your Shared Drive name
2. Look at the URL in your browser:
   ```
   https://drive.google.com/drive/folders/0AByZ1234567890Xyz
   ```
3. Copy the ID after `/folders/`: `0AByZ1234567890Xyz`
4. This is your **Shared Drive ID** - save it for configuration

---

## Bot Configuration

### Step 1: Place Service Account JSON File

1. Copy the downloaded JSON key file to your project root:
   ```bash
   cp ~/Downloads/tg-building-bot-xyz123.json /path/to/tg-building-bot/
   ```

2. Rename it to something simple (optional):
   ```bash
   mv tg-building-bot-xyz123.json building-tg-bot-credentials.json
   ```

3. **Add to .gitignore** (already included):
   ```
   *.json
   ```

### Step 2: Update `.env` File

Add the following configuration to your `.env` file:

```bash
# Google Drive Configuration (using Shared Drive)
GOOGLE_SERVICE_ACCOUNT_PATH=./building-tg-bot-credentials.json
GOOGLE_SHARED_DRIVE_ID=0AByZ1234567890Xyz
```

**Configuration details:**

- `GOOGLE_SERVICE_ACCOUNT_PATH`: Path to your service account JSON key file
  - Use relative path from project root
  - Example: `./building-tg-bot-credentials.json`
  - Or absolute path: `/home/user/tg-bot/credentials.json`

- `GOOGLE_SHARED_DRIVE_ID`: The ID of your Shared Drive (from Step 3 above)
  - Find it in the Drive URL: `https://drive.google.com/drive/folders/YOUR_ID_HERE`
  - Example: `0AByZ1234567890Xyz`

### Step 3: Run Database Migration

Apply the migration to add Google Drive fields to the database:

```bash
npm run migration:run
```

This adds three new columns to the `stage_photos` table:
- `driveFileId`: Google Drive file ID
- `driveUrl`: Web view link to the file
- `driveFolderPath`: Folder path (e.g., "Building A/Stage 1")

### Step 4: Restart the Bot

```bash
npm run start:dev  # Development
# OR
npm run start:prod  # Production
```

---

## How It Works

### Photo Upload Flow

1. **User uploads photo** to Telegram thread
2. **Bot receives** photo with Telegram `file_id`
3. **Bot checks** if Google Drive is enabled (credentials configured)
4. **If Google Drive enabled:**
   - Downloads photo from Telegram as Buffer
   - Generates filename: `photo_<timestamp>_<index>.jpg`
   - Gets or creates object folder in Shared Drive
   - Gets or creates stage folder inside object folder
   - Uploads photo to Google Drive
   - Stores both Telegram `file_id` AND Drive info in database
5. **If Google Drive disabled or upload fails:**
   - Only stores Telegram `file_id` (fallback)
   - Bot continues to work normally using Telegram storage

### Database Storage

Each photo record stores:

```typescript
{
  id: "uuid",
  objectId: "uuid",
  stageId: "uuid",
  telegramFileId: "AgACAgIAAxkB...",           // Telegram file ID
  telegramFileUniqueId: "AQADwzM...",          // Telegram unique ID
  fileName: "photo_1234567890_1.jpg",          // Generated filename
  fileSize: 125634,                             // File size in bytes
  driveFileId: "1a2b3c4d5e6f7g8h9i0j",         // Google Drive file ID
  driveUrl: "https://drive.google.com/file/d/1a2b3c.../view",  // View link
  driveFolderPath: "Building A - Warsaw/Stage 1 - Demontaż",   // Folder path
  createdAt: "2026-03-12T10:30:00Z"
}
```

---

## Testing Google Drive Integration

### 1. Check Bot Startup Logs

After starting the bot with Google Drive configured, you should see:

```
[GoogleDriveStorageService] Google Drive initialized with Shared Drive: 0AByZ1234567890Xyz
```

If you see this warning instead:
```
[GoogleDriveStorageService] Google Drive not configured - storage disabled
[GoogleDriveStorageService] Set GOOGLE_SERVICE_ACCOUNT_PATH and GOOGLE_SHARED_DRIVE_ID in .env
```
Check your `.env` configuration.

### 2. Upload a Test Photo

1. Go to any object thread in your Telegram coordinator chat
2. Click "📷 Add stage photos"
3. Upload a photo
4. Check the logs for:
   ```
   [TelegramUpdateHandler] Photo uploaded to Google Drive: 1a2b3c4d5e6f7g8h9i0j
   ```

### 3. Verify in Google Drive

1. Go to [Google Drive](https://drive.google.com/)
2. Click "Shared drives" in left sidebar
3. Open your Shared Drive: "Building Projects"
4. Navigate to: `<object-name>/<stage-name>/`
5. You should see your uploaded photo files

### 4. Check Database

Query the database to verify Drive fields are populated:

```sql
SELECT
  "fileName",
  "driveFileId",
  "driveUrl",
  "driveFolderPath",
  "telegramFileId"
FROM "stage_photos"
ORDER BY "createdAt" DESC
LIMIT 5;
```

You should see Drive fields filled in for new photos.

---

## Troubleshooting

### Error: "Google Drive client not initialized"

**Cause:** Service account JSON file not found or invalid

**Solution:**
1. Check `GOOGLE_SERVICE_ACCOUNT_PATH` in `.env` points to correct file
2. Verify the JSON file exists at that path
3. Check JSON file is valid (open in text editor)
4. Restart the bot

### Error: "Failed to initialize Google Drive"

**Cause:** Invalid service account credentials or missing API enablement

**Solution:**
1. Verify Google Drive API is enabled in Google Cloud Console
2. Check service account JSON file is for the correct project
3. Re-download service account key if needed
4. Restart bot

### Error: "The user does not have sufficient permissions for this file"

**Cause:** Service account doesn't have access to Shared Drive

**Solution:**
1. Go to Google Drive → Shared drives → Your drive → ⚙️ → Manage members
2. Verify service account email is in the members list
3. Check permission level is "Content manager" or "Manager"
4. If not present, add the service account email again

### Error: "Shared drive not found"

**Cause:** Incorrect Shared Drive ID in `.env`

**Solution:**
1. Open your Shared Drive in Google Drive
2. Copy the ID from URL: `https://drive.google.com/drive/folders/YOUR_ID`
3. Update `GOOGLE_SHARED_DRIVE_ID` in `.env`
4. Restart bot

### Photos upload to Telegram but not Drive

**Cause:** Drive upload failed, but bot continues with Telegram-only storage

**Solution:**
1. Check bot logs for error messages:
   ```
   [TelegramUpdateHandler] Failed to upload photo to Google Drive: <error details>
   ```
2. Common issues:
   - Service account not added to Shared Drive
   - Shared Drive ID incorrect
   - API quota exceeded (rare)
   - Network connectivity issues

### Drive URLs not accessible

**Cause:** Service accounts have restricted sharing permissions

**Solution:**
- Drive URLs are stored for **internal reference only**
- To access photos, use Telegram `file_id` (bot can retrieve from Telegram)
- Or manually access files through the Shared Drive in Google Drive web interface
- For this bot, Telegram storage is the primary retrieval method, Drive is backup only

---

## Why Shared Drives?

### Service Account Changes (April 2025)

Google announced that service accounts created after **April 15, 2025** will:
❌ NOT be able to own Drive items in "My Drive"
❌ NOT receive the 15 GB storage quota
❌ NOT be able to upload to "My Drive" without impersonation

However, service accounts CAN STILL:
✅ Upload to **Shared Drives** (no restrictions)
✅ Access Shared Drives with proper permissions
✅ Use the full storage quota of the Shared Drive

### Advantages of Shared Drives

1. **No service account restrictions** - Works with new and old service accounts
2. **Team collaboration** - Multiple people can access the same drive
3. **Larger storage** - Based on your Workspace plan (not 15 GB limit)
4. **Centralized management** - Admin controlled through Workspace
5. **Better organization** - Separate drive for bot uploads
6. **Persistent storage** - Files don't belong to any one user
7. **Easy sharing** - Share entire drive or specific folders

---

## Storage Costs

### Google Workspace Plans

| Plan | Storage | Price/User/Month |
|------|---------|------------------|
| **Business Starter** | 30 GB/user | ~$6 |
| **Business Standard** | 2 TB/user | ~$12 |
| **Business Plus** | 5 TB/user | ~$18 |
| **Enterprise** | As much as needed | Custom |

### Estimated Usage

**Average photo size:** ~100 KB (0.0001 GB)
- 1,000 photos = ~100 MB = 0.1 GB
- 10,000 photos = ~1 GB
- 100,000 photos = ~10 GB

**Example:** With 10,000 photos/month, you'll use ~1 GB/month. Business Starter (30 GB) can store ~300,000 photos.

---

## Security Best Practices

1. **Never commit service account JSON to git**
   - Already in `.gitignore`
   - Use environment variables in production

2. **Use least privilege permissions**
   - Give service account "Content manager" role (not "Manager")
   - Only shares the Shared Drive, not entire Workspace

3. **Rotate service account keys periodically**
   - Recommended: every 90-180 days
   - Create new key, update `.env`, delete old key

4. **Enable audit logging** (Workspace Admin)
   - Track who accesses files
   - Monitor service account activity
   - Review in Admin Console → Reports → Drive

5. **Set Shared Drive policies**
   - Restrict external sharing
   - Require viewer authentication
   - Prevent file downloads if needed

6. **Monitor API usage**
   - Check Google Cloud Console → APIs & Services → Dashboard
   - Set up quota alerts
   - Review API logs

---

## Migration from Existing Data

If you already have photos stored without Google Drive backup, you can backfill them:

### Option 1: Manual Script (Not implemented)

You would need to:
1. Query all photos without `driveFileId`
2. Download each from Telegram using `file_id`
3. Upload to Google Drive
4. Update database with Drive info

### Option 2: Let it happen naturally

- Old photos remain Telegram-only
- New photos (uploaded after Drive setup) automatically get Drive backup
- Both methods work fine side-by-side

---

## Disabling Google Drive (Optional)

If you don't want to use Google Drive storage, simply:

1. **Don't configure credentials** in `.env`:
   ```bash
   # Leave these empty or remove them
   GOOGLE_SERVICE_ACCOUNT_PATH=
   GOOGLE_SHARED_DRIVE_ID=
   ```

2. Bot will log: `Google Drive not configured - storage disabled`

3. Photos will only be stored using Telegram `file_id` (no Drive backup)

The bot will continue to work normally, relying entirely on Telegram's storage.

---

## Comparison: My Drive vs Shared Drive

| Feature | My Drive (Restricted) | Shared Drive (✅ Recommended) |
|---------|----------------------|-------------------------------|
| **Service account upload** | ❌ Not after April 2025 | ✅ Always works |
| **Storage quota** | 15 GB (personal) | Based on Workspace plan |
| **Team access** | Need to share individually | Everyone with access |
| **Ownership** | Belongs to service account | Belongs to organization |
| **File lifecycle** | Depends on account | Independent of users |
| **Admin control** | Limited | Full Workspace admin control |

---

## Additional Resources

- [Google Workspace Shared Drives](https://support.google.com/a/answer/7212025)
- [Service Account Documentation](https://cloud.google.com/iam/docs/service-accounts)
- [Google Drive API Documentation](https://developers.google.com/drive/api/v3/about-sdk)
- [April 2025 Service Account Changes](https://support.google.com/a/answer/14086579)

---

## Support

For issues with:
- **Google Cloud setup:** Check [Google Cloud Console](https://console.cloud.google.com/)
- **Shared Drive access:** Check [Google Workspace Admin](https://admin.google.com/)
- **Bot integration:** Check logs for detailed error messages
- **Database:** Verify migration ran successfully with `npm run migration:run`

---

**Last Updated:** 2026-03-12
**Google Drive Integration Version:** 1.0 (Shared Drive)

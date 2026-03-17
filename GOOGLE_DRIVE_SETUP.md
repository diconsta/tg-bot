# Google Drive Setup Guide

## Overview

The bot uses Google Drive to store construction stage photos. Service accounts cannot store files in their own space, so you need to set up either a **shared folder** or a **Shared Drive**.

## Current Configuration

Your `.env` file should have:
```bash
GOOGLE_SERVICE_ACCOUNT_PATH=./building-tg-bot-ad5d02731a3b.json
GOOGLE_DRIVE_FOLDER_ID=1Y4jwTfwfXDuxUZMnJuwDULNbBM2fZQzr
```

## Option 1: Shared Folder (Recommended for Personal Use)

### Steps:

1. **Get your service account email** from the JSON file:
   - Open `building-tg-bot-ad5d02731a3b.json`
   - Find the `client_email` field (e.g., `bot-account@project-id.iam.gserviceaccount.com`)

2. **Share the folder with the service account**:
   - Go to Google Drive: https://drive.google.com/drive/folders/1Y4jwTfwfXDuxUZMnJuwDULNbBM2fZQzr
   - Click the "Share" button
   - Add the service account email
   - Give it "Editor" permissions
   - Click "Send"

3. **Test the setup**:
   - Start your bot
   - Create a forum topic in the coordinator chat
   - Upload a photo
   - Check if it appears in the Google Drive folder

### .env Configuration:
```bash
GOOGLE_SERVICE_ACCOUNT_PATH=./building-tg-bot-ad5d02731a3b.json
GOOGLE_DRIVE_FOLDER_ID=1Y4jwTfwfXDuxUZMnJuwDULNbBM2fZQzr
# GOOGLE_DRIVE_IS_SHARED_DRIVE is not needed for shared folders
```

## Option 2: Shared Drive (Recommended for Organizations)

Shared Drives (formerly Team Drives) are designed for organizations and have higher storage quotas.

### Steps:

1. **Create a Shared Drive** (requires Google Workspace):
   - Go to Google Drive
   - Click "Shared drives" in the left sidebar
   - Click "New" → "New shared drive"
   - Name it (e.g., "Construction Bot Photos")
   - Click "Create"

2. **Add the service account as a member**:
   - Open the Shared Drive
   - Click "Manage members"
   - Add the service account email from your JSON file
   - Give it "Content manager" or "Manager" role
   - Click "Send"

3. **Get the Shared Drive ID**:
   - Open the Shared Drive in your browser
   - The URL will look like: `https://drive.google.com/drive/folders/SHARED_DRIVE_ID`
   - Copy the ID from the URL

4. **Update .env**:
   ```bash
   GOOGLE_SERVICE_ACCOUNT_PATH=./building-tg-bot-ad5d02731a3b.json
   GOOGLE_DRIVE_FOLDER_ID=<YOUR_SHARED_DRIVE_ID>
   GOOGLE_DRIVE_IS_SHARED_DRIVE=true
   ```

5. **Restart the bot**:
   ```bash
   npm run start:dev
   ```

## Troubleshooting

### Error: "Service Accounts do not have storage quota"

**Cause**: The service account is trying to store files in its own space.

**Solution**: Follow either Option 1 or Option 2 above to share a folder or use a Shared Drive.

### Error: "File not found" or "Insufficient permissions"

**Cause**: The service account doesn't have access to the folder.

**Solutions**:
1. Verify you shared the folder with the correct service account email
2. Check the service account has "Editor" permissions
3. Verify the folder ID in `.env` is correct
4. If using Shared Drive, ensure `GOOGLE_DRIVE_IS_SHARED_DRIVE=true` is set

### How to find the service account email

Open your `building-tg-bot-ad5d02731a3b.json` file and look for:
```json
{
  "client_email": "your-service-account@project-id.iam.gserviceaccount.com"
}
```

### Verify folder ID

The folder ID is in the Google Drive URL:
- URL: `https://drive.google.com/drive/folders/1Y4jwTfwfXDuxUZMnJuwDULNbBM2fZQzr`
- Folder ID: `1Y4jwTfwfXDuxUZMnJuwDULNbBM2fZQzr`

## Testing

After setup, you can test the integration:

1. Start the bot:
   ```bash
   npm run start:dev
   ```

2. In your Telegram coordinator chat, create a new forum topic (this creates a new object)

3. Upload a photo to the forum topic

4. Check the bot logs for success messages:
   ```
   [GoogleDriveService] Created folder "ObjectName" with ID: xxx
   [GoogleDriveService] Created folder "Stage_1_Demontaż" with ID: yyy
   [GoogleDriveService] Uploaded photo "ObjectName_Stage1_timestamp.jpg" with ID: zzz
   ```

5. Verify the folder structure in Google Drive:
   ```
   Root Folder (or Shared Drive)
   └── ObjectName/
       ├── Stage_1_Demontaż/
       ├── Stage_2_Instalacje/
       ├── Stage_3_Tynki / gładzie/
       ├── Stage_4_Płytki/
       ├── Stage_5_Malowanie/
       └── Stage_6_Biały montaż/
   ```

## Security Notes

- Keep your `building-tg-bot-ad5d02731a3b.json` file secure
- Add it to `.gitignore` to prevent committing to version control
- Never share the JSON file publicly
- If compromised, revoke the service account key from Google Cloud Console and generate a new one

# AWS S3 Storage Integration - Setup Guide

## Overview
The bot now supports automatic backup of photos to AWS S3 storage. When users upload photos via Telegram, the bot will:
1. Store the Telegram `file_id` (for fast retrieval from Telegram)
2. Download the photo from Telegram
3. Upload it to your S3 bucket
4. Store the S3 URL and path in the database

This provides a permanent backup independent of Telegram's storage.

---

## S3 Folder Structure

Photos are organized in S3 with the following structure:

```
s3://your-bucket-name/
  └── objects/                          # Base folder (configurable)
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

## AWS Setup

### 1. Create an S3 Bucket

1. Go to [AWS S3 Console](https://console.aws.amazon.com/s3/)
2. Click "Create bucket"
3. Choose a unique bucket name (e.g., `tg-building-bot-photos`)
4. Select your preferred region (e.g., `us-east-1` or `eu-central-1`)
5. **Block Public Access settings:**
   - Keep "Block all public access" **ENABLED** (photos should be private)
6. **Bucket Versioning:** Optional (recommended for backup)
7. Click "Create bucket"

### 2. Create IAM User with S3 Access

1. Go to [AWS IAM Console](https://console.aws.amazon.com/iam/)
2. Click "Users" → "Add users"
3. Username: `tg-building-bot-s3`
4. Access type: Select "Access key - Programmatic access"
5. Click "Next: Permissions"

### 3. Attach IAM Policy

Create a custom policy for this user:

1. Click "Attach policies directly"
2. Click "Create policy"
3. Switch to JSON tab and paste:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:PutObjectAcl",
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::tg-building-bot-photos",
        "arn:aws:s3:::tg-building-bot-photos/*"
      ]
    }
  ]
}
```

**Replace** `tg-building-bot-photos` with your actual bucket name.

4. Click "Next: Tags" → "Next: Review"
5. Name: `TG-Building-Bot-S3-Access`
6. Click "Create policy"
7. Go back to user creation, refresh policies, and attach your new policy
8. Click "Next: Tags" → "Next: Review" → "Create user"

### 4. Save Access Keys

1. After creating the user, you'll see:
   - **Access key ID**: `AKIAIOSFODNN7EXAMPLE`
   - **Secret access key**: `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`

2. **IMPORTANT:** Save these credentials securely - you won't be able to see the secret key again!

---

## Bot Configuration

### 1. Update `.env` File

Add the following configuration to your `.env` file:

```bash
# AWS S3 Configuration
AWS_REGION=us-east-1                              # Your bucket's region
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE            # Your IAM user access key
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG...    # Your IAM user secret key
S3_BUCKET_NAME=tg-building-bot-photos             # Your bucket name
S3_BASE_FOLDER=objects                            # Base folder inside bucket
```

**Configuration details:**

- `AWS_REGION`: The AWS region where your bucket is located
  - Examples: `us-east-1`, `eu-central-1`, `ap-southeast-1`
  - Find this in your S3 bucket properties

- `AWS_ACCESS_KEY_ID`: The access key from step 4 above

- `AWS_SECRET_ACCESS_KEY`: The secret access key from step 4 above

- `S3_BUCKET_NAME`: The exact name of your S3 bucket

- `S3_BASE_FOLDER`: Base folder path (default: `objects`)
  - All photos will be stored under this folder
  - Can be changed to organize differently (e.g., `photos`, `backups`, etc.)

### 2. Run Database Migration

Apply the migration to add S3 fields to the database:

```bash
npm run migration:run
```

This adds three new columns to the `stage_photos` table:
- `s3Key`: The full S3 object key (path)
- `s3Url`: The full HTTPS URL to access the photo
- `s3Bucket`: The bucket name

### 3. Restart the Bot

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
3. **Bot checks** if S3 is enabled (credentials configured)
4. **If S3 enabled:**
   - Downloads photo from Telegram as Buffer
   - Generates filename: `photo_<timestamp>_<index>.jpg`
   - Builds S3 key: `objects/Building A - Warsaw/Stage 1 - Demontaż/photo_123.jpg`
   - Uploads to S3 using AWS SDK
   - Stores both Telegram `file_id` AND S3 info in database
5. **If S3 disabled or upload fails:**
   - Only stores Telegram `file_id` (fallback)
   - Bot continues to work normally using Telegram storage

### Database Storage

Each photo record stores:

```typescript
{
  id: "uuid",
  objectId: "uuid",
  stageId: "uuid",
  telegramFileId: "AgACAgIAAxkB...",      // Telegram file ID
  telegramFileUniqueId: "AQADwzM...",     // Telegram unique ID
  fileName: "photo_1234567890_1.jpg",     // Generated filename
  fileSize: 125634,                        // File size in bytes
  s3Key: "objects/Building A/Stage 1/photo_1234567890_1.jpg",  // S3 path
  s3Url: "https://bucket.s3.amazonaws.com/objects/...",        // Full URL
  s3Bucket: "tg-building-bot-photos",                          // Bucket name
  createdAt: "2026-03-12T10:30:00Z"
}
```

---

## Disabling S3 (Optional)

If you don't want to use S3 storage, simply:

1. **Don't configure AWS credentials** in `.env`:
   ```bash
   # Leave these empty or remove them
   AWS_ACCESS_KEY_ID=
   AWS_SECRET_ACCESS_KEY=
   ```

2. Bot will log: `AWS credentials not configured - S3 storage disabled`

3. Photos will only be stored using Telegram `file_id` (no S3 backup)

The bot will continue to work normally, relying entirely on Telegram's storage.

---

## Testing S3 Integration

### 1. Check Bot Startup Logs

After starting the bot with S3 credentials, you should see:

```
[S3StorageService] S3 storage initialized: bucket=tg-building-bot-photos, region=us-east-1
```

If you see this warning instead:
```
[S3StorageService] AWS credentials not configured - S3 storage disabled
```
Check your `.env` configuration.

### 2. Upload a Test Photo

1. Go to any object thread in your Telegram coordinator chat
2. Click "📷 Add stage photos"
3. Upload a photo
4. Check the logs for:
   ```
   [TelegramUpdateHandler] Photo uploaded to S3: objects/Building A - Warsaw/Stage 1 - Demontaż/photo_1234567890_1.jpg
   ```

### 3. Verify in S3 Console

1. Go to [AWS S3 Console](https://console.aws.amazon.com/s3/)
2. Open your bucket: `tg-building-bot-photos`
3. Navigate to: `objects/<object-name>/<stage-name>/`
4. You should see your uploaded photo files

### 4. Check Database

Query the database to verify S3 fields are populated:

```sql
SELECT
  "fileName",
  "s3Key",
  "s3Url",
  "s3Bucket",
  "telegramFileId"
FROM "stage_photos"
ORDER BY "createdAt" DESC
LIMIT 5;
```

You should see S3 fields filled in for new photos.

---

## Troubleshooting

### Error: "S3 client not initialized"

**Cause:** AWS credentials not properly configured

**Solution:**
1. Check `.env` has correct `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`
2. Restart the bot
3. Verify logs show: `S3 storage initialized`

### Error: "Access Denied" or "403 Forbidden"

**Cause:** IAM user doesn't have permission to upload to bucket

**Solution:**
1. Check IAM policy is attached to user
2. Verify bucket name in policy matches your actual bucket
3. Ensure policy includes `s3:PutObject` action

### Error: "The specified bucket does not exist"

**Cause:** Bucket name in `.env` doesn't match actual bucket name

**Solution:**
1. Go to S3 console and copy exact bucket name
2. Update `S3_BUCKET_NAME` in `.env`
3. Restart bot

### Photos upload to Telegram but not S3

**Cause:** S3 upload failed, but bot continues with Telegram-only storage

**Solution:**
1. Check bot logs for error messages starting with:
   ```
   [TelegramUpdateHandler] Failed to upload photo to S3: <error details>
   ```
2. Investigate the specific error
3. Common issues:
   - Invalid credentials
   - Incorrect region
   - Network connectivity
   - Bucket permissions

### S3 URLs not accessible

**Cause:** Bucket has "Block all public access" enabled (this is intentional)

**Solution:**
- S3 URLs are stored for **internal reference only**
- To access photos, use Telegram `file_id` (bot can retrieve from Telegram)
- Or configure S3 bucket policies / pre-signed URLs if you need direct access
- For this bot, Telegram storage is the primary retrieval method, S3 is backup only

---

## Cost Estimation

### S3 Storage Costs (Example: US East N. Virginia - us-east-1)

**Storage:**
- $0.023 per GB/month for standard storage
- Average photo size: ~100 KB (0.0001 GB)
- 1000 photos = ~100 MB = 0.1 GB = **$0.0023/month**

**Uploads (PUT requests):**
- $0.005 per 1,000 PUT requests
- 1000 photo uploads = **$0.005**

**Data Transfer:**
- Upload to S3: **FREE**
- Download from S3: $0.09 per GB (usually not needed for this bot)

**Example monthly cost for 10,000 photos/month:**
- Storage: 1 GB × $0.023 = **$0.023**
- PUT requests: 10,000 × $0.005/1000 = **$0.050**
- **Total: ~$0.073/month** (less than 10 cents!)

### Free Tier (First 12 months)

AWS offers a generous free tier:
- 5 GB of S3 storage
- 20,000 GET requests
- 2,000 PUT requests
- 100 GB data transfer out

For most use cases, you'll stay within free tier limits.

---

## Security Best Practices

1. **Never commit `.env` to git**
   - Already in `.gitignore`
   - Use environment variables in production

2. **Use IAM user with minimum permissions**
   - Only grant `PutObject`, `GetObject`, `ListBucket`
   - Don't use root AWS account credentials

3. **Rotate access keys periodically**
   - Recommended: every 90 days
   - Create new key, update `.env`, delete old key

4. **Enable bucket versioning** (optional)
   - Protects against accidental deletion
   - Allows recovery of previous versions

5. **Enable S3 server-side encryption** (optional)
   - Encrypt photos at rest
   - Enable in bucket properties → "Default encryption"

6. **Monitor S3 access logs** (optional)
   - Track who accesses your bucket
   - Enable in bucket properties → "Server access logging"

---

## Migration from Existing Data

If you already have photos stored without S3 backup, you can backfill them:

### Option 1: Manual Script (Not implemented)

You would need to:
1. Query all photos without `s3Key`
2. Download each from Telegram using `file_id`
3. Upload to S3
4. Update database with S3 info

### Option 2: Let it happen naturally

- Old photos remain Telegram-only
- New photos (uploaded after S3 setup) automatically get S3 backup
- Both methods work fine side-by-side

---

## Support

For issues with:
- **AWS S3/IAM:** Check [AWS Documentation](https://docs.aws.amazon.com/s3/)
- **Bot integration:** Check logs for detailed error messages
- **Database:** Verify migration ran successfully

---

**Last Updated:** 2026-03-12
**S3 Integration Version:** 1.0

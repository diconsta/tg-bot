# Telegram Bot - User Flow Documentation

## Overview
This bot manages construction project stages through Telegram forum topics. Each forum topic represents a construction object, and users progress through 6 predefined stages by uploading photos and completing tasks.

---

## Table of Contents
1. [Initial Setup & Object Creation](#1-initial-setup--object-creation)
2. [Photo Upload Workflow](#2-photo-upload-workflow)
3. [Stage Completion](#3-stage-completion)
4. [Viewing Photos](#4-viewing-photos)
5. [Pause & Resume](#5-pause--resume)
6. [Daily Reminders](#6-daily-reminders)
7. [Admin Commands](#7-admin-commands)
8. [Button Reference](#8-button-reference)

---

## 1. Initial Setup & Object Creation

### Creating a New Object
**Trigger:** Admin creates a new forum topic in the coordinator chat

**Flow:**
1. Admin creates a forum topic with the object name (e.g., "Building A - Warsaw")
2. Bot automatically detects `forum_topic_created` event
3. Bot creates a new object in the database with:
   - Object name = forum topic name
   - Status = `IN_PROGRESS`
   - All 6 master stages assigned to the object
   - First stage set as current stage

4. Bot sends welcome message:
```
🏗 New Object Created

Object: Building A - Warsaw
Stage: 1 — Demontaż

Use the buttons below to manage this object.
```

**Buttons displayed:**
- `📷 Add stage photos` - Upload photos for current stage
- `📸 View photos` - View photos from any completed stage
- `✅ Complete stage` - Mark current stage as complete
- `⏸ Pause` - Pause reminders for this object

---

## 2. Photo Upload Workflow

### Starting Photo Upload
**Trigger:** User clicks `📷 Add stage photos` button

**Requirements:**
- User must be assigned to this object (or be a superadmin)
- Object must have an active current stage

**Flow:**
1. User clicks `📷 Add stage photos`
2. Bot checks current photo count vs maximum allowed (default: 10 photos per stage)
3. Bot creates a user session for photo upload
4. Bot sends instruction message:
```
📷 Please send photos for stage 1: Demontaż.

Current: 0/10
Minimum required: 3

You can send multiple photos as an album or one by one. Click "Done" when finished.
```

**Buttons displayed:**
- `✅ Done adding photos` - End photo upload session

### Uploading Photos

**Single Photo Upload:**
1. User sends a single photo
2. Bot saves photo to database with Telegram `file_id`
3. Bot sends confirmation:
```
✅ Added 1 photo(s). Total: 1/10
⚠ Need at least 2 more photo(s) to complete stage.

💡 You can continue adding more photos or use the buttons below.
```

**Album Upload (Media Group):**
1. User sends multiple photos as an album (up to 10 photos)
2. Bot collects all photos from the media group (1-second timeout)
3. Bot saves all photos in a batch
4. Bot sends confirmation:
```
✅ Added 5 photo(s). Total: 5/10
✓ Minimum photos requirement met. You can complete the stage.

💡 You can continue adding more photos or use the buttons below.
```

**Session Behavior:**
- Session remains active until user clicks "Done" or completes stage
- User can upload photos one-by-one or as albums
- User can leave and come back - session persists
- Maximum 10 photos per stage (configurable via `MAX_PHOTOS_PER_STAGE`)

### Ending Photo Upload Session
**Trigger:** User clicks `✅ Done adding photos`

**Flow:**
1. Bot clears the user session
2. Bot sends confirmation:
```
✅ Photo upload session ended. Total photos: 5

Use the buttons below to continue.
```

**Buttons displayed:** (Standard stage action buttons)
- `📷 Add stage photos`
- `📸 View photos`
- `✅ Complete stage`
- `⏸ Pause`

---

## 3. Stage Completion

### Completing Current Stage
**Trigger:** User clicks `✅ Complete stage` button

**Requirements:**
- User must be assigned to this object (or be a superadmin)
- Minimum photos requirement must be met (default: 3 photos)

**Flow - Success (Not Final Stage):**
1. User clicks `✅ Complete stage`
2. Bot validates minimum photos (3 required by default)
3. Bot marks current stage as completed in database
4. Bot records stage completion in history
5. Bot finds next incomplete stage by `orderNo`
6. Bot updates object's `currentStageId` to next stage
7. Bot clears any active photo upload session
8. Bot sends progression message:
```
✅ Stage 1: Demontaż completed!

🔄 Moving to Stage 2: Instalacje
```

**Buttons displayed:** (Standard stage action buttons for new stage)
- `📷 Add stage photos`
- `📸 View photos`
- `✅ Complete stage`
- `⏸ Pause`

**Flow - Success (Final Stage):**
1. Same as above, but after completing the 6th stage:
2. Bot sets object status to `DONE`
3. Bot sets `currentStageId` to `null`
4. Bot sends completion message:
```
🎉 Congratulations!

All stages completed for: Building A - Warsaw

Stage 6: Odbiór was the final stage.

The object is now marked as DONE.
```

**No buttons displayed** - Object is complete

**Flow - Failure (Not Enough Photos):**
1. User clicks `✅ Complete stage`
2. Bot validates photos: only 2 photos uploaded (need 3)
3. Bot sends error message:
```
❌ Cannot complete stage. You need at least 3 photos. Current: 2
```

**No stage progression occurs**

---

## 4. Viewing Photos

### Opening Stage Selection
**Trigger:** User clicks `📸 View photos` button

**Flow:**
1. Bot sends processing message: `⏳ Loading stage list...`
2. Bot fetches all 6 master stages from database
3. Bot counts photos for each stage in this object
4. Bot deletes processing message
5. Bot sends stage selection menu:
```
📸 Select a stage to view photos:
```

**Buttons displayed (6 buttons, one per stage):**
- `1. Demontaż (5 photos)`
- `2. Instalacje (0 photos)`
- `3. Tynki (0 photos)`
- `4. Wykończenie (0 photos)`
- `5. Sanitarne (0 photos)`
- `6. Odbiór (0 photos)`

### Viewing Stage Photos
**Trigger:** User clicks a stage button (e.g., `1. Demontaż (5 photos)`)

**Flow - Stage Has Photos:**
1. Bot sends processing message: `⏳ Loading photos...`
2. Bot fetches all photos for selected stage
3. Bot deletes processing message
4. Bot sends header message:
```
📸 Photos for Demontaż (5 total):
```

5. Bot sends photos in batches:
   - **Single photo:** Sent as individual photo with caption `Photo 1/5`
   - **2-10 photos:** Sent as media group with caption `Photos 1-5/5`
   - **11+ photos:** Sent in multiple batches (10 photos per batch) with 500ms delay between batches

**Example output:**
- Message: `📸 Photos for Demontaż (5 total):`
- Media group with 5 photos and caption: `Photos 1-5/5`

**Flow - Stage Has No Photos:**
1. Bot sends processing message: `⏳ Loading photos...`
2. Bot deletes processing message
3. Bot sends message:
```
No photos found for stage: Demontaż
```

---

## 5. Pause & Resume

### Pausing an Object
**Trigger:** User clicks `⏸ Pause` button

**Purpose:** Temporarily stop daily reminders for this object

**Flow:**
1. User clicks `⏸ Pause`
2. Bot sets object `isPaused` flag to `true`
3. Bot records pause action in history
4. Bot sends confirmation:
```
⏸ Object paused. Daily reminders will not be sent until resumed.
```

**Buttons displayed:**
- `▶️ Resume` - Only this button is shown when paused

### Resuming an Object
**Trigger:** User clicks `▶️ Resume` button

**Flow:**
1. User clicks `▶️ Resume`
2. Bot sets object `isPaused` flag to `false`
3. Bot records resume action in history
4. Bot sends confirmation:
```
▶️ Object resumed. Daily reminders will continue.
```

**Buttons displayed:** (Standard stage action buttons)
- `📷 Add stage photos`
- `📸 View photos`
- `✅ Complete stage`
- `⏸ Pause`

---

## 6. Daily Reminders

### Automatic Reminder System
**Schedule:** Daily at time configured in `.env` (default: `REMINDER_TIME=12:20`)

**Timezone:** Configured in `.env` (default: `REMINDER_TIMEZONE=Europe/Warsaw`)

**Eligibility:**
An object receives a reminder if ALL conditions are met:
1. Object status is `IN_PROGRESS` (not `DONE` or `ARCHIVED`)
2. Object is NOT paused (`isPaused = false`)
3. Object has a current stage (`currentStageId` is not null)
4. Last reminder was sent more than 24 hours ago (or never sent)

**Reminder Message:**
```
📅 Daily Reminder

Object: Building A - Warsaw
Current stage: 2 — Instalacje

Don't forget to upload photos and complete the stage!
```

**Buttons displayed:** (Standard stage action buttons)
- `📷 Add stage photos`
- `📸 View photos`
- `✅ Complete stage`
- `⏸ Pause`

**After Sending:**
- Bot updates object's `lastPromptAt` timestamp to current time
- Next reminder won't be sent for 24 hours

**Error Handling:**
- If message fails to send (e.g., topic deleted), bot logs error but continues with other objects
- Does not retry failed reminders

---

## 7. Admin Commands

### Prerequisites
- User must be a **superadmin** (listed in `TELEGRAM_SUPERADMIN_IDS` in `.env`)
- OR user must have `ADMIN` role in the coordinators table

### Available Commands

#### `/help_admin`
Shows admin help menu with all available commands

**Response:**
```
🔧 Admin Commands

Coordinator Management:
/assign @username object_name - Assign coordinator to object
/unassign @username object_name - Remove assignment
/promote @username ROLE - Change coordinator role
/list_coordinators - List all coordinators
/coordinators object_name - Show coordinators for object

Roles:
• ADMIN - Can manage everything
• COORDINATOR - Can manage assigned objects
• VIEWER - Read-only access

Notes:
• Users must interact with bot before assignment
• Use partial object names for matching
• Only admins can use these commands
```

#### `/assign @username object_name`
Assigns a coordinator to manage a specific object

**Example:**
```
/assign @john Building A
```

**Requirements:**
- User `@john` must have interacted with the bot first (sent any message)
- Object "Building A" must exist (partial name matching)

**Response (Success):**
```
✅ Assigned @john to "Building A - Warsaw"
```

**Response (User Not Found):**
```
❌ Coordinator @john not found. Ask them to interact with the bot first.
```

#### `/unassign @username object_name`
Removes coordinator assignment from an object

**Example:**
```
/unassign @john Building A
```

**Response (Success):**
```
✅ Unassigned @john from "Building A - Warsaw"
```

#### `/promote @username ROLE`
Changes a coordinator's role

**Example:**
```
/promote @john ADMIN
```

**Available Roles:**
- `ADMIN` - Full access to all objects and admin commands
- `COORDINATOR` - Can manage assigned objects
- `VIEWER` - Read-only access to assigned objects

**Response (Success):**
```
✅ Promoted @john to ADMIN
```

#### `/list_coordinators`
Shows all coordinators in the system

**Response:**
```
📋 Coordinators List

✅ @john
   Role: ADMIN
   Objects: 3
   Status: Active

✅ @mary
   Role: COORDINATOR
   Objects: 1
   Status: Active

❌ @bob
   Role: VIEWER
   Objects: 0
   Status: Inactive
```

#### `/coordinators object_name`
Shows coordinators assigned to a specific object

**Example:**
```
/coordinators Building A
```

**Response:**
```
📋 Coordinators for "Building A - Warsaw"

• @john (ADMIN)
• @mary (COORDINATOR)
```

---

## 8. Button Reference

### Standard Stage Action Buttons (Active Object)
Displayed when object is in progress and not paused:

| Button | Callback Data | Description |
|--------|---------------|-------------|
| 📷 Add stage photos | `action:add_photos` | Start photo upload session for current stage |
| 📸 View photos | `action:view_photos` | Open stage selection to view photos |
| ✅ Complete stage | `action:complete_stage` | Mark current stage as complete and progress to next |
| ⏸ Pause | `action:pause` | Pause reminders for this object |

### Paused Object Buttons
Displayed when object is paused:

| Button | Callback Data | Description |
|--------|---------------|-------------|
| ▶️ Resume | `action:resume` | Resume reminders for this object |

### Photo Upload Session Buttons
Displayed during photo upload session:

| Button | Callback Data | Description |
|--------|---------------|-------------|
| ✅ Done adding photos | `action:done_photos` | End photo upload session |

### View Photos - Stage Selection Buttons
Displayed when user clicks "View photos":

| Button | Callback Data | Description |
|--------|---------------|-------------|
| 1. Demontaż (5 photos) | `view_stage:1` | View photos for stage 1 |
| 2. Instalacje (0 photos) | `view_stage:2` | View photos for stage 2 |
| 3. Tynki (0 photos) | `view_stage:3` | View photos for stage 3 |
| 4. Wykończenie (0 photos) | `view_stage:4` | View photos for stage 4 |
| 5. Sanitarne (0 photos) | `view_stage:5` | View photos for stage 5 |
| 6. Odbiór (0 photos) | `view_stage:6` | View photos for stage 6 |

---

## Authorization & Permissions

### Superadmin
- Configured in `.env`: `TELEGRAM_SUPERADMIN_IDS=572536794,123456789`
- Can manage ALL objects regardless of assignments
- Can use all admin commands
- Bypasses all coordinator checks

### Admin Role
- Set via `/promote @username ADMIN` command
- Can manage all objects they're assigned to
- Can use admin commands
- Cannot override superadmin restrictions

### Coordinator Role
- Default role when user first interacts with bot
- Can manage objects they're assigned to
- Cannot use admin commands
- Cannot manage other coordinators

### Viewer Role
- Read-only access
- Can view photos but cannot add/complete stages
- Cannot use admin commands

### Permission Checks
Every button action checks:
1. Is user a superadmin? → Allow all actions
2. Is user assigned to this object? → Check role
3. Does role allow this action? → Allow/Deny

**Denied actions show:**
```
❌ You are not authorized to manage this object
```

---

## Error Handling

### Common Errors

#### "Message thread not found"
**Cause:** User clicks button from a deleted/closed forum topic

**Handling:** Bot logs warning and silently ignores (no error message to user)

#### "Query is too old"
**Cause:** User clicks button from a message sent >48 hours ago

**Handling:** Bot logs warning and silently ignores (no error message to user)

#### "Cannot complete stage - not enough photos"
**Cause:** User tries to complete stage with less than minimum photos

**Response:**
```
❌ Cannot complete stage. You need at least 3 photos. Current: 2
```

#### "Maximum photos reached"
**Cause:** User tries to upload more than 10 photos to a stage

**Response:**
```
❌ Cannot add 5 photos. Maximum 10 photos per stage. You currently have 8 photos.
```

#### "No active stage"
**Cause:** Object is marked as DONE or has no current stage

**Response:**
```
❌ No active stage for this object.
```

---

## Configuration (.env)

```bash
# Reminder schedule
REMINDER_TIME=12:20                    # Time to send daily reminders (24h format)
REMINDER_TIMEZONE=Europe/Warsaw        # Timezone for scheduler
STALLED_STAGE_DAYS=7                   # Days before stage is considered stalled

# Photos
MIN_PHOTOS_PER_STAGE=3                 # Minimum photos required to complete stage
MAX_PHOTOS_PER_STAGE=10                # Maximum photos allowed per stage

# Superadmins (comma-separated Telegram user IDs)
TELEGRAM_SUPERADMIN_IDS=572536794

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_COORDINATOR_CHAT_ID=-1003822921168  # Forum chat ID
```

---

## Database Entities

### Object Statuses
- `IN_PROGRESS` - Object is active, stages being completed
- `DONE` - All stages completed
- `ARCHIVED` - Object archived, no longer active

### Master Stages (6 stages)
1. **Demontaż** (Demolition) - Order: 1
2. **Instalacje** (Installations) - Order: 2
3. **Tynki** (Plastering) - Order: 3
4. **Wykończenie** (Finishing) - Order: 4
5. **Sanitarne** (Sanitary) - Order: 5
6. **Odbiór** (Acceptance) - Order: 6

### Object Stages (Junction Table)
Links objects to master stages with completion status:
- `objectId` - Reference to object
- `stageId` - Reference to master stage
- `isCompleted` - Boolean flag
- `completedAt` - Timestamp when completed

### Stage Photos
Stores Telegram file IDs for uploaded photos:
- `telegramFileId` - Telegram's file_id for retrieval
- `telegramFileUniqueId` - Unique identifier
- `fileName` - Optional filename
- `fileSize` - File size in bytes

---

## Flow Diagrams

### Object Lifecycle
```
Forum Topic Created
    ↓
Object Created (Status: IN_PROGRESS)
    ↓
Stage 1 → Upload Photos → Complete Stage
    ↓
Stage 2 → Upload Photos → Complete Stage
    ↓
Stage 3 → Upload Photos → Complete Stage
    ↓
Stage 4 → Upload Photos → Complete Stage
    ↓
Stage 5 → Upload Photos → Complete Stage
    ↓
Stage 6 → Upload Photos → Complete Stage
    ↓
Object Complete (Status: DONE)
```

### Photo Upload Session
```
Click "📷 Add stage photos"
    ↓
Session Created (State: AWAITING_PHOTOS)
    ↓
User sends photo(s)
    ↓
Photos saved to database
    ↓
Confirmation sent
    ↓
Session remains active
    ↓
User can:
  - Send more photos (loop back)
  - Click "✅ Done adding photos" (end session)
  - Click "✅ Complete stage" (end session + progress)
```

### Daily Reminder Check
```
Cron job runs at REMINDER_TIME
    ↓
Load all objects WHERE:
  - status = IN_PROGRESS
  - isPaused = false
  - currentStageId != null
  - lastPromptAt < NOW() - 24 hours
    ↓
For each eligible object:
  - Send reminder message
  - Update lastPromptAt timestamp
    ↓
Job complete
```

---

## Notes & Best Practices

1. **Photo Upload Sessions:**
   - Always click "Done adding photos" when finished to properly close the session
   - Sessions persist until explicitly closed

2. **Stage Completion:**
   - Ensure minimum photos requirement is met before completing
   - Cannot undo stage completion (no rollback feature)

3. **Permissions:**
   - Coordinators must be assigned to objects before they can manage them
   - Superadmins have unrestricted access

4. **Reminders:**
   - Use pause feature for objects on hold to prevent reminder spam
   - Reminders automatically resume after unpausing

5. **Error Recovery:**
   - If bot encounters an error, try the action again
   - Old buttons (>48 hours) won't work - use newer messages

6. **Performance:**
   - Large photo batches (10+) are sent with delays to avoid rate limiting
   - Processing messages shown for operations >1 second

---

## Support & Troubleshooting

### Bot not responding?
1. Check bot is running and polling
2. Verify user has permission to manage object
3. Check logs for errors

### Photos not uploading?
1. Ensure you clicked "Add stage photos" first
2. Check you haven't exceeded 10 photos limit
3. Verify photo file size is supported by Telegram

### Reminders not working?
1. Check `.env` has correct `REMINDER_TIME` and `REMINDER_TIMEZONE`
2. Verify object is not paused
3. Check `lastPromptAt` timestamp in database
4. Look for scheduler errors in logs

### Stage not progressing?
1. Verify minimum photos requirement is met
2. Check object has next stage available
3. Check logs for stage progression errors

---

**Last Updated:** 2026-03-10
**Bot Version:** 1.0
**Documentation Version:** 1.0

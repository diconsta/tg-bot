# Service API Documentation

Complete API reference for all services in the application.

## ObjectsService

Manages construction objects (repair/building projects).

### Methods

#### `create(createObjectDto: CreateObjectDto): Promise<ObjectEntity>`

Creates a new object with initial state.

**Parameters:**
- `createObjectDto`:
  - `telegramChatId` (string): Telegram group chat ID
  - `telegramThreadId` (string): Forum topic thread ID
  - `name` (string): Object name from topic

**Returns:** Created `ObjectEntity` with:
- `currentStage`: 1
- `paused`: false
- `status`: ACTIVE

**Example:**
```typescript
const object = await objectsService.create({
  telegramChatId: '-1001234567890',
  telegramThreadId: '12345',
  name: 'Green City Apartment',
});
```

---

#### `findById(id: string): Promise<ObjectEntity>`

Finds object by ID with relations loaded.

**Parameters:**
- `id` (string): Object UUID

**Returns:** `ObjectEntity` with `stages`, `photos`, `history` relations

**Throws:** `NotFoundException` if not found

---

#### `findByTelegramIds(chatId: string, threadId: string): Promise<ObjectEntity | null>`

Finds object by Telegram identifiers.

**Parameters:**
- `chatId` (string): Telegram chat ID
- `threadId` (string): Thread ID

**Returns:** `ObjectEntity` or `null` if not found

---

#### `findActiveObjects(): Promise<ObjectEntity[]>`

Gets all active, non-paused objects.

**Query:**
- `paused` = false
- `status` ≠ DONE

**Returns:** Array of `ObjectEntity`

---

#### `findObjectsForReminder(): Promise<ObjectEntity[]>`

Gets objects that need daily reminders.

**Query:**
- `paused` = false
- `status` ≠ DONE
- `lastPromptAt` is null OR < today

**Returns:** Array of `ObjectEntity`

---

#### `findStalledStages(stalledDays: number): Promise<ObjectEntity[]>`

Finds objects with stages stalled for X days.

**Parameters:**
- `stalledDays` (number): Number of days threshold

**Query:**
- `paused` = false
- `status` = ACTIVE
- Current stage not completed
- Stage created > X days ago

**Returns:** Array of `ObjectEntity`

---

#### `updateLastPromptAt(id: string): Promise<void>`

Updates last reminder timestamp.

**Parameters:**
- `id` (string): Object UUID

**Side Effects:** Sets `lastPromptAt` to current timestamp

---

#### `progressToNextStage(id: string, totalStages: number): Promise<ObjectEntity>`

Progresses object to next stage or marks as DONE.

**Parameters:**
- `id` (string): Object UUID
- `totalStages` (number): Total number of stages

**Logic:**
- If `currentStage >= totalStages`: Set `status` = DONE
- Else: Increment `currentStage`

**Returns:** Updated `ObjectEntity`

---

#### `togglePause(id: string): Promise<ObjectEntity>`

Toggles pause state.

**Parameters:**
- `id` (string): Object UUID

**Returns:** Updated `ObjectEntity` with toggled `paused` value

---

#### `updateStatus(id: string, status: ObjectStatus): Promise<ObjectEntity>`

Updates object status.

**Parameters:**
- `id` (string): Object UUID
- `status` (ObjectStatus): ACTIVE | DONE | ARCHIVED

**Returns:** Updated `ObjectEntity`

---

## StagesService

Manages construction stages for objects.

### Methods

#### `createStagesForObject(objectId: string, stageNames: string[]): Promise<StageEntity[]>`

Creates all stages for a new object.

**Parameters:**
- `objectId` (string): Object UUID
- `stageNames` (string[]): Array of stage names

**Returns:** Array of created `StageEntity`

**Example:**
```typescript
const stages = await stagesService.createStagesForObject(
  objectId,
  ['Preparation', 'Rough construction', 'Engineering', 'Finishing', 'Final check']
);
```

---

#### `findByObjectAndStage(objectId: string, stageNumber: number): Promise<StageEntity>`

Finds a specific stage.

**Parameters:**
- `objectId` (string): Object UUID
- `stageNumber` (number): Stage number (1-based)

**Returns:** `StageEntity`

**Throws:** `NotFoundException` if not found

---

#### `findByObject(objectId: string): Promise<StageEntity[]>`

Gets all stages for an object.

**Parameters:**
- `objectId` (string): Object UUID

**Returns:** Array of `StageEntity` ordered by stage number

---

#### `completeStage(objectId: string, stageNumber: number): Promise<StageEntity>`

Marks a stage as completed.

**Parameters:**
- `objectId` (string): Object UUID
- `stageNumber` (number): Stage number

**Side Effects:**
- Sets `isCompleted` = true
- Sets `completedAt` = current timestamp

**Returns:** Updated `StageEntity`

---

#### `isStageCompleted(objectId: string, stageNumber: number): Promise<boolean>`

Checks if stage is completed.

**Parameters:**
- `objectId` (string): Object UUID
- `stageNumber` (number): Stage number

**Returns:** `boolean`

---

#### `getCurrentStageName(objectId: string, stageNumber: number): Promise<string>`

Gets name of a stage.

**Parameters:**
- `objectId` (string): Object UUID
- `stageNumber` (number): Stage number

**Returns:** Stage name as string

---

## PhotosService

Manages stage photos with Google Drive integration.

### Methods

#### `addPhoto(objectId: string, stageNumber: number, driveFileId: string, driveUrl: string): Promise<StagePhotoEntity>`

Adds a photo record to database.

**Parameters:**
- `objectId` (string): Object UUID
- `stageNumber` (number): Stage number
- `driveFileId` (string): Google Drive file ID
- `driveUrl` (string): Public URL

**Validation:**
- Checks photo count < MAX_PHOTOS_PER_STAGE

**Throws:** `BadRequestException` if limit exceeded

**Returns:** Created `StagePhotoEntity`

---

#### `addMultiplePhotos(objectId: string, objectName: string, stageNumber: number, photoBuffers: Buffer[]): Promise<StagePhotoEntity[]>`

Uploads and saves multiple photos.

**Parameters:**
- `objectId` (string): Object UUID
- `objectName` (string): Object name for folder lookup
- `stageNumber` (number): Stage number
- `photoBuffers` (Buffer[]): Array of photo buffers

**Process:**
1. Validates total count won't exceed max
2. Gets stage folder ID from Drive
3. Uploads each photo to Drive
4. Saves database records

**Throws:** `BadRequestException` if limit exceeded

**Returns:** Array of created `StagePhotoEntity`

**Example:**
```typescript
const photos = await photosService.addMultiplePhotos(
  objectId,
  'Green City Apartment',
  2,
  [buffer1, buffer2, buffer3]
);
```

---

#### `countPhotosForStage(objectId: string, stageNumber: number): Promise<number>`

Counts photos for a stage.

**Parameters:**
- `objectId` (string): Object UUID
- `stageNumber` (number): Stage number

**Returns:** Count as number

---

#### `findByObjectAndStage(objectId: string, stageNumber: number): Promise<StagePhotoEntity[]>`

Gets all photos for a stage.

**Parameters:**
- `objectId` (string): Object UUID
- `stageNumber` (number): Stage number

**Returns:** Array of `StagePhotoEntity` ordered by creation date

---

#### `validateMinimumPhotos(objectId: string, stageNumber: number): Promise<boolean>`

Validates minimum photo requirement.

**Parameters:**
- `objectId` (string): Object UUID
- `stageNumber` (number): Stage number

**Returns:** `true` if count >= MIN_PHOTOS_PER_STAGE, else `false`

---

#### `getMinPhotosRequired(): number`

Gets configured minimum photos.

**Returns:** Minimum photos per stage (default: 3)

---

#### `getMaxPhotosAllowed(): number`

Gets configured maximum photos.

**Returns:** Maximum photos per stage (default: 10)

---

## HistoryService

Records audit trail of actions.

### Methods

#### `create(createHistoryDto: CreateHistoryDto): Promise<StageHistoryEntity>`

Creates a history record.

**Parameters:**
- `createHistoryDto`:
  - `objectId` (string): Object UUID
  - `stageNumber` (number): Stage number
  - `action` (HistoryAction): Action type
  - `telegramUserId?` (string): User ID
  - `username?` (string): Username

**Returns:** Created `StageHistoryEntity`

---

#### `recordPhotoAdded(objectId: string, stageNumber: number, userId?: string, username?: string): Promise<StageHistoryEntity>`

Records photo addition.

**Action:** `PHOTO_ADDED`

---

#### `recordStageCompleted(objectId: string, stageNumber: number, userId?: string, username?: string): Promise<StageHistoryEntity>`

Records stage completion.

**Action:** `STAGE_COMPLETED`

---

#### `recordPaused(objectId: string, stageNumber: number, userId?: string, username?: string): Promise<StageHistoryEntity>`

Records object pause.

**Action:** `PAUSED`

---

#### `recordResumed(objectId: string, stageNumber: number, userId?: string, username?: string): Promise<StageHistoryEntity>`

Records object resume.

**Action:** `RESUMED`

---

#### `findByObject(objectId: string): Promise<StageHistoryEntity[]>`

Gets all history for an object.

**Parameters:**
- `objectId` (string): Object UUID

**Returns:** Array of `StageHistoryEntity` ordered by date (newest first)

---

#### `findByObjectAndAction(objectId: string, action: HistoryAction): Promise<StageHistoryEntity[]>`

Gets history filtered by action.

**Parameters:**
- `objectId` (string): Object UUID
- `action` (HistoryAction): Filter by action type

**Returns:** Array of `StageHistoryEntity` ordered by date (newest first)

---

## GoogleDriveService

Manages Google Drive integration.

### Methods

#### `createFolderIfNotExists(folderName: string, parentFolderId?: string): Promise<string>`

Creates folder or returns existing folder ID.

**Parameters:**
- `folderName` (string): Folder name
- `parentFolderId?` (string): Parent folder ID (uses root if not specified)

**Returns:** Folder ID

**Logic:**
1. Searches for existing folder with name
2. Returns ID if found
3. Creates new folder if not found

---

#### `uploadPhoto(photoBuffer: Buffer, fileName: string, folderId: string): Promise<{ fileId: string; url: string }>`

Uploads photo to Drive.

**Parameters:**
- `photoBuffer` (Buffer): Photo data
- `fileName` (string): File name
- `folderId` (string): Destination folder ID

**Process:**
1. Uploads file to folder
2. Sets public "reader" permission
3. Generates public URL

**Returns:** Object with `fileId` and `url`

**Example:**
```typescript
const { fileId, url } = await googleDriveService.uploadPhoto(
  photoBuffer,
  'photo_1234567890_1.jpg',
  stageFolderId
);
```

---

#### `generatePublicUrl(fileId: string): Promise<string>`

Generates public URL for a file.

**Parameters:**
- `fileId` (string): Google Drive file ID

**Returns:** Public URL as string

---

#### `createObjectFolderStructure(objectName: string, stageNames: string[]): Promise<{ objectFolderId: string; stageFolderIds: Map<number, string> }>`

Creates complete folder structure for object.

**Parameters:**
- `objectName` (string): Object name
- `stageNames` (string[]): Array of stage names

**Structure Created:**
```
Root Folder/
  └── Object Name/
      ├── Stage_1_StageName1/
      ├── Stage_2_StageName2/
      └── ...
```

**Returns:** Object with `objectFolderId` and map of stage numbers to folder IDs

---

#### `getStageFolderId(objectName: string, stageNumber: number): Promise<string>`

Gets folder ID for a specific stage.

**Parameters:**
- `objectName` (string): Object name
- `stageNumber` (number): Stage number

**Returns:** Folder ID

**Throws:** Error if object or stage folder not found

---

## TelegramService

Wrapper for Telegram Bot API.

### Methods

#### `getBot(): TelegramBot`

Gets the bot instance.

**Returns:** `TelegramBot` instance

---

#### `sendMessage(chatId: string, text: string, options?: SendMessageOptions): Promise<Message>`

Sends a message to a chat.

**Parameters:**
- `chatId` (string): Chat ID
- `text` (string): Message text
- `options?`: Additional Telegram options

**Returns:** Sent `Message`

---

#### `sendMessageToThread(chatId: string, threadId: string, text: string, replyMarkup?: InlineKeyboardMarkup): Promise<Message>`

Sends message to forum thread.

**Parameters:**
- `chatId` (string): Chat ID
- `threadId` (string): Thread ID
- `text` (string): Message text (HTML formatted)
- `replyMarkup?`: Inline keyboard

**Options Applied:**
- `message_thread_id`: Thread ID
- `parse_mode`: HTML

**Returns:** Sent `Message`

---

#### `downloadPhoto(fileId: string): Promise<Buffer>`

Downloads photo from Telegram.

**Parameters:**
- `fileId` (string): Telegram file ID

**Process:**
1. Gets file link from Telegram
2. Downloads via HTTPS
3. Returns buffer

**Returns:** Photo as `Buffer`

---

#### `createStageActionButtons(): InlineKeyboardMarkup`

Creates standard action buttons.

**Buttons:**
- 📷 Add stage photos
- ✅ Complete stage
- ⏸ Pause

**Returns:** `InlineKeyboardMarkup`

---

#### `createPausedActionButtons(): InlineKeyboardMarkup`

Creates resume button.

**Buttons:**
- ▶️ Resume

**Returns:** `InlineKeyboardMarkup`

---

## Scheduler Jobs

### DailyReminderJob

#### `sendDailyReminders(): Promise<void>`

Cron job that runs daily at 16:00 Europe/Warsaw.

**Process:**
1. Gets objects needing reminders
2. For each object:
   - Gets current stage name
   - Formats reminder message
   - Sends to forum thread
   - Updates `lastPromptAt`

**Cron:** `0 16 * * *`

---

### StalledStageAlertJob

#### `sendStalledStageAlerts(): Promise<void>`

Cron job that runs daily at 10:00 Europe/Warsaw.

**Process:**
1. Gets objects with stalled stages (7+ days)
2. For each object:
   - Gets current stage name
   - Formats warning message
   - Sends to forum thread

**Cron:** `0 10 * * *` (CronExpression.EVERY_DAY_AT_10AM)

---

## Enums

### ObjectStatus

```typescript
enum ObjectStatus {
  ACTIVE = 'ACTIVE',
  DONE = 'DONE',
  ARCHIVED = 'ARCHIVED',
}
```

### HistoryAction

```typescript
enum HistoryAction {
  PHOTO_ADDED = 'PHOTO_ADDED',
  STAGE_COMPLETED = 'STAGE_COMPLETED',
  PAUSED = 'PAUSED',
  RESUMED = 'RESUMED',
}
```

### UserSessionState

```typescript
enum UserSessionState {
  IDLE = 'IDLE',
  AWAITING_PHOTOS = 'AWAITING_PHOTOS',
}
```

---

## Configuration

All configuration is loaded from environment variables via `ConfigService`.

### Access Pattern

```typescript
constructor(private configService: ConfigService) {
  const value = this.configService.get<Type>('app.path.to.config');
}
```

### Available Configs

- `app.port`: Application port
- `app.telegram.botToken`: Bot token
- `app.telegram.coordinatorChatId`: Group chat ID
- `app.googleDrive.clientEmail`: Service account email
- `app.googleDrive.privateKey`: Service account key
- `app.googleDrive.rootFolderId`: Drive folder ID
- `app.scheduler.reminderTime`: Reminder time
- `app.scheduler.reminderTimezone`: Timezone
- `app.scheduler.stalledStageDays`: Days threshold
- `app.stages.names`: Stage names array
- `app.stages.minPhotosPerStage`: Minimum photos
- `app.stages.maxPhotosPerStage`: Maximum photos

---

For usage examples, see [README.md](./README.md) and [QUICKSTART.md](./QUICKSTART.md)

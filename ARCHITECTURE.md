# System Architecture

## High-Level Overview

```
┌─────────────────┐
│  Telegram User  │
└────────┬────────┘
         │
         │ 1. Create Topic
         │ 2. Send Photos
         │ 3. Click Buttons
         ▼
┌─────────────────────────────┐
│   Telegram Bot API          │
│   (Polling)                 │
└─────────────┬───────────────┘
              │
              │ Updates
              ▼
┌─────────────────────────────────────────────┐
│         NestJS Application                  │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │   TelegramUpdateHandler              │  │
│  │   - forum_topic_created              │  │
│  │   - photo messages                   │  │
│  │   - callback_query (buttons)         │  │
│  └──────────┬───────────────────────────┘  │
│             │                               │
│             ▼                               │
│  ┌──────────────────┐   ┌────────────────┐ │
│  │  ObjectsService  │   │  StagesService │ │
│  └──────────────────┘   └────────────────┘ │
│             │                    │          │
│             ▼                    ▼          │
│  ┌──────────────────┐   ┌────────────────┐ │
│  │  PhotosService   │   │ HistoryService │ │
│  └────────┬─────────┘   └────────────────┘ │
│           │                                 │
│           ▼                                 │
│  ┌────────────────────────┐                │
│  │  GoogleDriveService    │                │
│  └────────────────────────┘                │
│           │                                 │
│           │                                 │
│  ┌────────────────────────┐                │
│  │  Scheduler Jobs        │                │
│  │  - Daily Reminder      │                │
│  │  - Stalled Alert       │                │
│  └────────────────────────┘                │
│           │                                 │
└───────────┼─────────────────────────────────┘
            │
            ▼
   ┌─────────────────┐       ┌──────────────┐
   │   PostgreSQL    │       │ Google Drive │
   │                 │       │              │
   │  - objects      │       │  - Photos    │
   │  - stages       │       │  - Folders   │
   │  - photos       │       │              │
   │  - history      │       │              │
   └─────────────────┘       └──────────────┘
```

## Data Flow

### 1. Topic Creation Flow

```
User creates topic
      │
      ▼
Telegram sends forum_topic_created
      │
      ▼
TelegramUpdateHandler.handleForumTopicCreated()
      │
      ├─► ObjectsService.create()
      │        │
      │        ▼
      │   Save to objects table
      │
      ├─► StagesService.createStagesForObject()
      │        │
      │        ▼
      │   Save 5 stages to stages table
      │
      ├─► GoogleDriveService.createObjectFolderStructure()
      │        │
      │        ▼
      │   Create folder hierarchy in Drive
      │
      └─► Send welcome message with buttons
```

### 2. Photo Upload Flow

```
User clicks "Add photos" button
      │
      ▼
Session state = AWAITING_PHOTOS
      │
      ▼
User sends photo(s)
      │
      ├─► Single photo
      │        │
      │        ▼
      │   Download from Telegram
      │        │
      │        ▼
      │   Upload to Google Drive
      │        │
      │        ▼
      │   Save record to stage_photos
      │        │
      │        ▼
      │   Add history record
      │
      └─► Photo album (media group)
               │
               ▼
          Collect all photos (1s delay)
               │
               ▼
          Download all from Telegram
               │
               ▼
          Batch upload to Google Drive
               │
               ▼
          Save all records to stage_photos
               │
               ▼
          Add history record
```

### 3. Stage Completion Flow

```
User clicks "Complete stage"
      │
      ▼
Validate minimum photos (≥3)
      │
      ├─► Not enough photos
      │        │
      │        ▼
      │   Send error message
      │
      └─► Enough photos
               │
               ▼
          StagesService.completeStage()
               │
               ▼
          Update stage: isCompleted = true
               │
               ▼
          HistoryService.recordStageCompleted()
               │
               ▼
          ObjectsService.progressToNextStage()
               │
               ├─► Last stage completed
               │        │
               │        ▼
               │   object.status = DONE
               │        │
               │        ▼
               │   Send congratulations message
               │
               └─► More stages remaining
                        │
                        ▼
                   object.currentStage++
                        │
                        ▼
                   Send progress message
```

### 4. Daily Reminder Flow

```
Cron: Every day at 16:00 Europe/Warsaw
      │
      ▼
DailyReminderJob.sendDailyReminders()
      │
      ▼
Query objects where:
  - paused = false
  - status != DONE
  - lastPromptAt != today
      │
      ▼
For each object:
      │
      ├─► Get current stage name
      │
      ├─► Format reminder message
      │
      ├─► Send to forum topic
      │
      └─► Update lastPromptAt = now()
```

### 5. Stalled Stage Alert Flow

```
Cron: Every day at 10:00 Europe/Warsaw
      │
      ▼
StalledStageAlertJob.sendStalledStageAlerts()
      │
      ▼
Query objects where:
  - paused = false
  - status = ACTIVE
  - current stage createdAt < (now - 7 days)
  - current stage isCompleted = false
      │
      ▼
For each object:
      │
      ├─► Format warning message
      │
      └─► Send to forum topic
```

## Module Dependencies

```
AppModule
  │
  ├─► ConfigModule (Global)
  │     └─► Loads: database.config, app.config
  │
  ├─► TypeOrmModule
  │     └─► Uses: database.config
  │
  ├─► ObjectsModule
  │     └─► Provides: ObjectsService
  │
  ├─► StagesModule
  │     └─► Provides: StagesService
  │
  ├─► PhotosModule
  │     ├─► Imports: GoogleDriveModule
  │     └─► Provides: PhotosService
  │
  ├─► HistoryModule
  │     └─► Provides: HistoryService
  │
  ├─► GoogleDriveModule
  │     └─► Provides: GoogleDriveService
  │
  ├─► TelegramModule
  │     ├─► Imports: Objects, Stages, Photos, History, GoogleDrive
  │     ├─► Provides: TelegramService
  │     └─► Provides: TelegramUpdateHandler
  │
  └─► SchedulerModule
        ├─► Imports: Objects, Stages, Telegram
        ├─► Provides: DailyReminderJob
        └─► Provides: StalledStageAlertJob
```

## Database Schema

```
┌─────────────────────────────────┐
│         objects                 │
├─────────────────────────────────┤
│ id (PK, UUID)                   │
│ telegramChatId                  │
│ telegramThreadId                │
│ name                            │
│ currentStage                    │
│ paused                          │
│ status (ACTIVE|DONE|ARCHIVED)  │
│ lastPromptAt                    │
│ createdAt                       │
│ updatedAt                       │
└─────────────┬───────────────────┘
              │
              │ 1:N
              │
    ┌─────────┼───────────┬──────────────┐
    │         │           │              │
    ▼         ▼           ▼              ▼
┌────────┐ ┌───────────┐ ┌──────────┐ ┌─────────────┐
│ stages │ │  photos   │ │ history  │ │   (future)  │
└────────┘ └───────────┘ └──────────┘ └─────────────┘
```

### Entity Relationships

```
ObjectEntity (1) ──────────────────► (N) StageEntity
             (1) ──────────────────► (N) StagePhotoEntity
             (1) ──────────────────► (N) StageHistoryEntity
```

## Key Design Patterns

### 1. Service Layer Pattern

Each entity has a dedicated service:
- `ObjectsService` - Business logic for objects
- `StagesService` - Stage management
- `PhotosService` - Photo validation and storage
- `HistoryService` - Audit trail

### 2. Repository Pattern

TypeORM repositories injected via `@InjectRepository`:

```typescript
@Injectable()
export class ObjectsService {
  constructor(
    @InjectRepository(ObjectEntity)
    private objectRepository: Repository<ObjectEntity>,
  ) {}
}
```

### 3. Decorator Pattern

NestJS decorators for:
- Dependency injection: `@Injectable()`
- Module configuration: `@Module()`
- Scheduled tasks: `@Cron()`

### 4. Observer Pattern

Telegram bot polling observes updates:

```typescript
this.bot.on('message', (msg) => this.handleMessage(msg));
this.bot.on('callback_query', (query) => this.handleCallbackQuery(query));
```

### 5. Session State Pattern

User sessions track upload state:

```typescript
interface UserSession {
  state: UserSessionState;  // IDLE | AWAITING_PHOTOS
  objectId?: string;
  stageNumber?: number;
  photoBuffer?: Buffer[];
}
```

## Scalability Considerations

### Current Design (Single Instance)

```
┌─────────────────┐
│   NestJS App    │
│   (Polling)     │
│                 │
│  - In-memory    │
│    sessions     │
│  - In-memory    │
│    media groups │
└─────────────────┘
```

**Limitations:**
- Single point of failure
- No horizontal scaling
- Memory-based state

### Potential Improvements

1. **Use Webhooks Instead of Polling**
   - Better for multiple instances
   - No duplicate message processing
   - Lower latency

2. **Redis for Session Storage**
   ```
   ┌──────┐   ┌──────┐   ┌──────┐
   │ App1 │   │ App2 │   │ App3 │
   └───┬──┘   └───┬──┘   └───┬──┘
       │          │          │
       └──────────┼──────────┘
                  │
                  ▼
             ┌────────┐
             │ Redis  │
             │        │
             │Sessions│
             └────────┘
   ```

3. **Queue-Based Processing**
   ```
   Telegram → Queue (RabbitMQ/SQS) → Workers → Database
   ```

4. **Separate Scheduler Service**
   ```
   Web API ──┬── Worker Pool
             │
   Scheduler─┘
   ```

## Security Considerations

### 1. Environment Variables

Never commit:
- `TELEGRAM_BOT_TOKEN`
- `GOOGLE_PRIVATE_KEY`
- `DB_PASSWORD`

### 2. Database Access

- Use parameterized queries (TypeORM handles this)
- Separate read/write users
- Enable SSL in production

### 3. Google Drive

- Service account has minimal permissions
- Only access to shared folder
- Regular key rotation

### 4. Telegram

- Validate webhook/polling source
- Rate limiting on bot actions
- Validate user permissions before actions

## Monitoring Points

### Application Level

- Bot polling status
- Message processing time
- Photo upload success rate
- Database query performance

### Infrastructure Level

- PostgreSQL connections
- Google Drive API quota
- Memory usage
- CPU usage

### Business Level

- Objects created per day
- Photos uploaded per day
- Stages completed per day
- Average stage completion time

## Error Handling Strategy

```
Try Operation
    │
    ├─► Success
    │     └─► Log info
    │
    └─► Error
          │
          ├─► Log error with context
          │
          ├─► Send user-friendly message
          │
          └─► Continue (don't crash app)
```

## Testing Strategy

### Unit Tests

- Service methods
- Business logic
- Validation logic

### Integration Tests

- Database operations
- API interactions
- End-to-end flows

### Manual Testing

- Create topic
- Upload photos
- Complete stages
- Test reminders

---

For implementation details, see [README.md](./README.md)

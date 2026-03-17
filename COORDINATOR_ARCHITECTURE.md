# Coordinator Architecture Options

## Current Implementation

### What `TELEGRAM_COORDINATOR_CHAT_ID` Actually Means

In the current implementation, this is **NOT a person's ID**. It's the **Telegram GROUP chat ID**:

```env
# This is the GROUP ID (the supergroup where forum topics are created)
TELEGRAM_COORDINATOR_CHAT_ID=-1001234567890
```

### Current Flow

```
User creates topic in GROUP
         ↓
Bot creates object in database
         ↓
Anyone in the GROUP can interact
```

**Limitations:**
- ❌ No per-user permissions
- ❌ Can't assign specific coordinators to specific objects
- ❌ No admin vs coordinator distinction
- ❌ Anyone in the group has full access

## Recommended Solutions

### Option 1: Role-Based Access Control (Best for Multiple Coordinators)

Add a `coordinators` table to track who can manage what.

#### Database Schema

```sql
-- Coordinators table
CREATE TABLE coordinators (
  id UUID PRIMARY KEY,
  telegram_user_id VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(255),
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  role ENUM('ADMIN', 'COORDINATOR', 'VIEWER') DEFAULT 'COORDINATOR',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Many-to-many relationship: coordinators ↔ objects
CREATE TABLE object_coordinators (
  object_id UUID REFERENCES objects(id) ON DELETE CASCADE,
  coordinator_id UUID REFERENCES coordinators(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (object_id, coordinator_id)
);
```

#### Roles Explained

**ADMIN:**
- Can manage ALL objects
- Can assign/remove coordinators
- Can create/delete objects
- Full system access

**COORDINATOR:**
- Can only manage ASSIGNED objects
- Can upload photos for their objects
- Can complete stages for their objects
- Cannot assign other coordinators

**VIEWER:**
- Read-only access
- Can view objects and photos
- Cannot upload or modify

#### Implementation Example

```typescript
// Check if user can manage this object
async canManageObject(userId: string, objectId: string): Promise<boolean> {
  const coordinator = await this.findByTelegramUserId(userId);

  if (!coordinator || !coordinator.isActive) {
    return false;
  }

  // Admins can manage everything
  if (coordinator.role === CoordinatorRole.ADMIN) {
    return true;
  }

  // Coordinators can only manage assigned objects
  if (coordinator.role === CoordinatorRole.COORDINATOR) {
    const assignment = await this.isAssignedToObject(coordinator.id, objectId);
    return assignment;
  }

  return false;
}
```

#### Bot Interaction Changes

```typescript
// Before allowing any action, check permissions
async handleCompleteStageAction(query, object, userId) {
  // Check if user is authorized
  const canManage = await this.coordinatorsService.canManageObject(
    userId,
    object.id
  );

  if (!canManage) {
    await this.telegramService.answerCallbackQuery(
      query.id,
      '❌ You are not authorized to manage this object'
    );
    return;
  }

  // Proceed with stage completion...
}
```

#### Admin Commands

```typescript
// Assign coordinator to object
/assign @username object_name

// Remove coordinator from object
/unassign @username object_name

// List coordinators for an object
/coordinators object_name

// Promote user to admin
/promote @username admin
```

---

### Option 2: Simple Admin List (Quick Solution)

Store a list of admin Telegram user IDs in config.

#### Configuration

```env
# Comma-separated list of admin Telegram user IDs
ADMIN_USER_IDS=123456789,987654321,456789123

# All admins can manage all objects
# Everyone else has read-only access
```

#### Implementation

```typescript
// config/app.config.ts
export default registerAs('app', () => ({
  admins: {
    userIds: process.env.ADMIN_USER_IDS?.split(',') || [],
  },
}));

// Check if user is admin
isAdmin(userId: string): boolean {
  const adminIds = this.configService.get<string[]>('app.admins.userIds');
  return adminIds.includes(userId);
}

// Guard all actions
if (!this.isAdmin(userId)) {
  return this.telegramService.answerCallbackQuery(
    query.id,
    '❌ Admin only'
  );
}
```

**Pros:**
- ✅ Simple to implement
- ✅ No database changes needed
- ✅ Easy to update (just edit .env)

**Cons:**
- ❌ All-or-nothing permissions
- ❌ Can't assign specific objects to specific users
- ❌ No granular roles

---

### Option 3: Group-Based Permissions (Multiple Groups)

Create separate Telegram groups for different projects/regions.

#### Structure

```
Group 1: "North Region Projects"
  ├── Topic: Green City Apartment
  └── Topic: Blue Tower Office

Group 2: "South Region Projects"
  ├── Topic: Red Villa House
  └── Topic: Yellow Complex
```

#### Database Changes

```typescript
// Remove single chat ID from config
// Allow multiple groups

@Entity('objects')
export class ObjectEntity {
  // Keep these - they're per object
  telegramChatId: string;  // Which group
  telegramThreadId: string; // Which topic

  // Add optional grouping
  @Column({ nullable: true })
  region: string; // "North Region", "South Region"
}
```

#### Configuration

```env
# Support multiple groups (not just one coordinator chat)
# Bot monitors ALL groups it's added to
```

**Pros:**
- ✅ Natural separation by region/project type
- ✅ Easy to understand for users
- ✅ Telegram handles permissions

**Cons:**
- ❌ More groups to manage
- ❌ Can't have cross-group visibility
- ❌ Users must be in correct group

---

## Comparison Table

| Feature | Option 1: RBAC | Option 2: Admin List | Option 3: Multiple Groups |
|---------|----------------|---------------------|---------------------------|
| Multiple coordinators | ✅ Per-object | ❌ All-or-nothing | ✅ Per-group |
| Granular permissions | ✅ Yes | ❌ No | ⚠️ Limited |
| Admin vs Coordinator | ✅ Yes | ⚠️ Admin only | ⚠️ By group |
| Easy to implement | ⚠️ Medium | ✅ Easy | ✅ Easy |
| Database changes | ✅ Required | ❌ None | ⚠️ Minor |
| Scalability | ✅ Excellent | ❌ Limited | ⚠️ Good |
| User experience | ✅ Excellent | ⚠️ Simple | ✅ Good |

---

## Recommended Implementation: Option 1 (RBAC)

### Step 1: Create Coordinator Entity

File: `src/coordinators/entities/coordinator.entity.ts` (already created above)

### Step 2: Create Junction Table

```typescript
// src/objects/entities/object.entity.ts
import { ManyToMany, JoinTable } from 'typeorm';
import { CoordinatorEntity } from '../../coordinators/entities/coordinator.entity';

@Entity('objects')
export class ObjectEntity {
  // ... existing fields ...

  @ManyToMany(() => CoordinatorEntity, (coordinator) => coordinator.objects)
  @JoinTable({
    name: 'object_coordinators',
    joinColumn: { name: 'object_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'coordinator_id', referencedColumnName: 'id' },
  })
  coordinators: CoordinatorEntity[];
}
```

### Step 3: Create CoordinatorsService

```typescript
@Injectable()
export class CoordinatorsService {
  constructor(
    @InjectRepository(CoordinatorEntity)
    private coordinatorRepository: Repository<CoordinatorEntity>,
  ) {}

  async findByTelegramUserId(userId: string): Promise<CoordinatorEntity | null> {
    return this.coordinatorRepository.findOne({
      where: { telegramUserId: userId, isActive: true },
      relations: ['objects'],
    });
  }

  async canManageObject(userId: string, objectId: string): Promise<boolean> {
    const coordinator = await this.findByTelegramUserId(userId);

    if (!coordinator) return false;

    // Admins can manage everything
    if (coordinator.role === CoordinatorRole.ADMIN) {
      return true;
    }

    // Check if assigned to this object
    return coordinator.objects.some(obj => obj.id === objectId);
  }

  async assignToObject(coordinatorId: string, objectId: string): Promise<void> {
    // Implementation for assigning coordinator to object
  }

  async createCoordinator(
    telegramUserId: string,
    role: CoordinatorRole = CoordinatorRole.COORDINATOR,
  ): Promise<CoordinatorEntity> {
    const coordinator = this.coordinatorRepository.create({
      telegramUserId,
      role,
      isActive: true,
    });
    return this.coordinatorRepository.save(coordinator);
  }
}
```

### Step 4: Add Permission Guards

```typescript
// src/telegram/telegram-update.handler.ts

async handleCallbackQuery(query: TelegramBot.CallbackQuery) {
  const userId = query.from.id.toString();
  const object = await this.objectsService.findByTelegramIds(...);

  // Check permissions before any action
  const canManage = await this.coordinatorsService.canManageObject(
    userId,
    object.id,
  );

  if (!canManage) {
    await this.telegramService.answerCallbackQuery(
      query.id,
      '❌ You are not authorized to manage this object',
    );
    return;
  }

  // Proceed with action...
}
```

### Step 5: Admin Commands

```typescript
// Handle text commands for admins
async handleCommand(msg: TelegramBot.Message) {
  const userId = msg.from.id.toString();
  const text = msg.text;

  // Check if user is admin
  const coordinator = await this.coordinatorsService.findByTelegramUserId(userId);
  if (!coordinator || coordinator.role !== CoordinatorRole.ADMIN) {
    return; // Ignore commands from non-admins
  }

  if (text.startsWith('/assign')) {
    // Parse: /assign @username object_name
    // Assign coordinator to object
  }

  if (text.startsWith('/create_coordinator')) {
    // Parse: /create_coordinator @username [role]
    // Create new coordinator
  }
}
```

---

## Migration Path

### If You Want RBAC (Recommended)

1. **Create migration for coordinators table:**
   ```bash
   npm run migration:generate -- src/database/migrations/AddCoordinators
   ```

2. **Create initial admin:**
   ```sql
   INSERT INTO coordinators (id, telegram_user_id, role, is_active)
   VALUES (uuid_generate_v4(), 'YOUR_TELEGRAM_USER_ID', 'ADMIN', true);
   ```

3. **Update TelegramUpdateHandler to check permissions**

4. **Add admin commands for managing coordinators**

### If You Want Simple Admin List

1. **Update .env:**
   ```env
   ADMIN_USER_IDS=123456789,987654321
   ```

2. **Add isAdmin() method to services**

3. **Add permission check before all actions**

---

## Quick Start: Simple Admin List (Fastest)

If you want to get started quickly with basic permissions:

1. **Update .env.example:**
   ```env
   # Admin Telegram User IDs (comma-separated)
   ADMIN_USER_IDS=123456789
   ```

2. **Get your Telegram user ID:**
   - Send a message to @userinfobot in Telegram
   - It will reply with your user ID

3. **Add check in handlers:**
   ```typescript
   const adminIds = process.env.ADMIN_USER_IDS?.split(',') || [];
   const isAdmin = adminIds.includes(userId);

   if (!isAdmin) {
     return; // Reject action
   }
   ```

This gives you basic admin protection in 5 minutes!

---

## Summary

**Current state:**
- `TELEGRAM_COORDINATOR_CHAT_ID` = Group ID (not a person)
- Everyone in the group has equal access

**Recommended:**
- Implement **Option 1 (RBAC)** for production with multiple coordinators
- Use **Option 2 (Admin List)** for quick MVP with simple permissions
- Use **Option 3 (Multiple Groups)** if you want regional separation

**Best choice for your use case:**
- If you need **different coordinators for different objects** → **Option 1 (RBAC)**
- If you just need **one admin** → **Option 2 (Admin List)**
- If you have **regional teams** → **Option 3 (Multiple Groups)**

Let me know which option you'd like to implement, and I can help you add it to the codebase!

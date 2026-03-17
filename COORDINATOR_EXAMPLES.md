# Coordinator Architecture - Visual Examples

## Current Implementation (No Permissions)

```
Telegram Group: "Construction Projects"
Chat ID: -1001234567890

Members:
├── Alice (admin)
├── Bob (coordinator)
├── Carol (coordinator)
└── Dave (worker)

Topic: "Green City Apartment"
  ├── Alice can: upload, complete, pause ✅
  ├── Bob can: upload, complete, pause ✅
  ├── Carol can: upload, complete, pause ✅
  └── Dave can: upload, complete, pause ✅
      ⚠️ Everyone has same permissions!
```

---

## Option 1: Role-Based Access Control (RBAC)

### Database Structure

```
┌─────────────────────────────────┐
│       coordinators              │
├─────────────────────────────────┤
│ id                              │
│ telegram_user_id (unique)       │
│ role (ADMIN/COORDINATOR/VIEWER) │
│ is_active                       │
└────────────┬────────────────────┘
             │
             │ Many-to-Many
             │
┌────────────▼────────────────────┐
│    object_coordinators          │
├─────────────────────────────────┤
│ object_id (FK)                  │
│ coordinator_id (FK)             │
└────────────┬────────────────────┘
             │
             │
┌────────────▼────────────────────┐
│         objects                 │
├─────────────────────────────────┤
│ id                              │
│ name                            │
│ current_stage                   │
└─────────────────────────────────┘
```

### Example Setup

```
Coordinators:
├── Alice (telegram_user_id: 123456)
│   ├── Role: ADMIN
│   └── Can manage: ALL objects
│
├── Bob (telegram_user_id: 789012)
│   ├── Role: COORDINATOR
│   └── Assigned to:
│       ├── "Green City Apartment"
│       └── "Blue Tower Office"
│
├── Carol (telegram_user_id: 345678)
│   ├── Role: COORDINATOR
│   └── Assigned to:
│       └── "Red Villa House"
│
└── Dave (telegram_user_id: 901234)
    ├── Role: VIEWER
    └── Can only view objects (read-only)
```

### Access Matrix

| User  | Role        | Green City | Blue Tower | Red Villa |
|-------|-------------|------------|------------|-----------|
| Alice | ADMIN       | ✅ Manage  | ✅ Manage  | ✅ Manage |
| Bob   | COORDINATOR | ✅ Manage  | ✅ Manage  | ❌ No     |
| Carol | COORDINATOR | ❌ No      | ❌ No      | ✅ Manage |
| Dave  | VIEWER      | 👁️ View   | 👁️ View   | 👁️ View  |

### User Actions

**Alice (ADMIN) creates a new object:**
```
Alice creates topic "Yellow Complex"
    ↓
Bot creates object
    ↓
Alice: /assign @Bob Yellow Complex
    ↓
Bob is now assigned to Yellow Complex
    ↓
Bob can now manage Yellow Complex
```

**Bob (COORDINATOR) tries to manage objects:**
```
Topic: "Green City Apartment"
    ↓
Bob clicks "Complete Stage"
    ↓
Bot checks: Is Bob assigned to this object?
    ↓
✅ Yes → Stage completed

Topic: "Red Villa House"
    ↓
Bob clicks "Complete Stage"
    ↓
Bot checks: Is Bob assigned to this object?
    ↓
❌ No → "You are not authorized to manage this object"
```

### Admin Commands

```
# Create a coordinator
/create_coordinator @username COORDINATOR

# Assign coordinator to object
/assign @Bob Green City Apartment

# Remove assignment
/unassign @Bob Green City Apartment

# List coordinators for an object
/coordinators Green City Apartment

# Promote to admin
/promote @Carol ADMIN

# List all coordinators
/list_coordinators
```

---

## Option 2: Simple Admin List

### Configuration

```env
# .env file
ADMIN_USER_IDS=123456,789012
```

### Example

```
Telegram Group Members:
├── Alice (user_id: 123456) → ADMIN ✅
├── Bob (user_id: 789012) → ADMIN ✅
├── Carol (user_id: 345678) → Regular user ❌
└── Dave (user_id: 901234) → Regular user ❌

All Objects:
├── "Green City Apartment"
│   ├── Alice: can manage ✅
│   ├── Bob: can manage ✅
│   ├── Carol: cannot manage ❌
│   └── Dave: cannot manage ❌
│
└── "Blue Tower Office"
    ├── Alice: can manage ✅
    ├── Bob: can manage ✅
    ├── Carol: cannot manage ❌
    └── Dave: cannot manage ❌
```

### Implementation

```typescript
// Simple check before any action
const adminIds = process.env.ADMIN_USER_IDS?.split(',') || [];
const isAdmin = adminIds.includes(userId);

if (!isAdmin) {
  return sendMessage('❌ Admin only');
}
```

**Pros:**
- Very simple
- No database changes
- Easy to update

**Cons:**
- All admins have same permissions
- Can't assign specific objects to specific people
- All-or-nothing access

---

## Option 3: Multiple Groups

### Structure

```
Group 1: "North Region Projects"
  Chat ID: -1001111111111
  Members:
    ├── Alice (admin)
    ├── Bob (coordinator)
    └── Dave (worker)

  Topics:
    ├── "Green City Apartment" (North)
    └── "Blue Tower Office" (North)

Group 2: "South Region Projects"
  Chat ID: -1002222222222
  Members:
    ├── Alice (admin)
    ├── Carol (coordinator)
    └── Eve (worker)

  Topics:
    ├── "Red Villa House" (South)
    └── "Yellow Complex" (South)
```

### Access Model

```
Bob is in "North Region Projects" group
  ├── Can manage: Green City Apartment ✅
  ├── Can manage: Blue Tower Office ✅
  ├── Can manage: Red Villa House ❌ (different group)
  └── Can manage: Yellow Complex ❌ (different group)

Carol is in "South Region Projects" group
  ├── Can manage: Green City Apartment ❌ (different group)
  ├── Can manage: Blue Tower Office ❌ (different group)
  ├── Can manage: Red Villa House ✅
  └── Can manage: Yellow Complex ✅
```

### Implementation

```typescript
// Bot monitors multiple groups
// Permissions are managed by Telegram group membership
// No database changes needed

// When user tries to act:
if (msg.chat.id !== object.telegramChatId) {
  return sendMessage('❌ Wrong group');
}
```

**Pros:**
- Natural separation
- Telegram handles permissions
- Easy to understand

**Cons:**
- More groups to manage
- No cross-group visibility
- Can't share coordinators easily

---

## Real-World Example: Construction Company

### Scenario

**Company:** BuildCo Construction
- **Regions:** North, South, East
- **Projects:** 20+ active projects
- **Team:** 1 admin, 6 coordinators, 30+ workers

### Setup with RBAC (Option 1)

```
Single Telegram Group: "BuildCo Projects"

Admin:
└── Alice (CEO) - ADMIN role
    Can manage all 20 projects

Coordinators:
├── Bob (North Lead) - COORDINATOR
│   Assigned to:
│   ├── Green City Apartment (North)
│   ├── Blue Tower Office (North)
│   └── White Mall Complex (North)
│
├── Carol (South Lead) - COORDINATOR
│   Assigned to:
│   ├── Red Villa House (South)
│   └── Yellow Shopping Center (South)
│
└── Dave (East Lead) - COORDINATOR
    Assigned to:
    ├── Purple Hospital (East)
    └── Orange School (East)

Workers:
└── 30 workers - VIEWER role
    Can view all projects but cannot modify
```

### Daily Workflow

**Morning:**
```
Alice (Admin) creates new topic: "Black Office Tower"
Alice: /assign @Bob Black Office Tower
Bob gets notification: "You've been assigned to Black Office Tower"
```

**During Day:**
```
Bob uploads photos to "Green City Apartment" ✅
Bob uploads photos to "Red Villa House" ❌
  ↓ Bot responds: "You are not authorized"

Carol uploads photos to "Red Villa House" ✅
Carol completes stage in "Yellow Shopping Center" ✅
```

**Project Transfer:**
```
Alice: /unassign @Bob Green City Apartment
Alice: /assign @Dave Green City Apartment
  ↓ Now Dave manages this project instead of Bob
```

---

## Decision Matrix

### Choose Option 1 (RBAC) if:
- ✅ You have multiple coordinators
- ✅ Different people manage different projects
- ✅ You want granular permissions (admin/coordinator/viewer)
- ✅ You need audit trail of who manages what
- ✅ Projects can be reassigned between coordinators
- ✅ You want professional, scalable solution

### Choose Option 2 (Admin List) if:
- ✅ You only have 1-2 admins
- ✅ Admins manage everything equally
- ✅ You want quick and simple
- ✅ You don't need per-object permissions
- ✅ You're testing/prototyping

### Choose Option 3 (Multiple Groups) if:
- ✅ You have clear regional/project-type separation
- ✅ Teams don't need to see each other's projects
- ✅ You want Telegram to handle permissions
- ✅ You're okay with multiple group chats
- ✅ Simple group membership = permissions

---

## Implementation Time Estimates

| Option | Database Changes | Code Changes | Testing | Total |
|--------|------------------|--------------|---------|-------|
| Option 1 (RBAC) | 2 hours | 4 hours | 2 hours | ~8 hours |
| Option 2 (Admin List) | 0 hours | 30 min | 30 min | ~1 hour |
| Option 3 (Multiple Groups) | 30 min | 1 hour | 1 hour | ~2.5 hours |

---

## My Recommendation

**For a production construction company with multiple coordinators:**

👉 **Implement Option 1 (RBAC)**

**Why:**
- Professional and scalable
- Each coordinator manages their own projects
- Admin has oversight of everything
- Easy to reassign projects
- Clear audit trail
- Supports company growth

**Quick Start Path:**
1. Start with Option 2 (Admin List) for MVP
2. Migrate to Option 1 (RBAC) when you have 3+ coordinators
3. This lets you launch quickly and scale later

---

## Code Example: Quick Admin Check

If you want to add basic admin protection RIGHT NOW:

1. **Add to .env:**
```env
# Your Telegram user ID (get from @userinfobot)
ADMIN_USER_IDS=123456789
```

2. **Add to src/telegram/telegram-update.handler.ts:**
```typescript
private isAdmin(userId: string): boolean {
  const adminIds = process.env.ADMIN_USER_IDS?.split(',') || [];
  return adminIds.includes(userId);
}

async handleCallbackQuery(query: TelegramBot.CallbackQuery) {
  const userId = query.from.id.toString();

  // Check if user is admin
  if (!this.isAdmin(userId)) {
    await this.telegramService.answerCallbackQuery(
      query.id,
      '❌ Admin only - contact administrator'
    );
    return;
  }

  // Continue with existing logic...
}
```

Done! Now only admins can use the bot.

---

**Which option would you like to implement?** Let me know and I'll add the code!

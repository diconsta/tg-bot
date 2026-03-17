# RBAC Setup Guide

Complete guide for setting up and using the Role-Based Access Control system.

## Overview

The bot now has three roles:
- **ADMIN** - Can manage everything and all objects
- **COORDINATOR** - Can only manage objects they're assigned to
- **VIEWER** - Read-only access (future feature)

## Initial Setup

### 1. Run Database Migrations

After installing dependencies, run the new migration:

```bash
npm run migration:run
```

This creates:
- `coordinators` table
- `object_coordinators` junction table
- Necessary indexes

### 2. Create Your First Admin

You need to create the first admin manually in the database.

**Step 1: Get your Telegram user ID**

Send a message to `@userinfobot` on Telegram. It will reply with your user ID (e.g., `123456789`).

**Step 2: Insert admin into database**

```sql
-- Connect to your database
psql -U postgres -d tg_building_bot

-- Create the admin
INSERT INTO coordinators (id, "telegramUserId", username, role, "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  '123456789',  -- Replace with YOUR Telegram user ID
  'your_username',  -- Replace with your Telegram username (without @)
  'ADMIN',
  true,
  NOW(),
  NOW()
);

-- Verify
SELECT * FROM coordinators;
```

**Step 3: Test admin access**

Send `/help_admin` to the bot. If you see the admin commands, you're set up correctly!

## Using the System

### Creating Coordinators

Coordinators are created automatically when users interact with the bot. When someone sends any message to the bot, they're auto-created with the COORDINATOR role.

**To manually create:**

1. Ask the user to send any message to the bot (e.g., `/start`)
2. They're now in the system as a COORDINATOR

### Assigning Coordinators to Objects

**Command:**
```
/assign @username object_name
```

**Examples:**
```
/assign @john Green City
/assign @sarah Blue Tower Office
```

**Notes:**
- Object name matching is fuzzy (partial names work)
- If "Green City Apartment" exists, you can use "Green City"
- Username must exist in the system (they must have interacted with bot first)

### Viewing Assignments

**List all coordinators:**
```
/list_coordinators
```

Output:
```
📋 Coordinators List

✅ @john
   Role: COORDINATOR
   Objects: 2
   Status: Active

✅ @sarah
   Role: ADMIN
   Objects: 0
   Status: Active
```

**List coordinators for specific object:**
```
/coordinators Green City
```

Output:
```
📋 Coordinators for "Green City Apartment"

• @john (COORDINATOR)
• @sarah (ADMIN)
```

### Removing Assignments

**Command:**
```
/unassign @username object_name
```

**Example:**
```
/unassign @john Green City
```

### Promoting/Demoting Users

**Command:**
```
/promote @username ROLE
```

**Examples:**
```
/promote @john ADMIN
/promote @sarah COORDINATOR
/promote @mike VIEWER
```

**Roles:**
- `ADMIN` - Full access to everything
- `COORDINATOR` - Access only to assigned objects
- `VIEWER` - Read-only (not yet fully implemented)

## Permission System

### What Each Role Can Do

**ADMIN:**
- ✅ Manage ALL objects (add photos, complete stages, pause/resume)
- ✅ Use all admin commands
- ✅ Assign/unassign coordinators
- ✅ Promote/demote users
- ✅ View everything

**COORDINATOR:**
- ✅ Manage objects they're assigned to
- ✅ Add photos to their objects
- ✅ Complete stages for their objects
- ✅ Pause/resume their objects
- ❌ Cannot use admin commands
- ❌ Cannot manage objects they're not assigned to

**VIEWER:**
- ✅ View all objects (not yet implemented)
- ❌ Cannot modify anything

### Permission Checks

The bot automatically checks permissions before any action:

1. User clicks "Add photos" button
2. Bot checks: `canManageObject(userId, objectId)`
3. If ADMIN → ✅ Allowed
4. If COORDINATOR and assigned → ✅ Allowed
5. Otherwise → ❌ "You are not authorized to manage this object"

## Common Workflows

### Workflow 1: New Project with Coordinator

```bash
# 1. Create new topic in Telegram group
"New topic: Green City Apartment"

# 2. Bot auto-creates the object

# 3. Admin assigns coordinator
/assign @john Green City

# 4. John can now manage this project
# John clicks buttons in the topic → ✅ Works

# 5. Sarah (not assigned) tries to manage
# Sarah clicks buttons → ❌ "You are not authorized"
```

### Workflow 2: Reassigning Project

```bash
# John is leaving, Sarah is taking over

# 1. Remove John's assignment
/unassign @john Green City

# 2. Assign to Sarah
/assign @sarah Green City

# 3. Now Sarah can manage, John cannot
```

### Workflow 3: Promoting to Admin

```bash
# Sarah has proven herself, make her admin

# 1. Promote Sarah
/promote @sarah ADMIN

# 2. Now Sarah can:
#    - Manage all objects
#    - Use admin commands
#    - Assign other coordinators
```

### Workflow 4: Multiple Projects

```bash
# John manages North region, Sarah manages South region

# North region projects
/assign @john Green City Apartment
/assign @john Blue Tower Office

# South region projects
/assign @sarah Red Villa House
/assign @sarah Yellow Shopping Center

# Result:
# - John can only manage North projects
# - Sarah can only manage South projects
# - Admin can manage everything
```

## Troubleshooting

### "Coordinator not found"

**Problem:** `/assign @john Green City` → "Coordinator @john not found"

**Solution:** Ask John to send any message to the bot first (e.g., `/start` or "hello")

### "Object not found"

**Problem:** `/assign @john Building` → "Object 'Building' not found"

**Solutions:**
1. Check the exact object name in the topic
2. Use a longer partial match
3. Check if object exists: `/coordinators Building`

### "You are not authorized"

**Problem:** User clicks button but gets "not authorized"

**Checks:**
1. Is user in database? `SELECT * FROM coordinators WHERE "telegramUserId" = '123456789';`
2. Is user assigned to object? `SELECT * FROM object_coordinators;`
3. Is user active? Check `isActive` column

**Solution:**
```sql
-- Check user's assignments
SELECT
  c.username,
  c.role,
  o.name as object_name
FROM coordinators c
LEFT JOIN object_coordinators oc ON c.id = oc.coordinator_id
LEFT JOIN objects o ON oc.object_id = o.id
WHERE c."telegramUserId" = '123456789';
```

### Permission check not working

**Debug:**
```sql
-- View all coordinators and their objects
SELECT
  c.username,
  c.role,
  c."isActive",
  COUNT(oc.object_id) as assigned_objects
FROM coordinators c
LEFT JOIN object_coordinators oc ON c.id = oc.coordinator_id
GROUP BY c.id;
```

## Database Queries

### Useful Admin Queries

```sql
-- List all coordinators
SELECT "telegramUserId", username, role, "isActive"
FROM coordinators;

-- List all assignments
SELECT
  c.username,
  o.name as object_name
FROM object_coordinators oc
JOIN coordinators c ON oc.coordinator_id = c.id
JOIN objects o ON oc.object_id = o.id;

-- Find coordinators for specific object
SELECT c.username, c.role
FROM object_coordinators oc
JOIN coordinators c ON oc.coordinator_id = c.id
JOIN objects o ON oc.object_id = o.id
WHERE o.name LIKE '%Green City%';

-- Deactivate a coordinator
UPDATE coordinators
SET "isActive" = false
WHERE username = 'john';

-- Make someone admin
UPDATE coordinators
SET role = 'ADMIN'
WHERE username = 'sarah';
```

## Security Best Practices

### 1. Limit Admin Access

- Only give ADMIN role to trusted people
- Admins can assign anyone to anything
- Consider having 1-2 admins maximum

### 2. Regular Audits

Check who has access:
```sql
-- List all admins
SELECT username, "telegramUserId"
FROM coordinators
WHERE role = 'ADMIN' AND "isActive" = true;
```

### 3. Remove Inactive Users

```sql
-- Deactivate old coordinators
UPDATE coordinators
SET "isActive" = false
WHERE "updatedAt" < NOW() - INTERVAL '90 days';
```

### 4. Monitor Permissions

Check the `stage_history` table to see who's doing what:
```sql
SELECT
  username,
  action,
  COUNT(*) as action_count
FROM stage_history
WHERE "createdAt" > NOW() - INTERVAL '30 days'
GROUP BY username, action;
```

## Migration from Old System

If you had the bot running before RBAC:

### Step 1: Backup Database

```bash
pg_dump -U postgres tg_building_bot > backup_before_rbac.sql
```

### Step 2: Run Migration

```bash
npm run migration:run
```

### Step 3: Create Admins

```sql
-- Create admin for each person who should have access
INSERT INTO coordinators (id, "telegramUserId", username, role, "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'USER_ID_HERE', 'username_here', 'ADMIN', true, NOW(), NOW());
```

### Step 4: Test

1. Send `/help_admin` as admin → Should see commands
2. Have non-admin try to click button → Should see "not authorized"
3. Assign non-admin to an object → Should now work

## Quick Reference

### Admin Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/assign @user object` | Assign coordinator to object | `/assign @john Green City` |
| `/unassign @user object` | Remove assignment | `/unassign @john Green City` |
| `/promote @user ROLE` | Change user role | `/promote @john ADMIN` |
| `/list_coordinators` | Show all coordinators | `/list_coordinators` |
| `/coordinators object` | Show object coordinators | `/coordinators Green City` |
| `/help_admin` | Show admin help | `/help_admin` |

### Roles

| Role | Can Manage All | Can Manage Assigned | Can Use Admin Commands |
|------|----------------|---------------------|------------------------|
| ADMIN | ✅ | ✅ | ✅ |
| COORDINATOR | ❌ | ✅ | ❌ |
| VIEWER | ❌ | ❌ | ❌ |

---

**Need help?** Check the main [README.md](./README.md) or [COORDINATOR_EXAMPLES.md](./COORDINATOR_EXAMPLES.md) for more details.

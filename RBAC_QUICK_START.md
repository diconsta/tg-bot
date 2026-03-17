# RBAC Quick Start

Get the Role-Based Access Control system running in 5 minutes.

## Prerequisites

- Bot already running
- PostgreSQL database set up
- You have access to the database

## Step 1: Run Migration (1 minute)

```bash
npm run migration:run
```

Expected output:
```
query: SELECT * FROM "migrations" ...
migration AddCoordinators1710000000001 has been executed successfully.
```

## Step 2: Get Your Telegram User ID (1 minute)

1. Open Telegram
2. Send a message to `@userinfobot`
3. Copy your user ID (e.g., `123456789`)

## Step 3: Create Your Admin Account (2 minutes)

```bash
# Connect to database
psql -U postgres -d tg_building_bot

# Or if using different credentials
psql -h localhost -U your_user -d tg_building_bot
```

```sql
-- Create admin (replace YOUR_USER_ID and your_username)
INSERT INTO coordinators (
  id,
  "telegramUserId",
  username,
  role,
  "isActive",
  "createdAt",
  "updatedAt"
)
VALUES (
  gen_random_uuid(),
  'YOUR_USER_ID',        -- e.g., '123456789'
  'your_username',       -- e.g., 'john' (without @)
  'ADMIN',
  true,
  NOW(),
  NOW()
);

-- Verify
SELECT * FROM coordinators;
```

Expected output:
```
                  id                  | telegramUserId |  username  | role  | isActive
--------------------------------------+----------------+------------+-------+----------
 a1b2c3d4-e5f6-7890-abcd-ef1234567890 | 123456789      | john       | ADMIN | t
```

Exit psql: `\q`

## Step 4: Test (1 minute)

### Test 1: Admin Commands

Send this to your bot:
```
/help_admin
```

Expected response:
```
🔧 Admin Commands

Coordinator Management:
/assign @username object_name - Assign coordinator to object
...
```

### Test 2: Permission Check

1. Have another user (non-admin) try to click a button in any topic
2. They should see: `❌ You are not authorized to manage this object`

✅ **If you see admin commands and non-admins are blocked, RBAC is working!**

## Step 5: Add Your First Coordinator (2 minutes)

### Make someone a coordinator:

1. Ask them to send any message to your bot (e.g., "hello" or "/start")
2. As admin, assign them to an object:

```
/assign @their_username object_name
```

Example:
```
/assign @sarah Green City
```

Expected response:
```
✅ Assigned @sarah to "Green City Apartment"
```

Now Sarah can manage "Green City Apartment" but not other objects!

## Quick Command Reference

```bash
# Assign coordinator to object
/assign @username object_name

# Remove assignment
/unassign @username object_name

# Make someone admin
/promote @username ADMIN

# List all coordinators
/list_coordinators

# Show coordinators for an object
/coordinators object_name

# Show help
/help_admin
```

## Troubleshooting

### "Coordinator not found"

**Solution:** Ask the user to send any message to the bot first.

### "Object not found"

**Solution:** Use a longer object name or check exact name with `/coordinators`.

### Commands don't work

**Check:**
```sql
-- Am I an admin?
SELECT * FROM coordinators WHERE "telegramUserId" = 'YOUR_ID';
```

Role should be `ADMIN`, isActive should be `true`.

### Still can't access

**Force admin:**
```sql
UPDATE coordinators
SET role = 'ADMIN'
WHERE "telegramUserId" = 'YOUR_ID';
```

## What's Next?

✅ RBAC is now active
✅ You're an admin
✅ You can assign coordinators

**Next steps:**

1. Read full guide: [RBAC_SETUP_GUIDE.md](./RBAC_SETUP_GUIDE.md)
2. Review architecture: [COORDINATOR_ARCHITECTURE.md](./COORDINATOR_ARCHITECTURE.md)
3. See examples: [COORDINATOR_EXAMPLES.md](./COORDINATOR_EXAMPLES.md)

## Common Workflows

### Add New Team Member

```
1. They send /start to bot
2. You: /assign @newperson project_name
3. Done! They can now manage that project
```

### Change Permissions

```
# Give more access
/promote @username ADMIN

# Reduce access
/promote @username COORDINATOR
/unassign @username project_name
```

### Audit Access

```
# See everyone
/list_coordinators

# See who can manage specific project
/coordinators project_name
```

---

**Stuck?** Check [RBAC_SETUP_GUIDE.md](./RBAC_SETUP_GUIDE.md) for detailed troubleshooting.

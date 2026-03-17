# Superadmin Setup Guide

## Overview

Superadmins have **full access to ALL objects** in the system, regardless of coordinator assignments. This is useful for system administrators who need to manage everything.

## Key Differences

| Role | Scope | Configuration |
|------|-------|---------------|
| **Superadmin** | ALL objects, always | Environment variable |
| **Admin** | ALL objects | Database (coordinators table) |
| **Coordinator** | Assigned objects only | Database (coordinators table) |
| **Viewer** | Can view all, cannot manage | Database (coordinators table) |

## Setup

### 1. Find Your Telegram User ID

You need your Telegram user ID (not username). To find it:

**Option A: Use a bot**
1. Open Telegram
2. Search for `@userinfobot`
3. Start a conversation
4. It will show your user ID (e.g., `123456789`)

**Option B: Check your bot logs**
1. Interact with your bot
2. Check the logs - user IDs are logged when users interact
3. Look for lines like: `Created coordinator for user: 123456789`

### 2. Add Superadmin to .env

Edit your `.env` file:

```bash
# Superadmin Configuration (comma-separated Telegram user IDs)
# These users have full access to ALL objects regardless of coordinator assignments
TELEGRAM_SUPERADMIN_IDS=123456789
```

**Multiple superadmins:**
```bash
TELEGRAM_SUPERADMIN_IDS=123456789,987654321,555666777
```

### 3. Restart Your Application

```bash
npm run start:dev
```

You should see in the logs:
```
[CoordinatorsService] Loaded 1 superadmin user ID(s)
```

## How It Works

### Permission Hierarchy

When checking permissions, the system checks in this order:

1. **Is user a superadmin?** → ✅ FULL ACCESS
2. **Is user an Admin?** → ✅ Full access to all objects
3. **Is user a Coordinator?** → Access only to assigned objects
4. **Is user a Viewer?** → Can view all, cannot manage

### What Superadmins Can Do

✅ Manage ALL objects (add photos, complete stages, pause/resume)
✅ Use ALL admin commands (`/assign`, `/unassign`, `/promote`, etc.)
✅ Access objects without being explicitly assigned
✅ Bypass coordinator assignments completely

### Example Scenarios

**Scenario 1: Regular Coordinator**
- User ID: `111111111`
- Role: COORDINATOR
- Assigned to: Object A, Object B
- Can manage: ❌ Object C, ✅ Object A, ✅ Object B

**Scenario 2: Superadmin**
- User ID: `123456789` (configured in .env)
- Role: None (doesn't need database entry)
- Can manage: ✅ Object A, ✅ Object B, ✅ Object C, ✅ ALL objects

**Scenario 3: Admin**
- User ID: `222222222`
- Role: ADMIN (in database)
- Can manage: ✅ Object A, ✅ Object B, ✅ Object C, ✅ ALL objects

## Security Notes

⚠️ **Important:**
- Superadmin IDs are stored in the `.env` file
- Never commit `.env` to version control
- Keep your `.env` file secure
- Only grant superadmin access to trusted system administrators
- Superadmins bypass all permission checks

## Verification

To verify superadmin is working:

1. Start the bot
2. Check logs for: `Loaded X superadmin user ID(s)`
3. Try managing any object with your superadmin account
4. You should have full access without being assigned

## Troubleshooting

**Problem: "You are not authorized to manage this object"**

Check:
1. Is your user ID correctly added to `TELEGRAM_SUPERADMIN_IDS`?
2. Did you restart the app after adding it?
3. Are there any spaces in the user ID?
4. Use commas to separate multiple IDs (no spaces around commas)

**Problem: Superadmin count shows 0**

Check:
1. Is the `.env` variable named exactly `TELEGRAM_SUPERADMIN_IDS`?
2. Is the format correct? `TELEGRAM_SUPERADMIN_IDS=123456789`
3. No quotes needed around the numbers
4. Restart the application

## Changing Superadmins

To add/remove superadmins:

1. Edit `.env` file
2. Update `TELEGRAM_SUPERADMIN_IDS`
3. Restart the application

Changes take effect immediately after restart.

## FAQ

**Q: Can a superadmin be in the database as a coordinator too?**
A: Yes, but it's not necessary. Superadmin access is granted purely by being in the environment variable.

**Q: Do superadmins need to be added to the coordinators table?**
A: No, they don't need any database entry. They get full access automatically.

**Q: What's the difference between superadmin and admin role?**
A: Superadmins are configured in environment (infrastructure level), Admins are configured in database (application level). Both have full access.

**Q: Can I make someone temporarily a superadmin?**
A: Yes, add their ID to `.env`, restart the app. Remove it and restart when done.

# 🚀 START HERE

**New to this bot?** Follow these steps in order.

---

## 📋 What You Need (5 minutes)

Before starting, prepare:

1. **Telegram account** (you already have this)
2. **Google account** (for photo storage)
3. **Computer** with terminal access
4. **30-45 minutes** of time

---

## 🎯 Three Documents - Pick One

### 🏃 Quick Setup (For Experienced Developers)

**Already have Node.js and PostgreSQL installed?**

👉 **Read: [QUICKSTART.md](./QUICKSTART.md)**

*Time: 10 minutes*

---

### 📚 Complete Setup (For Everyone)

**Never set up a bot before?**

👉 **Read: [COMPLETE_SETUP_GUIDE.md](./COMPLETE_SETUP_GUIDE.md)**

*Time: 30-45 minutes*

This walks you through:
- Installing Node.js
- Installing PostgreSQL
- Creating Telegram bot
- Setting up Google Drive
- Starting the bot
- Testing everything

---

### ✅ Printable Checklist (For Tracking Progress)

**Want to print and check off items?**

👉 **Read: [SETUP_CHECKLIST.md](./SETUP_CHECKLIST.md)**

*Print this and check boxes as you complete setup*

---

## 🆘 Already Set Up? Need Help?

### Managing Coordinators

👉 **Read: [RBAC_QUICK_START.md](./RBAC_QUICK_START.md)**

Learn how to:
- Assign people to projects
- Change permissions
- Make someone admin

---

### Understanding the System

👉 **Read: [README.md](./README.md)**

Full documentation:
- Features overview
- Configuration options
- Troubleshooting
- Production deployment

---

### Admin Commands Reference

👉 **Read: [RBAC_SETUP_GUIDE.md](./RBAC_SETUP_GUIDE.md)**

Complete admin guide:
- All commands explained
- Permission system
- Real-world examples
- Troubleshooting

---

## 🔧 Common Issues

### "I installed everything but bot won't start"

1. Check logs for error message
2. Verify `.env` file exists and filled out
3. Test database: `psql -U bot_user -d tg_building_bot`
4. Check [COMPLETE_SETUP_GUIDE.md](./COMPLETE_SETUP_GUIDE.md) troubleshooting section

### "Bot starts but doesn't respond in Telegram"

1. Is bot admin in the group? (Group → Info → Administrators)
2. Are forum topics enabled? (Group → Settings → Topics)
3. Did you add bot to group?

### "Photos don't upload to Google Drive"

1. Is Drive folder shared with service account email?
2. Does service account have "Editor" permission (not Viewer)?
3. Is Google Drive API enabled in Cloud Console?

### "User gets 'not authorized' message"

1. Did you create your admin account in database?
2. Did you run migrations? `npm run migration:run`
3. Check [RBAC_QUICK_START.md](./RBAC_QUICK_START.md)

---

## 📖 All Documentation

| Document | Purpose | When to Read |
|----------|---------|--------------|
| **START_HERE.md** | This file | Right now! |
| **COMPLETE_SETUP_GUIDE.md** | Full setup from scratch | Setting up first time |
| **QUICKSTART.md** | Quick setup for developers | You know Node.js/PostgreSQL |
| **SETUP_CHECKLIST.md** | Printable checklist | Tracking progress |
| **README.md** | Main documentation | After setup, for reference |
| **RBAC_QUICK_START.md** | Permission setup | Adding coordinators |
| **RBAC_SETUP_GUIDE.md** | Complete RBAC guide | Managing permissions |
| **ARCHITECTURE.md** | Technical architecture | Understanding internals |
| **API.md** | Service API reference | Developing extensions |
| **COORDINATOR_EXAMPLES.md** | Permission examples | Understanding roles |

---

## 🎓 Learning Path

**Never set up a bot before?**
```
1. START_HERE.md (this file)
2. COMPLETE_SETUP_GUIDE.md (full setup)
3. RBAC_QUICK_START.md (add coordinators)
4. README.md (reference)
```

**Experienced developer?**
```
1. START_HERE.md (this file)
2. QUICKSTART.md (fast setup)
3. RBAC_QUICK_START.md (permissions)
4. Done!
```

**Just managing users?**
```
1. START_HERE.md (this file)
2. RBAC_QUICK_START.md (learn commands)
3. RBAC_SETUP_GUIDE.md (detailed guide)
```

---

## ✨ What This Bot Does

**Telegram Construction Tracker**

- 📱 Create projects as Telegram forum topics
- 📸 Upload 3-10 photos per construction stage
- ☁️ Auto-backup to Google Drive
- 👥 Assign different coordinators to different projects
- 🔔 Daily reminders at 4 PM
- ⚠️ Alerts for stalled projects (7+ days)
- 📊 Track progress through 5 stages:
  1. Preparation
  2. Rough construction
  3. Engineering
  4. Finishing
  5. Final check

---

## 🏁 Ready to Start?

**Choose your path:**

👉 **Experienced:** [QUICKSTART.md](./QUICKSTART.md)

👉 **New to this:** [COMPLETE_SETUP_GUIDE.md](./COMPLETE_SETUP_GUIDE.md)

👉 **Want checklist:** [SETUP_CHECKLIST.md](./SETUP_CHECKLIST.md)

---

## 💡 Pro Tips

1. **Read the right guide** - Don't skip steps if you're new
2. **Keep .env safe** - Never share or commit it
3. **Test each step** - Don't wait until the end
4. **Save credentials** - Bot token, passwords, etc.
5. **Use checklist** - Print SETUP_CHECKLIST.md and check off items

---

## 🎯 Success = All These Work

- ✅ Bot starts: `npm run start:dev`
- ✅ Admin commands work: `/help_admin` in Telegram
- ✅ Create topic in group → Bot responds
- ✅ Upload photos → Appear in Google Drive
- ✅ Complete stage → Progress to next
- ✅ Assign coordinator → They can manage project

**Got all 6?** 🎉 You're done!

**Missing some?** Check troubleshooting in your setup guide.

---

**Questions?** Read the setup guide carefully - answers are there!

**Still stuck?** Check the troubleshooting section - it covers 95% of issues!

**Good luck! 🚀**

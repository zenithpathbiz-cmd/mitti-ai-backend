// ══════════════════════════════════════════════════════════
//  NOTIFICATIONS ROUTES
//  GET  /api/notifications
//  POST /api/notifications/mark-read
//  POST /api/notifications/broadcast  (admin)
// ══════════════════════════════════════════════════════════
const router  = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { auth } = require('../middleware/auth');
const { ok, err } = require('../utils/response');
const prisma  = new PrismaClient();

router.get('/', auth, async (req, res) => {
  try {
    const notifs = await prisma.notification.findMany({
      where: { OR: [{ userId: req.user.id }, { userId: null }] },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    ok(res, { notifications: notifs, unread: notifs.filter(n => !n.isRead).length });
  } catch (e) {
    err(res, 'Failed to fetch notifications', 500);
  }
});

router.post('/mark-read', auth, async (req, res) => {
  const { ids } = req.body;
  try {
    await prisma.notification.updateMany({
      where: { id: { in: ids }, OR: [{ userId: req.user.id }, { userId: null }] },
      data: { isRead: true },
    });
    ok(res, {}, 'Marked as read');
  } catch (e) {
    err(res, 'Failed to mark read', 500);
  }
});

router.post('/broadcast', auth, async (req, res) => {
  if (req.user.phone !== process.env.ADMIN_PHONE)
    return res.status(403).json({ error: 'Admin only' });
  const { title, body, icon, type } = req.body;
  try {
    const notif = await prisma.notification.create({
      data: { title, body, icon: icon || '📢', type: type || 'general', userId: null },
    });
    ok(res, { notif }, 'Broadcast sent');
  } catch (e) {
    err(res, 'Broadcast failed', 500);
  }
});

module.exports = router;

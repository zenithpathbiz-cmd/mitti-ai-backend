// ══════════════════════════════════════════════════════════
//  ADMIN ROUTES  —  Analytics & Dashboard Data
//  GET /api/admin/stats
//  GET /api/admin/users
//  GET /api/admin/queries
// ══════════════════════════════════════════════════════════
const router  = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { auth } = require('../middleware/auth');
const { ok, err } = require('../utils/response');
const prisma  = new PrismaClient();

// Middleware: simple admin check (extend with role later)
const adminOnly = (req, res, next) => {
  if (req.user?.phone === process.env.ADMIN_PHONE) return next();
  return res.status(403).json({ error: 'Admin access only' });
};

// GET /api/admin/stats
router.get('/stats', auth, adminOnly, async (req, res) => {
  try {
    const [totalUsers, activeUsers, totalQueries, totalOrders, totalSoilTests] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.query.count(),
      prisma.order.count(),
      prisma.soilTest.count(),
    ]);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const newUsersThisWeek = await prisma.user.count({ where: { createdAt: { gte: weekAgo } } });
    const queryTypes = await prisma.query.groupBy({ by: ['type'], _count: true });
    ok(res, { totalUsers, activeUsers, totalQueries, totalOrders, totalSoilTests, newUsersThisWeek, queryTypes });
  } catch (e) {
    err(res, 'Stats fetch failed', 500);
  }
});

// GET /api/admin/users?page=1&limit=20
router.get('/users', auth, adminOnly, async (req, res) => {
  const page  = parseInt(req.query.page)  || 1;
  const limit = parseInt(req.query.limit) || 20;
  try {
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip: (page - 1) * limit, take: limit,
        orderBy: { createdAt: 'desc' },
        select: { id:true, phone:true, name:true, village:true, district:true, language:true, createdAt:true, isActive:true,
          _count: { select: { queries:true, soilTests:true, orders:true } } },
      }),
      prisma.user.count(),
    ]);
    ok(res, { users, total, page, pages: Math.ceil(total / limit) });
  } catch (e) {
    err(res, 'Users fetch failed', 500);
  }
});

// GET /api/admin/queries?type=SOIL_HEALTH
router.get('/queries', auth, adminOnly, async (req, res) => {
  const { type, page = 1, limit = 30 } = req.query;
  try {
    const where = type ? { type } : {};
    const [queries, total] = await Promise.all([
      prisma.query.findMany({
        where, skip: (parseInt(page)-1)*parseInt(limit), take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name:true, phone:true, district:true } } },
      }),
      prisma.query.count({ where }),
    ]);
    ok(res, { queries, total });
  } catch (e) {
    err(res, 'Queries fetch failed', 500);
  }
});

module.exports = router;

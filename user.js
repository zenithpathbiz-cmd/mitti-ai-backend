const router  = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { auth } = require('../middleware/auth');
const { ok, err } = require('../utils/response');
const prisma  = new PrismaClient();

// GET /api/user/profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id:true, phone:true, name:true, village:true, district:true, language:true, createdAt:true,
        _count: { select: { queries:true, soilTests:true, orders:true, listings:true } } },
    });
    ok(res, { user });
  } catch (e) {
    err(res, 'Profile fetch failed', 500);
  }
});

// PUT /api/user/profile
router.put('/profile', auth, async (req, res) => {
  const { name, village, district, language, deviceToken } = req.body;
  try {
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { name, village, district, ...(language && { language }), ...(deviceToken && { deviceToken }) },
    });
    ok(res, { user }, 'Profile updated');
  } catch (e) {
    err(res, 'Profile update failed', 500);
  }
});

module.exports = router;

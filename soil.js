// ══════════════════════════════════════════════════════════
//  SOIL TEST ROUTES  —  POST /api/soil/test
//                       GET  /api/soil/history
// ══════════════════════════════════════════════════════════
const router    = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { auth }  = require('../middleware/auth');
const { analyzeSoil } = require('../services/bhojpuriAI');
const { ok, err } = require('../utils/response');
const logger    = require('../config/logger');
const prisma    = new PrismaClient();

// POST /api/soil/test
router.post('/test', auth, async (req, res) => {
  const { nitrogen, phosphorus, potassium, ph, language } = req.body;
  if (!nitrogen || !phosphorus || !potassium)
    return err(res, 'N, P, K values required', 400);
  try {
    const report = await analyzeSoil({ nitrogen, phosphorus, potassium, ph, language: language || req.user.language });
    // Save to DB
    const saved = await prisma.soilTest.create({
      data: {
        userId: req.user.id,
        nitrogen: parseFloat(nitrogen),
        phosphorus: parseFloat(phosphorus),
        potassium: parseFloat(potassium),
        ph: ph ? parseFloat(ph) : null,
        aiReport: report.summary,
        cropSuggestions: report.crops || [],
        fertilizerPlan: report.fertilizer,
      },
    });
    ok(res, { id: saved.id, report }, 'Soil analysis complete');
  } catch (e) {
    logger.error('Soil test error:', e);
    err(res, 'Soil analysis failed', 500);
  }
});

// GET /api/soil/history
router.get('/history', auth, async (req, res) => {
  try {
    const tests = await prisma.soilTest.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    ok(res, { tests });
  } catch (e) {
    err(res, 'Failed to fetch history', 500);
  }
});

module.exports = router;

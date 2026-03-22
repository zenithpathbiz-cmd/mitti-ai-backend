// ══════════════════════════════════════════════════════════
//  AI ROUTES  —  Multi-language Chat + Disease Detection
//  POST /api/ai/ask
//  POST /api/ai/disease
//  POST /api/ai/voice-ask   (returns audio-optimised text)
// ══════════════════════════════════════════════════════════
const router  = require('express').Router();
const multer  = require('multer');
const { PrismaClient } = require('@prisma/client');
const { auth } = require('../middleware/auth');
const { askMittiAI, detectDisease, detectLanguage } = require('../services/bhojpuriAI');
const { ok, err } = require('../utils/response');
const prisma  = new PrismaClient();
const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// POST /api/ai/ask
router.post('/ask', auth, async (req, res) => {
  const { question, language, type = 'GENERAL', history = [] } = req.body;
  if (!question?.trim()) return err(res, 'question required', 400);
  try {
    const lang   = language || req.user.language || detectLanguage(question);
    const result = await askMittiAI({ question, language: lang, conversationHistory: history, type });
    // Log to DB
    await prisma.query.create({
      data: { userId: req.user.id, type, input: question, response: result.answer, language: lang, duration: result.durationMs },
    });
    ok(res, { answer: result.answer, language: result.detectedLang, ms: result.durationMs });
  } catch (e) {
    err(res, 'AI response failed', 500);
  }
});

// POST /api/ai/voice-ask
router.post('/voice-ask', auth, async (req, res) => {
  const { transcript, language } = req.body;
  if (!transcript?.trim()) return err(res, 'transcript required', 400);
  try {
    const lang   = language || req.user.language || 'HINDI';
    const result = await askMittiAI({ question: transcript, language: lang, type: 'GENERAL' });
    // Short answer for TTS
    const ttsAnswer = result.answer.replace(/\n+/g, ' ').trim();
    ok(res, { answer: result.answer, ttsAnswer, language: lang });
  } catch (e) {
    err(res, 'Voice AI failed', 500);
  }
});

// POST /api/ai/disease  (multipart/form-data with image)
router.post('/disease', auth, upload.single('image'), async (req, res) => {
  if (!req.file) return err(res, 'image file required', 400);
  const language = req.body.language || req.user.language || 'HINDI';
  try {
    const imageBase64 = req.file.buffer.toString('base64');
    const mediaType   = req.file.mimetype;
    const result = await detectDisease({ imageBase64, mediaType, language });
    await prisma.query.create({
      data: { userId: req.user.id, type: 'DISEASE_DETECTION', input: 'image upload', response: JSON.stringify(result), language },
    });
    ok(res, { result });
  } catch (e) {
    err(res, 'Disease detection failed', 500);
  }
});

module.exports = router;

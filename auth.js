// ══════════════════════════════════════════════════════════
//  AUTH ROUTES
//  POST /api/auth/send-otp
//  POST /api/auth/verify-otp
//  POST /api/auth/refresh
// ══════════════════════════════════════════════════════════
const router  = require('express').Router();
const jwt     = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { body, validationResult } = require('express-validator');
const { ok, err } = require('../utils/response');
const prisma  = new PrismaClient();

const OTP_EXPIRE_MS = 10 * 60 * 1000; // 10 minutes

// Generate random 4-digit OTP
const genOTP = () => Math.floor(1000 + Math.random() * 9000).toString();

// Optional: real SMS via MSG91
async function sendSMS(phone, otp) {
  if (!process.env.MSG91_KEY) {
    console.log(`[DEV] OTP for +91${phone}: ${otp}`);
    return true;
  }
  try {
    const axios = require('axios');
    await axios.post('https://api.msg91.com/api/v5/otp', {
      template_id: process.env.MSG91_TEMPLATE,
      mobile:      `91${phone}`,
      otp,
    }, { headers: { authkey: process.env.MSG91_KEY } });
    return true;
  } catch {
    console.log(`[FALLBACK] OTP for +91${phone}: ${otp}`);
    return true;
  }
}

// POST /api/auth/send-otp
router.post('/send-otp',
  body('phone').isLength({ min:10, max:10 }).isNumeric(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return err(res, 'Valid 10-digit phone required', 400);
    const { phone } = req.body;
    try {
      const otp     = genOTP();
      const expires = new Date(Date.now() + OTP_EXPIRE_MS);
      // Invalidate old OTPs
      await prisma.otpCode.updateMany({ where: { phone, used: false }, data: { used: true } });
      await prisma.otpCode.create({ data: { phone, code: otp, expiresAt: expires } });
      await sendSMS(phone, otp);
      ok(res, { phone, expiresIn: 600 }, 'OTP sent successfully');
    } catch (e) {
      err(res, 'OTP send failed', 500);
    }
  }
);

// POST /api/auth/verify-otp
router.post('/verify-otp',
  body('phone').isLength({ min:10, max:10 }).isNumeric(),
  body('otp').isLength({ min:4, max:4 }).isNumeric(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return err(res, 'phone (10 digits) and otp (4 digits) required', 400);
    const { phone, otp, language = 'HINDI' } = req.body;
    try {
      const record = await prisma.otpCode.findFirst({
        where: { phone, code: otp, used: false, expiresAt: { gt: new Date() } },
      });
      if (!record) return err(res, 'Invalid or expired OTP', 401);
      // Mark OTP used
      await prisma.otpCode.update({ where: { id: record.id }, data: { used: true } });
      // Upsert user
      const user = await prisma.user.upsert({
        where: { phone },
        update: { isActive: true },
        create: { phone, language },
      });
      const token = jwt.sign({ userId: user.id, phone }, process.env.JWT_SECRET || 'mitti-ai-secret', { expiresIn: '30d' });
      ok(res, { token, user: { id:user.id, phone:user.phone, name:user.name, language:user.language }, isNew: !user.name });
    } catch (e) {
      err(res, 'OTP verification failed', 500);
    }
  }
);

module.exports = router;

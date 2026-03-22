// ═══════════════════════════════════════════════════════════
//  MIDDLEWARE + CONFIG + SERVICES
// ═══════════════════════════════════════════════════════════

// ── src/middleware/auth.js ────────────────────────────────
// JWT authentication middleware

const jwt    = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Login करें पहले" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) return res.status(401).json({ error: "User नहीं मिला" });

    // Update last active
    await prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() },
    });

    req.user = user;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Session expire हो गया। फिर login करें।" });
    }
    res.status(401).json({ error: "Invalid token" });
  }
};

const adminAuth = async (req, res, next) => {
  await auth(req, res, () => {
    if (!process.env.ADMIN_USER_IDS?.split(",").includes(req.user.id)) {
      return res.status(403).json({ error: "Admin access नहीं है" });
    }
    next();
  });
};

module.exports = { auth, adminAuth };

// ─────────────────────────────────────────────────────────
// ── src/config/database.js ───────────────────────────────

const { PrismaClient: Prisma2 } = require("@prisma/client");
const logger2 = require("./logger");

let prismaInstance = null;

async function connectDB() {
  try {
    prismaInstance = new Prisma2();
    await prismaInstance.$connect();
    logger2.info("✅ PostgreSQL connected via Prisma");
    return prismaInstance;
  } catch (err) {
    logger2.error("❌ DB connection failed:", err);
    process.exit(1);
  }
}

module.exports = { connectDB, getPrisma: () => prismaInstance };

// ─────────────────────────────────────────────────────────
// ── src/config/logger.js ─────────────────────────────────

const winston = require("winston");

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message }) =>
          `${timestamp} [${level}]: ${message}`
        )
      ),
    }),
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
  ],
});

module.exports = logger;

// ─────────────────────────────────────────────────────────
// ── src/services/smsService.js ───────────────────────────
// Twilio OTP sender (falls back to console in dev)

const sendOTP = async (phone, otp) => {
  if (process.env.NODE_ENV === "development") {
    console.log(`\n📱 [DEV] OTP for +91-${phone}: ${otp}\n`);
    return;
  }

  // Production: Twilio
  try {
    const twilio = require("twilio")(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    await twilio.messages.create({
      body: `🌱 MITTI AI OTP: ${otp}\nValid for 5 minutes.\nDo not share with anyone.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: `+91${phone}`,
    });
  } catch (err) {
    // Fallback: MSG91
    const axios = require("axios");
    await axios.post("https://api.msg91.com/api/v5/otp", {
      template_id: process.env.MSG91_TEMPLATE_ID,
      mobile: `91${phone}`,
      authkey: process.env.MSG91_AUTH_KEY,
      otp,
    });
  }
};

module.exports = { sendOTP };

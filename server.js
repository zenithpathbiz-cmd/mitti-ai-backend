// ══════════════════════════════════════════════════════════
//  MITTI AI  —  Express Server  v4.0
//  Production-ready: Security · Logging · Rate Limiting
// ══════════════════════════════════════════════════════════
require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const morgan       = require('morgan');
const compression  = require('compression');
const rateLimit    = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 5000;

// ── Security Middleware ───────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: [process.env.FRONTEND_URL || 'http://localhost:3000', 'https://mitti-ai.vercel.app'],
  credentials: true,
}));
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Rate Limiting ─────────────────────────────────────────
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, message: { error: 'Too many requests' } });
const aiLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, message: { error: 'AI rate limit: 20 req/min' } });
app.use('/api/', limiter);
app.use('/api/ai/', aiLimiter);

// ── Routes ────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/user',          require('./routes/user'));
app.use('/api/ai',            require('./routes/ai'));
app.use('/api/soil',          require('./routes/soil'));
app.use('/api/crop',          require('./routes/crop'));
app.use('/api/mandi',         require('./routes/mandi'));
app.use('/api/market',        require('./routes/market'));
app.use('/api/weather',       require('./routes/weather'));
app.use('/api/schemes',       require('./routes/schemes'));
app.use('/api/admin',         require('./routes/admin'));
app.use('/api/notifications', require('./routes/notifications'));

// ── Health Check ──────────────────────────────────────────
app.get('/health', (req, res) => res.json({
  status: 'OK', service: 'MITTI AI Backend', version: '4.0.0',
  uptime: process.uptime(), timestamp: new Date().toISOString(),
}));

// ── 404 Handler ───────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: `Route ${req.method} ${req.path} not found` }));

// ── Error Handler ─────────────────────────────────────────
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error', message: process.env.NODE_ENV === 'development' ? error.message : undefined });
});

app.listen(PORT, () => console.log(`\n🌱 MITTI AI Backend v4.0\n🚀 Running on http://localhost:${PORT}\n📊 Health: http://localhost:${PORT}/health\n`));
module.exports = app;

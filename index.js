// ── Config / Environment ─────────────────────
require('dotenv').config();

module.exports = {
  PORT:         process.env.PORT         || 5000,
  NODE_ENV:     process.env.NODE_ENV     || 'development',
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET:   process.env.JWT_SECRET   || 'mitti-ai-super-secret-change-in-prod',
  JWT_EXPIRES:  process.env.JWT_EXPIRES  || '30d',
  ANTHROPIC_KEY:process.env.ANTHROPIC_API_KEY,
  REDIS_URL:    process.env.REDIS_URL    || 'redis://localhost:6379',
  OTP_EXPIRE_MIN: 10,
  // SMS (MSG91)
  MSG91_KEY:    process.env.MSG91_KEY,
  MSG91_SENDER: process.env.MSG91_SENDER || 'MITIAI',
  MSG91_TEMPLATE: process.env.MSG91_TEMPLATE,
  // Agmarknet (Govt Mandi API)
  AGMARKNET_URL: 'https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070',
  AGMARKNET_KEY: process.env.AGMARKNET_KEY,
  // Weather
  WEATHER_KEY:  process.env.OPENWEATHER_KEY,
  WEATHER_URL:  'https://api.openweathermap.org/data/2.5',
};

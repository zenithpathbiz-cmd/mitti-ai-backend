// config/index.js

const config = {
    PORT: process.env.PORT || 3000,
    NODE_ENV: process.env.NODE_ENV || 'development',
    DATABASE_URL: process.env.DATABASE_URL || '',
    JWT_SECRET: process.env.JWT_SECRET || '',
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
    // Add other service keys below
    // SERVICE_KEY: process.env.SERVICE_KEY || '',
};

module.exports = config;

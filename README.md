# 🌱 MITTI AI — Backend API v4.0

Production-ready Node.js backend for MITTI AI — the digital agriculture assistant for Bihar farmers.

## ✅ Features
- 🔐 OTP Authentication (JWT + MSG91)
- 🤖 Claude AI Chat (Hindi · Bhojpuri · English)
- 🪴 Soil NPK Analysis
- 🌾 Crop Advisory
- 📊 Live Mandi Rates (data.gov.in + AI fallback)
- 📸 Crop Disease Detection (Vision AI)
- 🌦️ Weather Forecast (OpenWeather + AI)
- 📜 Govt Schemes Eligibility
- 🛒 DhaniGram Marketplace
- 📢 Push Notifications
- 📊 Admin Dashboard

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Setup environment
cp .env.example .env
# Fill in your API keys

# 3. Start database
docker compose up postgres redis -d

# 4. Run migrations + seed
npx prisma migrate dev
node prisma/seed.js

# 5. Start server
npm run dev
```

## 🐳 Docker (Full Stack)

```bash
docker compose up --build
```

## 🔗 API Endpoints

| Method | Endpoint                    | Description              |
|--------|-----------------------------|--------------------------|
| POST   | /api/auth/send-otp          | Send OTP to phone        |
| POST   | /api/auth/verify-otp        | Verify OTP, get JWT      |
| GET    | /api/user/profile           | Get farmer profile       |
| PUT    | /api/user/profile           | Update profile           |
| POST   | /api/ai/ask                 | AI chat (multi-language) |
| POST   | /api/ai/voice-ask           | Voice transcript → AI    |
| POST   | /api/ai/disease             | Crop disease from image  |
| POST   | /api/soil/test              | NPK soil analysis        |
| GET    | /api/soil/history           | Past soil tests          |
| GET    | /api/crop/list              | All crops list           |
| POST   | /api/crop/advisory          | Crop-specific advice     |
| GET    | /api/mandi/rates            | Live mandi prices        |
| GET    | /api/mandi/rates/:crop      | Single crop price        |
| GET    | /api/weather/forecast       | 7-day weather            |
| GET    | /api/schemes/list           | Govt schemes             |
| POST   | /api/schemes/eligibility    | Check eligibility        |
| GET    | /api/market/listings        | Marketplace listings     |
| POST   | /api/market/listings        | Create listing           |
| POST   | /api/market/order           | Place order              |
| GET    | /api/admin/stats            | Dashboard stats          |

## 🌐 Languages Supported
- **Hindi** (हिंदी) — default
- **Bhojpuri** (भोजपुरी) — auto-detected or user preference  
- **English** — for urban/tech users

## 📦 Tech Stack
- **Runtime**: Node.js 20
- **Framework**: Express.js
- **Database**: PostgreSQL (via Prisma ORM)
- **Cache**: Redis
- **AI**: Claude claude-sonnet-4-20250514 (Anthropic)
- **Auth**: JWT + OTP (MSG91)
- **Container**: Docker + Docker Compose

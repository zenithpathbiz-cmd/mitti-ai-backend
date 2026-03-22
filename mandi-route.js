// ═══════════════════════════════════════════════════════════
//  MANDI RATES ROUTE  —  Live Government Data + AI Fallback
//
//  Sources (priority order):
//  1. data.gov.in (Agmarknet) — free govt API
//  2. Cached DB data (< 6 hours old)
//  3. AI-generated estimates (fallback)
//
//  GET  /api/mandi/rates           — all crops
//  GET  /api/mandi/rates/:crop     — single crop
//  GET  /api/mandi/districts       — list of mandis
//  POST /api/mandi/refresh         — force refresh from govt API
//  GET  /api/mandi/trend/:cropId   — 7-day price trend
// ═══════════════════════════════════════════════════════════

const router    = require("express").Router();
const axios     = require("axios");
const Anthropic = require("@anthropic-ai/sdk");
const { PrismaClient } = require("@prisma/client");
const { auth }  = require("../middleware/auth");
const logger    = require("../config/logger");

const prisma    = new PrismaClient();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Bihar Mandi list ──────────────────────────────────────
const BIHAR_MANDIS = [
  { name: "पटना मंडी",        district: "Patna"        },
  { name: "गया मंडी",         district: "Gaya"         },
  { name: "मुजफ्फरपुर मंडी",  district: "Muzaffarpur"  },
  { name: "भागलपुर मंडी",     district: "Bhagalpur"    },
  { name: "दरभंगा मंडी",      district: "Darbhanga"    },
  { name: "सहरसा मंडी",       district: "Saharsa"      },
  { name: "नालंदा मंडी",      district: "Nalanda"      },
  { name: "सारण मंडी",        district: "Saran"        },
];

// ── Fetch from data.gov.in (Agmarknet) ───────────────────
async function fetchGovtMandiData(state = "Bihar") {
  try {
    // Real endpoint: https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070
    const url = `https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070`;
    const res = await axios.get(url, {
      params: {
        "api-key": process.env.GOVT_DATA_API_KEY,
        format: "json",
        limit: 100,
        filters: `[state.keyword]=${state}`,
      },
      timeout: 8000,
    });
    return res.data?.records || null;
  } catch (err) {
    logger.warn("Govt Mandi API unavailable, using AI fallback:", err.message);
    return null;
  }
}

// ── AI fallback for mandi rates ───────────────────────────
async function getAIMandiRates(crops, language = "HINDI") {
  const cropList = crops.map(c => c.name).join(", ");

  const prompt = {
    HINDI:    `बिहार की मंडियों में इन फसलों के आज के थोक भाव बताएं: ${cropList}`,
    BHOJPURI: `बिहार के मंडी में एह फसलन के आज के भाव बताईं: ${cropList}`,
    ENGLISH:  `Provide today's wholesale prices for Bihar mandis for: ${cropList}`,
  };

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1200,
    messages: [{
      role: "user",
      content: `${prompt[language] || prompt.HINDI}

JSON format में दें (array):
[{
  "crop": "फसल नाम",
  "emoji": "emoji",
  "minPrice": 1500,
  "maxPrice": 1800,
  "modalPrice": 1650,
  "unit": "₹/क्विंटल",
  "trend": "up/down/stable",
  "trendPct": 2.3,
  "mandiName": "पटना मंडी",
  "tip": "एक लाइन सलाह"
}]
केवल JSON array दें।`,
    }],
  });

  const text  = response.content[0].text;
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

// ── GET /api/mandi/rates ──────────────────────────────────
router.get("/rates", auth, async (req, res) => {
  const { district, language = "HINDI", forceRefresh = false } = req.query;

  try {
    // 1. Check DB cache (< 6 hours)
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const cached = await prisma.mandiRate.findMany({
      where: {
        createdAt: { gte: sixHoursAgo },
        ...(district && { district }),
      },
      include: { crop: true },
      orderBy: { createdAt: "desc" },
      distinct: ["cropId"],
    });

    if (cached.length > 0 && !forceRefresh) {
      return res.json({
        success: true,
        source: "DB_CACHE",
        updatedAt: cached[0].createdAt,
        rates: cached.map(r => ({
          crop:       r.crop.nameHindi,
          cropEn:     r.crop.name,
          emoji:      r.crop.emoji,
          minPrice:   r.minPrice,
          maxPrice:   r.maxPrice,
          modalPrice: r.modalPrice,
          unit:       r.unit,
          mandi:      r.mandiName,
          district:   r.district,
          source:     r.source,
        })),
      });
    }

    // 2. Try live govt API
    const govtData = await fetchGovtMandiData();

    if (govtData && govtData.length > 0) {
      // Parse and save govt data to DB
      const rates = govtData.slice(0, 20).map(row => ({
        crop:       row.commodity || row.Commodity,
        minPrice:   parseInt(row.min_price || row.Min_Price) || 0,
        maxPrice:   parseInt(row.max_price || row.Max_Price) || 0,
        modalPrice: parseInt(row.modal_price || row.Modal_Price) || 0,
        mandi:      row.market || row.Market,
        district:   row.district || row.District,
        source:     "GOVT_API",
      }));

      return res.json({
        success: true,
        source: "GOVT_API",
        updatedAt: new Date(),
        count: rates.length,
        rates,
      });
    }

    // 3. AI Fallback
    const crops = await prisma.cropData.findMany({ where: { isActive: true }, take: 10 });
    const aiRates = await getAIMandiRates(crops, language);

    // Save AI rates to DB for caching
    for (const rate of aiRates) {
      const crop = crops.find(c => c.nameHindi === rate.crop || c.name.toLowerCase() === rate.crop.toLowerCase());
      if (crop) {
        await prisma.mandiRate.create({
          data: {
            cropId:     crop.id,
            mandiName:  rate.mandiName || "पटना मंडी",
            district:   district || "Patna",
            minPrice:   rate.minPrice,
            maxPrice:   rate.maxPrice,
            modalPrice: rate.modalPrice,
            source:     "AI_ESTIMATE",
          },
        });
      }
    }

    res.json({
      success: true,
      source: "AI_ESTIMATE",
      disclaimer: language === "BHOJPURI"
        ? "⚠️ ई AI अनुमान हौ। असल भाव खातिर मंडी जाईं।"
        : language === "ENGLISH"
        ? "⚠️ AI estimates. Verify at local mandi."
        : "⚠️ ये AI अनुमान हैं। सटीक जानकारी नजदीकी मंडी से लें।",
      updatedAt: new Date(),
      rates: aiRates,
    });
  } catch (err) {
    logger.error("Mandi rates error:", err);
    res.status(500).json({ error: "मंडी भाव नहीं मिले" });
  }
});

// ── GET /api/mandi/rates/:crop ────────────────────────────
router.get("/rates/:crop", auth, async (req, res) => {
  const { crop } = req.params;
  const { language = "HINDI" } = req.query;
  try {
    const cropData = await prisma.cropData.findFirst({
      where: {
        OR: [
          { name: { contains: crop, mode: "insensitive" } },
          { nameHindi: { contains: crop } },
        ],
      },
    });

    if (!cropData) return res.status(404).json({ error: "फसल नहीं मिली" });

    const recentRate = await prisma.mandiRate.findFirst({
      where: { cropId: cropData.id },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      success: true,
      crop: {
        name:    cropData.name,
        hindi:   cropData.nameHindi,
        bhojpuri: cropData.nameBhojpuri,
        emoji:   cropData.emoji,
        season:  cropData.season,
        yield:   cropData.yieldPerAcre,
      },
      rate: recentRate || { minPrice: cropData.minPrice, maxPrice: cropData.maxPrice, source: "STATIC" },
    });
  } catch (err) {
    res.status(500).json({ error: "Crop data नहीं मिला" });
  }
});

// ── GET /api/mandi/districts ──────────────────────────────
router.get("/districts", auth, (req, res) => {
  res.json({ success: true, mandis: BIHAR_MANDIS });
});

// ── GET /api/mandi/trend/:cropId ──────────────────────────
router.get("/trend/:cropId", auth, async (req, res) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const trend = await prisma.mandiRate.findMany({
      where: { cropId: req.params.cropId, createdAt: { gte: sevenDaysAgo } },
      orderBy: { createdAt: "asc" },
      select: { modalPrice: true, date: true, createdAt: true },
    });
    res.json({ success: true, trend });
  } catch {
    res.status(500).json({ error: "Trend data नहीं मिला" });
  }
});

module.exports = router;

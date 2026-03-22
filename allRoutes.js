// ═══════════════════════════════════════════════════════════
//  ALL REMAINING ROUTES  —  MITTI AI v4.0
//  user · soil · crop · market · schemes · notifications
//  admin · weather
// ═══════════════════════════════════════════════════════════

const router  = require("express").Router();
const { PrismaClient } = require("@prisma/client");
const Anthropic = require("@anthropic-ai/sdk");
const { auth, adminAuth } = require("../middleware/auth");
const logger = require("../config/logger");

const prisma    = new PrismaClient();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ══════════════════════════════════════════════════════════
//  USER ROUTES
// ══════════════════════════════════════════════════════════
const userRouter = require("express").Router();

// GET /api/user/profile
userRouter.get("/profile", auth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id:true, phone:true, name:true, village:true,
        district:true, language:true, landAcres:true,
        isPremium:true, isVerified:true, createdAt:true,
        _count: { select: { soilTests:true, queries:true, listings:true, orders:true } }
      },
    });
    res.json({ success: true, user });
  } catch { res.status(500).json({ error: "Profile नहीं मिली" }); }
});

// PUT /api/user/profile
userRouter.put("/profile", auth, async (req, res) => {
  const { name, village, district, language, landAcres, fcmToken } = req.body;
  try {
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { name, village, district, language, landAcres, fcmToken },
    });
    res.json({ success: true, user, message: "Profile अपडेट हो गई" });
  } catch { res.status(500).json({ error: "Profile update नहीं हुई" }); }
});

// GET /api/user/stats
userRouter.get("/stats", auth, async (req, res) => {
  try {
    const [queryCount, soilCount, listingCount, orderCount] = await Promise.all([
      prisma.query.count({ where: { userId: req.user.id } }),
      prisma.soilTest.count({ where: { userId: req.user.id } }),
      prisma.listing.count({ where: { sellerId: req.user.id } }),
      prisma.order.count({ where: { buyerId: req.user.id } }),
    ]);
    res.json({ success:true, stats: { queries:queryCount, soilTests:soilCount, listings:listingCount, orders:orderCount }});
  } catch { res.status(500).json({ error: "Stats नहीं मिले" }); }
});

// ══════════════════════════════════════════════════════════
//  SOIL ROUTES
// ══════════════════════════════════════════════════════════
const soilRouter = require("express").Router();

// POST /api/soil/analyze
soilRouter.post("/analyze", auth, async (req, res) => {
  const { nitrogen, phosphorus, potassium, ph, language = "HINDI" } = req.body;
  if (!nitrogen || !phosphorus || !potassium) {
    return res.status(400).json({ error: "N, P, K values जरूरी हैं" });
  }

  const prompts = {
    HINDI:    `मिट्टी: N=${nitrogen}, P=${phosphorus}, K=${potassium}, pH=${ph||7}. हिंदी में विश्लेषण दें।`,
    BHOJPURI: `माटी: N=${nitrogen}, P=${phosphorus}, K=${potassium}, pH=${ph||7}. भोजपुरी में बताईं।`,
    ENGLISH:  `Soil: N=${nitrogen}, P=${phosphorus}, K=${potassium}, pH=${ph||7}. Analyze in English.`,
  };

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      messages: [{
        role: "user",
        content: `${prompts[language]}\n\nJSON दें: {"status":"अच्छा/ठीक/खराब","statusScore":7,"suitableCrops":["crop1","crop2","crop3"],"fertilizers":[{"name":"खाद","dose":"मात्रा/acre","timing":"कब"}],"improvements":["सुधार 1","सुधार 2"],"summary":"संक्षिप्त सलाह"}`,
      }],
    });

    const text   = response.content[0].text;
    const result = JSON.parse(text.replace(/```json|```/g,"").trim());

    const saved = await prisma.soilTest.create({
      data: {
        userId: req.user.id, nitrogen, phosphorus, potassium, ph,
        aiAnalysis:      result.summary,
        recommendations: JSON.stringify(result.fertilizers),
      },
    });

    res.json({ success: true, id: saved.id, result });
  } catch (err) {
    logger.error("Soil analysis error:", err);
    res.status(500).json({ error: "Soil analysis में समस्या" });
  }
});

// GET /api/soil/history
soilRouter.get("/history", auth, async (req, res) => {
  try {
    const tests = await prisma.soilTest.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    res.json({ success: true, tests });
  } catch { res.status(500).json({ error: "Soil history नहीं मिली" }); }
});

// ══════════════════════════════════════════════════════════
//  CROP ROUTES
// ══════════════════════════════════════════════════════════
const cropRouter = require("express").Router();

// GET /api/crop/list
cropRouter.get("/list", auth, async (req, res) => {
  try {
    const crops = await prisma.cropData.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
    res.json({ success: true, crops });
  } catch { res.status(500).json({ error: "Crops नहीं मिले" }); }
});

// GET /api/crop/advisory/:cropName
cropRouter.get("/advisory/:cropName", auth, async (req, res) => {
  const { cropName } = req.params;
  const { language = "HINDI" } = req.query;

  const prompts = {
    HINDI:    `${cropName} की खेती के बारे में बिहार के किसान के लिए हिंदी में पूरी जानकारी दें`,
    BHOJPURI: `${cropName} के खेती के बारे में भोजपुरी में बताईं`,
    ENGLISH:  `Give complete farming guide for ${cropName} for Bihar farmers in English`,
  };

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514", max_tokens: 1000,
      messages: [{
        role: "user",
        content: `${prompts[language]}\nJSON: {"sowingTime":"बुवाई","irrigation":"सिंचाई","fertilizer":"खाद","pestControl":"कीट नियंत्रण","yield":"उपज","price":"भाव","tips":["tip1","tip2"]}`,
      }],
    });
    const text   = response.content[0].text;
    const result = JSON.parse(text.replace(/```json|```/g,"").trim());
    res.json({ success: true, crop: cropName, advisory: result });
  } catch (err) {
    res.status(500).json({ error: "Advisory नहीं मिली" });
  }
});

// ══════════════════════════════════════════════════════════
//  MARKET ROUTES  (DhaniGram)
// ══════════════════════════════════════════════════════════
const marketRouter = require("express").Router();

// GET /api/market/listings
marketRouter.get("/listings", auth, async (req, res) => {
  const { district, crop, page = 1, limit = 20 } = req.query;
  try {
    const where = {
      status: "ACTIVE",
      expiresAt: { gte: new Date() },
      ...(district && { district }),
      ...(crop && { cropName: { contains: crop, mode: "insensitive" } }),
    };
    const [listings, total] = await Promise.all([
      prisma.listing.findMany({
        where, orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit, take: Number(limit),
        include: { seller: { select: { name:true, village:true, phone:true } } },
      }),
      prisma.listing.count({ where }),
    ]);
    res.json({ success:true, listings, total, page:Number(page) });
  } catch { res.status(500).json({ error: "Listings नहीं मिलीं" }); }
});

// POST /api/market/listings
marketRouter.post("/listings", auth, async (req, res) => {
  const { cropName, cropEmoji, quantity, pricePerQtl, location, district, quality, description } = req.body;
  if (!cropName || !quantity || !pricePerQtl) {
    return res.status(400).json({ error: "cropName, quantity, pricePerQtl जरूरी हैं" });
  }
  try {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    const listing = await prisma.listing.create({
      data: { sellerId:req.user.id, cropName, cropEmoji:cropEmoji||"🌾", quantity, pricePerQtl, location, district, quality, description, expiresAt },
    });
    res.json({ success:true, listing, message: "Listing डाल दी गई! 📦" });
  } catch { res.status(500).json({ error: "Listing नहीं बनी" }); }
});

// POST /api/market/orders
marketRouter.post("/orders", auth, async (req, res) => {
  const { listingId, quantity, paymentMethod } = req.body;
  try {
    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing || listing.status !== "ACTIVE") {
      return res.status(400).json({ error: "Listing उपलब्ध नहीं है" });
    }
    const totalAmount = listing.pricePerQtl * quantity;
    const order = await prisma.order.create({
      data: {
        listingId, buyerId: req.user.id, sellerId: listing.sellerId,
        quantity, pricePerQtl: listing.pricePerQtl, totalAmount, paymentMethod,
      },
    });
    res.json({ success:true, order, message: `Order #${order.id.slice(-6)} हो गया! ✅` });
  } catch { res.status(500).json({ error: "Order नहीं बना" }); }
});

// ══════════════════════════════════════════════════════════
//  SCHEME ROUTES
// ══════════════════════════════════════════════════════════
const schemeRouter = require("express").Router();

// GET /api/schemes/list
schemeRouter.get("/list", auth, async (req, res) => {
  try {
    const schemes = await prisma.govtScheme.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success:true, schemes });
  } catch { res.status(500).json({ error: "Schemes नहीं मिलीं" }); }
});

// POST /api/schemes/check-eligibility
schemeRouter.post("/check-eligibility", auth, async (req, res) => {
  const { schemeId, language = "HINDI" } = req.body;
  try {
    const scheme = await prisma.govtScheme.findUnique({ where: { id: schemeId } });
    const user   = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!scheme) return res.status(404).json({ error: "Scheme नहीं मिली" });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514", max_tokens: 600,
      messages: [{
        role: "user",
        content: `${scheme.name} scheme के लिए किसान: ${user.name}, जिला: ${user.district||"बिहार"}, भूमि: ${user.landAcres||2} एकड़।
पात्रता जाँचें। JSON: {"eligible":true,"reason":"कारण","requirements":["दस्तावेज"],"howToApply":"तरीका","office":"कहाँ जाएं","helpline":"नंबर","amount":"राशि","days":"समय"}`,
      }],
    });
    const text   = response.content[0].text;
    const result = JSON.parse(text.replace(/```json|```/g,"").trim());
    res.json({ success:true, scheme:scheme.nameHindi, eligibility:result });
  } catch { res.status(500).json({ error: "Eligibility check में समस्या" }); }
});

// ══════════════════════════════════════════════════════════
//  NOTIFICATION ROUTES
// ══════════════════════════════════════════════════════════
const notifRouter = require("express").Router();

// GET /api/notifications/list
notifRouter.get("/list", auth, async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const unread = notifications.filter(n => !n.isRead).length;
    res.json({ success:true, notifications, unread });
  } catch { res.status(500).json({ error: "Notifications नहीं मिलीं" }); }
});

// PUT /api/notifications/read-all
notifRouter.put("/read-all", auth, async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true },
    });
    res.json({ success:true, message: "सब पढ़ा गया" });
  } catch { res.status(500).json({ error: "Update नहीं हुआ" }); }
});

// ══════════════════════════════════════════════════════════
//  WEATHER ROUTE
// ══════════════════════════════════════════════════════════
const weatherRouter = require("express").Router();

// GET /api/weather/forecast
weatherRouter.get("/forecast", auth, async (req, res) => {
  const { district = "Patna", language = "HINDI" } = req.query;
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514", max_tokens: 1000,
      messages: [{
        role: "user",
        content: `${district}, Bihar का 7-दिन मौसम पूर्वानुमान JSON में दें:
{"current":{"temp":32,"humidity":65,"wind":12,"condition":"आंशिक बादल","icon":"⛅"},"forecast":[{"day":"सोम","high":34,"low":22,"icon":"☀️","rainChance":10}],"farmingTip":"खेती सलाह","alerts":[],"bestFarmDays":["तारीख"]}
केवल JSON।`,
      }],
    });
    const text   = response.content[0].text;
    const result = JSON.parse(text.replace(/```json|```/g,"").trim());
    res.json({ success:true, district, forecast:result });
  } catch { res.status(500).json({ error: "मौसम जानकारी नहीं मिली" }); }
});

// ══════════════════════════════════════════════════════════
//  ADMIN ROUTES
// ══════════════════════════════════════════════════════════
const adminRouter = require("express").Router();

// GET /api/admin/stats
adminRouter.get("/stats", adminAuth, async (req, res) => {
  try {
    const [users, queries, soilTests, listings, orders] = await Promise.all([
      prisma.user.count(),
      prisma.query.count(),
      prisma.soilTest.count(),
      prisma.listing.count(),
      prisma.order.count(),
    ]);

    const activeToday = await prisma.user.count({
      where: { lastActiveAt: { gte: new Date(Date.now() - 24*60*60*1000) } }
    });

    const topQueries = await prisma.query.groupBy({
      by: ["category"],
      _count: { category: true },
      orderBy: { _count: { category: "desc" } },
    });

    const districtBreakdown = await prisma.user.groupBy({
      by: ["district"],
      _count: { district: true },
      where: { district: { not: null } },
      orderBy: { _count: { district: "desc" } },
      take: 10,
    });

    res.json({
      success: true,
      stats: { users, queries, soilTests, listings, orders, activeToday },
      topQueries,
      districtBreakdown,
    });
  } catch { res.status(500).json({ error: "Admin stats नहीं मिले" }); }
});

// GET /api/admin/users
adminRouter.get("/users", adminAuth, async (req, res) => {
  const { page = 1, limit = 50, district, language } = req.query;
  try {
    const where = {
      ...(district  && { district }),
      ...(language  && { language }),
    };
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where, skip: (page-1)*limit, take:Number(limit),
        orderBy: { createdAt: "desc" },
        select: { id:true, phone:true, name:true, village:true, district:true,
          language:true, isPremium:true, createdAt:true, lastActiveAt:true,
          _count: { select: { queries:true, soilTests:true } } },
      }),
      prisma.user.count({ where }),
    ]);
    res.json({ success:true, users, total, pages:Math.ceil(total/limit) });
  } catch { res.status(500).json({ error: "Users नहीं मिले" }); }
});

// ── Export all routers ────────────────────────────────────
module.exports = {
  userRouter,
  soilRouter,
  cropRouter,
  marketRouter,
  schemeRouter,
  notifRouter,
  weatherRouter,
  adminRouter,
};

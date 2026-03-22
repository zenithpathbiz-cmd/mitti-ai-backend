// ══════════════════════════════════════════════════════════
//  MARKETPLACE ROUTES  —  DhaniGram
//  GET  /api/market/listings
//  POST /api/market/listings
//  GET  /api/market/listings/:id
//  POST /api/market/order
//  GET  /api/market/my-orders
// ══════════════════════════════════════════════════════════
const router  = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { auth } = require('../middleware/auth');
const { ok, err } = require('../utils/response');
const prisma  = new PrismaClient();

// GET all active listings
router.get('/listings', auth, async (req, res) => {
  const { crop, district, page = 1, limit = 20 } = req.query;
  try {
    const where = { status: 'ACTIVE', ...(crop && { cropName: { contains: crop, mode: 'insensitive' } }), ...(district && { district }) };
    const [listings, total] = await Promise.all([
      prisma.listing.findMany({
        where, skip: (parseInt(page)-1)*parseInt(limit), take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name:true, village:true, district:true } } },
      }),
      prisma.listing.count({ where }),
    ]);
    ok(res, { listings, total });
  } catch (e) {
    err(res, 'Listings fetch failed', 500);
  }
});

// POST create listing
router.post('/listings', auth, async (req, res) => {
  const { cropName, quantity, pricePerQ, description, district } = req.body;
  if (!cropName || !quantity || !pricePerQ) return err(res, 'cropName, quantity, pricePerQ required', 400);
  try {
    const listing = await prisma.listing.create({
      data: { userId: req.user.id, cropName, quantity: parseFloat(quantity), pricePerQ: parseFloat(pricePerQ), description, district: district || req.user.district },
    });
    ok(res, { listing }, 'Listing created', 201);
  } catch (e) {
    err(res, 'Listing creation failed', 500);
  }
});

// POST place order
router.post('/order', auth, async (req, res) => {
  const { items, paymentMode, address } = req.body;
  if (!items?.length) return err(res, 'items required', 400);
  try {
    const listings = await Promise.all(items.map(i => prisma.listing.findUnique({ where: { id: i.listingId } })));
    const totalAmount = items.reduce((s, item, i) => s + (listings[i]?.pricePerQ || 0) * item.quantity, 0);
    const order = await prisma.order.create({
      data: {
        buyerId: req.user.id, totalAmount, paymentMode, address, status: 'PENDING',
        items: { create: items.map((item, i) => ({ listingId: item.listingId, quantity: item.quantity, price: listings[i]?.pricePerQ || 0 })) },
      },
      include: { items: true },
    });
    ok(res, { order }, 'Order placed', 201);
  } catch (e) {
    err(res, 'Order failed', 500);
  }
});

// GET my orders
router.get('/my-orders', auth, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { buyerId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: { items: { include: { listing: true } } },
    });
    ok(res, { orders });
  } catch (e) {
    err(res, 'Orders fetch failed', 500);
  }
});

module.exports = router;

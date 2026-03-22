// ══════════════════════════════════════════════════════════
//  CROP ADVISORY ROUTES
//  GET  /api/crop/list
//  POST /api/crop/advisory
// ══════════════════════════════════════════════════════════
const router    = require('express').Router();
const { auth }  = require('../middleware/auth');
const { getCropAdvisory } = require('../services/bhojpuriAI');
const { ok, err } = require('../utils/response');

const CROPS = [
  { id:'wheat',   nameHindi:'गेहूं',   nameBhojpuri:'गोहुँम',  emoji:'🌾', season:'रबी',   months:'नवंबर-मार्च' },
  { id:'rice',    nameHindi:'धान',     nameBhojpuri:'धान',      emoji:'🌿', season:'खरीफ',  months:'जून-अक्टूबर' },
  { id:'maize',   nameHindi:'मक्का',   nameBhojpuri:'मक्का',   emoji:'🌽', season:'खरीफ',  months:'जून-सितंबर'  },
  { id:'potato',  nameHindi:'आलू',     nameBhojpuri:'अलुआ',    emoji:'🥔', season:'रबी',   months:'अक्टूबर-मार्च'},
  { id:'tomato',  nameHindi:'टमाटर',   nameBhojpuri:'टमाटर',   emoji:'🍅', season:'सालभर', months:'साल भर'      },
  { id:'mustard', nameHindi:'सरसों',   nameBhojpuri:'सरसों',   emoji:'🌻', season:'रबी',   months:'अक्टूबर-फरवरी'},
  { id:'lentil',  nameHindi:'मसूर',    nameBhojpuri:'मसुर',    emoji:'🫘', season:'रबी',   months:'अक्टूबर-मार्च'},
  { id:'sugarcane',nameHindi:'गन्ना',  nameBhojpuri:'ऊख',      emoji:'🎋', season:'सालभर', months:'फरवरी-नवंबर' },
];

// GET /api/crop/list
router.get('/list', auth, (req, res) => {
  const { language = 'HINDI' } = req.query;
  ok(res, { crops: CROPS });
});

// POST /api/crop/advisory
router.post('/advisory', auth, async (req, res) => {
  const { cropName, cropId, district, language } = req.body;
  if (!cropName && !cropId) return err(res, 'cropName or cropId required', 400);
  const name = cropName || CROPS.find(c => c.id === cropId)?.nameHindi || cropId;
  try {
    const advisory = await getCropAdvisory({
      cropName: name,
      language: language || req.user.language || 'HINDI',
      district: district || req.user.district || 'Patna',
    });
    ok(res, { cropName: name, advisory });
  } catch (e) {
    err(res, 'Advisory fetch failed', 500);
  }
});

module.exports = router;

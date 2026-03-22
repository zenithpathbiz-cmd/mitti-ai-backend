// ══════════════════════════════════════════════════════════
//  GOVT SCHEMES ROUTES
//  GET  /api/schemes/list
//  POST /api/schemes/eligibility
// ══════════════════════════════════════════════════════════
const router  = require('express').Router();
const { auth } = require('../middleware/auth');
const { checkSchemeEligibility } = require('../services/bhojpuriAI');
const { ok, err } = require('../utils/response');

const SCHEMES = [
  { id:'pm-kisan',   name:'PM-KISAN',              hindi:'प्रधानमंत्री किसान सम्मान निधि', benefit:'₹6,000/साल', type:'central', deadline:'31 Mar', helpline:'155261', hot:true },
  { id:'pmfby',      name:'PMFBY',                  hindi:'प्रधानमंत्री फसल बीमा योजना',    benefit:'80% मुआवजा', type:'central', deadline:'30 Apr', helpline:'14447',  hot:true },
  { id:'kcc',        name:'KCC',                    hindi:'किसान क्रेडिट कार्ड',             benefit:'₹3 लाख ऋण', type:'bank',    deadline:'चालू',   helpline:'1800-180-1111', hot:false },
  { id:'solar-pump', name:'Bihar Solar Pump Yojana',hindi:'बिहार सोलर पंप योजना',           benefit:'90% सब्सिडी',type:'state',   deadline:'Jun 25', helpline:'0612-2233555',  hot:true  },
  { id:'agri-yantra',name:'Agri Yantra Anudan',     hindi:'कृषि यंत्र अनुदान',               benefit:'50% छूट',    type:'central', deadline:'May 25', helpline:'1800-180-1551', hot:false },
  { id:'bihar-flood', name:'Bihar Badh Rahat',      hindi:'बिहार राज्य बाढ़ राहत',           benefit:'₹15K/एकड़',  type:'state',   deadline:'15 Apr', helpline:'0612-2215714',  hot:false },
];

router.get('/list', auth, (req, res) => ok(res, { schemes: SCHEMES }));

router.post('/eligibility', auth, async (req, res) => {
  const { schemeId, language } = req.body;
  if (!schemeId) return err(res, 'schemeId required', 400);
  const scheme = SCHEMES.find(s => s.id === schemeId);
  if (!scheme) return err(res, 'Scheme not found', 404);
  try {
    const result = await checkSchemeEligibility({
      schemeName: scheme.hindi || scheme.name,
      language: language || req.user.language || 'HINDI',
    });
    ok(res, { scheme, eligibility: result });
  } catch (e) {
    err(res, 'Eligibility check failed', 500);
  }
});

module.exports = router;

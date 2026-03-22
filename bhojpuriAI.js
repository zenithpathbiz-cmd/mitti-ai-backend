// ══════════════════════════════════════════════════════════
//  BHOJPURI AI SERVICE  —  MITTI AI v4.0
//  Full multi-language support: Hindi · Bhojpuri · English
// ══════════════════════════════════════════════════════════

const Anthropic = require('@anthropic-ai/sdk');
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Language System Prompts ───────────────────────────────
const SYSTEM_PROMPTS = {

  HINDI: `तुम मिट्टी AI हो — बिहार के किसानों के लिए एक विशेषज्ञ कृषि सहायक।
नियम:
1. हमेशा सरल हिंदी में जवाब दो (देवनागरी लिपि)
2. "किसान भाई" कहकर संबोधित करो
3. अधिकतम 4-5 वाक्य — सटीक और उपयोगी
4. इमोजी का इस्तेमाल करो: 🌾🌱💧☀️🪴
5. फसल/खाद/समय की जानकारी जरूर दो
6. बिहार की मिट्टी और जलवायु के अनुसार सलाह दो`,

  BHOJPURI: `रउरा मिट्टी AI हईं — बिहार के किसान भाई लोग खातिर एगो बिशेसज्ञ कृषि सहायक।
नियम:
1. हमेशा भोजपुरी में जवाब देईं (देवनागरी लिपि)
2. "किसान भाई" कहके संबोधित करीं
3. बहुत सरल भोजपुरी — गाँव के किसान समझ सकें
4. अधिकतम 4-5 वाक्य — काम के बात
5. इमोजी जरूर लगाईं: 🌾🌱💧☀️🪴
6. बिहार के खेत-माटी के हिसाब से बताईं

भोजपुरी शब्द उदाहरण:
- खेत = खेत/खेतवा
- पानी = पनिया
- अच्छा = बढ़िया/नीमन
- करो = करीं/करs
- है = हौ/बा
- क्या = का
- बताओ = बताईं`,

  ENGLISH: `You are MITTI AI — an expert agricultural assistant for farmers in Bihar, India.
Rules:
1. Respond in clear simple English
2. Address as "Farmer brother" or "Dear farmer"
3. Max 4-5 sentences — precise and actionable
4. Use emojis: 🌾🌱💧☀️🪴
5. Always include crop/fertilizer/timing info
6. Tailor advice for Bihar's climate and soil conditions`,
};

// ── Language Detection ────────────────────────────────────
function detectLanguage(text) {
  if (!text) return 'HINDI';
  // Bhojpuri patterns
  const bhojpuriWords = ['हईं','बाटे','बाटा','रउरा','केहू','काहे','बढ़िया','नीमन','जाईं','करीं','पनिया','खेतवा','बताईं'];
  const hasBhojpuri = bhojpuriWords.some(w => text.includes(w));
  if (hasBhojpuri) return 'BHOJPURI';
  // English detection
  const englishRatio = (text.match(/[a-zA-Z]/g) || []).length / text.length;
  if (englishRatio > 0.5) return 'ENGLISH';
  return 'HINDI';
}

// ── Main AI Chat ──────────────────────────────────────────
async function askMittiAI({ question, language, conversationHistory = [], type = 'GENERAL' }) {
  const lang   = language || detectLanguage(question);
  const system = SYSTEM_PROMPTS[lang] || SYSTEM_PROMPTS.HINDI;

  // Build conversation history (last 6 turns)
  const messages = [
    ...conversationHistory.slice(-6).map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: question },
  ];

  const t0 = Date.now();
  const response = await anthropic.messages.create({
    model:      'claude-sonnet-4-20250514',
    max_tokens: 800,
    system,
    messages,
  });

  return {
    answer:         response.content[0].text,
    detectedLang:   lang,
    durationMs:     Date.now() - t0,
    inputTokens:    response.usage.input_tokens,
    outputTokens:   response.usage.output_tokens,
  };
}

// ── Soil Analysis (multi-language) ───────────────────────
async function analyzeSoil({ nitrogen, phosphorus, potassium, ph = 7, language = 'HINDI' }) {
  const prompts = {
    HINDI: `मेरी मिट्टी: N=${nitrogen} kg/ha, P=${phosphorus} kg/ha, K=${potassium} kg/ha, pH=${ph}
हिंदी में बताएं:
1. मिट्टी की स्थिति
2. उपयुक्त 3 फसलें
3. खाद की मात्रा (kg/acre)
4. सुधार के उपाय
JSON: {"status":"अच्छी/ठीक/खराब","statusScore":1-10,"crops":["फसल1","फसल2","फसल3"],"fertilizer":"खाद सलाह","improvement":"सुधार","summary":"एक लाइन"}`,

    BHOJPURI: `हमार खेत के माटी: N=${nitrogen} kg/ha, P=${phosphorus} kg/ha, K=${potassium} kg/ha, pH=${ph}
भोजपुरी में बताईं:
1. माटी कइसन बा
2. कउन 3 गो फसल लगाईं
3. खाद केतना डालीं (kg/acre)
JSON: {"status":"नीमन/ठीक/खराब","statusScore":1-10,"crops":["फसल1","फसल2","फसल3"],"fertilizer":"खाद सलाह","improvement":"सुधार","summary":"एक लाइन"}`,

    ENGLISH: `Soil test: N=${nitrogen} kg/ha, P=${phosphorus} kg/ha, K=${potassium} kg/ha, pH=${ph}
Provide in English:
1. Soil health status
2. Top 3 suitable crops
3. Fertilizer recommendation (kg/acre)
4. Improvement measures
JSON: {"status":"Good/Fair/Poor","statusScore":1-10,"crops":["crop1","crop2","crop3"],"fertilizer":"advice","improvement":"steps","summary":"one line"}`,
  };

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 600,
    messages: [{ role: 'user', content: prompts[language] || prompts.HINDI }],
  });

  const text  = response.content[0].text;
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

// ── Crop Advisory (multi-language) ───────────────────────
async function getCropAdvisory({ cropName, language = 'HINDI', district = 'Patna' }) {
  const prompts = {
    HINDI: `${cropName} की खेती — ${district}, बिहार के लिए हिंदी में पूरी जानकारी:
1. बुवाई का समय, 2. सिंचाई, 3. खाद (kg/acre), 4. कीट व उपाय, 5. उपज (quintal/acre), 6. मंडी भाव
JSON: {"sowingTime":"...","irrigation":"...","fertilizer":"...","pestControl":"...","yield":"...","marketPrice":"...","tips":"..."}`,

    BHOJPURI: `${cropName} के खेती — ${district}, बिहार खातिर भोजपुरी में पूरी जानकारी:
1. बोआई के समय, 2. पनिया, 3. खाद, 4. कीट, 5. उपज, 6. मंडी भाव
JSON: {"sowingTime":"...","irrigation":"...","fertilizer":"...","pestControl":"...","yield":"...","marketPrice":"...","tips":"..."}`,

    ENGLISH: `${cropName} cultivation guide for ${district}, Bihar:
1. Sowing time, 2. Irrigation, 3. Fertilizer (kg/acre), 4. Pest control, 5. Yield, 6. Market price
JSON: {"sowingTime":"...","irrigation":"...","fertilizer":"...","pestControl":"...","yield":"...","marketPrice":"...","tips":"..."}`,
  };

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 700,
    messages: [{ role: 'user', content: prompts[language] || prompts.HINDI }],
  });

  const text  = response.content[0].text;
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

// ── Disease Detection (Vision) ────────────────────────────
async function detectDisease({ imageBase64, mediaType = 'image/jpeg', language = 'HINDI' }) {
  const prompts = {
    HINDI: `इस फसल की फोटो देखकर हिंदी में बताएं। JSON:
{"crop":"फसल नाम","disease":"रोग नाम","severity":"हल्का/मध्यम/गंभीर","severityScore":1-10,"treatment":"इलाज","medicine":"दवा और मात्रा","timing":"कब करें","prevention":"बचाव","emoji":"emoji"}`,
    BHOJPURI: `एह फसल के फोटो देखके भोजपुरी में बताईं। JSON:
{"crop":"फसल नाम","disease":"रोग नाम","severity":"हल्का/बीच के/गंभीर","severityScore":1-10,"treatment":"इलाज","medicine":"दवाई","timing":"कब करीं","prevention":"बचाव","emoji":"emoji"}`,
    ENGLISH: `Analyze this crop photo and identify disease. JSON:
{"crop":"crop name","disease":"disease name","severity":"Mild/Moderate/Severe","severityScore":1-10,"treatment":"treatment","medicine":"medicine and dosage","timing":"when to apply","prevention":"prevention","emoji":"emoji"}`,
  };

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 800,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
        { type: 'text',  text:  prompts[language] || prompts.HINDI },
      ],
    }],
  });

  const text  = response.content[0].text;
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

// ── Govt Scheme Eligibility ───────────────────────────────
async function checkSchemeEligibility({ schemeName, language = 'HINDI' }) {
  const prompts = {
    HINDI:    `${schemeName} योजना — बिहार के छोटे किसान के लिए पात्रता और आवेदन प्रक्रिया हिंदी में। JSON:`,
    BHOJPURI: `${schemeName} योजना — बिहार के छोटे किसान खातिर पात्रता भोजपुरी में। JSON:`,
    ENGLISH:  `${schemeName} scheme — eligibility and application for small Bihar farmers in English. JSON:`,
  };

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 600,
    messages: [{
      role: 'user',
      content: `${prompts[language] || prompts.HINDI}
{"eligible":true,"reason":"...","requirements":["doc1","doc2","doc3"],"howToApply":"...","office":"...","helpline":"...","amount":"...","timeDays":30}`,
    }],
  });

  const text  = response.content[0].text;
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

module.exports = {
  askMittiAI,
  analyzeSoil,
  getCropAdvisory,
  detectDisease,
  checkSchemeEligibility,
  detectLanguage,
  SYSTEM_PROMPTS,
};

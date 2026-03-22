// ══════════════════════════════════════════════════════════
//  WEATHER ROUTES
//  GET /api/weather/current?district=Patna&language=HINDI
//  GET /api/weather/forecast?district=Patna
// ══════════════════════════════════════════════════════════
const router    = require('express').Router();
const axios     = require('axios');
const Anthropic = require('@anthropic-ai/sdk');
const { auth }  = require('../middleware/auth');
const { ok, err } = require('../utils/response');
const config    = require('../config');

const anthropic = new Anthropic({ apiKey: config.ANTHROPIC_KEY });

const DISTRICT_COORDS = {
  Patna:        { lat: 25.5941, lon: 85.1376 },
  Gaya:         { lat: 24.7955, lon: 84.9994 },
  Muzaffarpur:  { lat: 26.1197, lon: 85.3910 },
  Bhagalpur:    { lat: 25.2425, lon: 87.0009 },
  Darbhanga:    { lat: 26.1522, lon: 85.8970 },
  Nalanda:      { lat: 25.1372, lon: 85.4447 },
};

async function getAIWeather(district, language) {
  const lang = language || 'HINDI';
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 800,
    messages: [{
      role: 'user',
      content: `${district}, Bihar ka aaj ka mausam aur 7 din ka forecast aur khet ki salah do.
Language: ${lang}
JSON format:
{
  "current": {"temp":32,"feels":35,"humidity":65,"wind":12,"condition":"${lang==='HINDI'?'आंशिक बादल':lang==='BHOJPURI'?'बादर बा':'Partly Cloudy'}","icon":"⛅","location":"${district}, Bihar"},
  "forecast": [
    {"day":"${lang==='HINDI'?'सोम':'Mon'}","date":"24 Mar","high":34,"low":22,"icon":"☀️","rainChance":10,"condition":"Clear"},
    {"day":"${lang==='HINDI'?'मंगल':'Tue'}","date":"25 Mar","high":31,"low":20,"icon":"🌧️","rainChance":70,"condition":"Rain"},
    {"day":"${lang==='HINDI'?'बुध':'Wed'}","date":"26 Mar","high":28,"low":19,"icon":"⛈️","rainChance":80,"condition":"Storm"},
    {"day":"${lang==='HINDI'?'गुरु':'Thu'}","date":"27 Mar","high":33,"low":21,"icon":"🌤","rainChance":20,"condition":"Partly Cloudy"},
    {"day":"${lang==='HINDI'?'शुक्र':'Fri'}","date":"28 Mar","high":35,"low":23,"icon":"☀️","rainChance":5,"condition":"Clear"},
    {"day":"${lang==='HINDI'?'शनि':'Sat'}","date":"29 Mar","high":36,"low":24,"icon":"🌡️","rainChance":0,"condition":"Hot"},
    {"day":"${lang==='HINDI'?'रवि':'Sun'}","date":"30 Mar","high":30,"low":20,"icon":"🌦","rainChance":40,"condition":"Changing"}
  ],
  "farmingAlerts": [
    {"type":"urgent","icon":"⚠️","title":"${lang==='HINDI'?'बुवाई रोकें':'Sowing Alert'}","body":"Rain expected 25-26 Mar"},
    {"type":"info","icon":"💧","title":"${lang==='HINDI'?'सिंचाई':'Irrigation'}","body":"Skip irrigation after rain"}
  ],
  "bestFarmDays": ["24 Mar","27 Mar","28 Mar"]
}
JSON only.`,
    }],
  });
  const clean = response.content[0].text.replace(/```json|```/g,'').trim();
  return JSON.parse(clean);
}

router.get('/current', auth, async (req, res) => {
  const district = req.query.district || req.user?.district || 'Patna';
  const language = req.query.language || req.user?.language || 'HINDI';
  try {
    // Try OpenWeatherMap first
    if (config.WEATHER_KEY) {
      const coords = DISTRICT_COORDS[district] || DISTRICT_COORDS.Patna;
      const r = await axios.get(`${config.WEATHER_URL}/weather`, {
        params: { lat: coords.lat, lon: coords.lon, appid: config.WEATHER_KEY, units: 'metric' },
        timeout: 5000,
      });
      const d = r.data;
      return ok(res, {
        source: 'OPENWEATHER',
        current: {
          temp: Math.round(d.main.temp), feels: Math.round(d.main.feels_like),
          humidity: d.main.humidity, wind: Math.round(d.wind.speed * 3.6),
          condition: d.weather[0].description, icon: '🌤', location: `${district}, Bihar`,
        },
      });
    }
    // AI fallback
    const data = await getAIWeather(district, language);
    ok(res, { source: 'AI_FORECAST', ...data });
  } catch (e) {
    err(res, 'Weather fetch failed', 500);
  }
});

router.get('/forecast', auth, async (req, res) => {
  const district = req.query.district || 'Patna';
  const language = req.query.language || req.user?.language || 'HINDI';
  try {
    const data = await getAIWeather(district, language);
    ok(res, { source: 'AI_FORECAST', district, ...data });
  } catch (e) {
    err(res, 'Forecast failed', 500);
  }
});

module.exports = router;

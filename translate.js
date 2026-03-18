const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// 70 languages with country codes for YouTube
const LANGUAGES_70 = [
  {code:'af',name:'Afrikaans'},{code:'sq',name:'Albanian'},{code:'ar',name:'Arabic'},
  {code:'hy',name:'Armenian'},{code:'az',name:'Azerbaijani'},{code:'eu',name:'Basque'},
  {code:'be',name:'Belarusian'},{code:'bn',name:'Bengali'},{code:'bs',name:'Bosnian'},
  {code:'bg',name:'Bulgarian'},{code:'ca',name:'Catalan'},{code:'zh-Hans',name:'Chinese (Simplified)'},
  {code:'zh-Hant',name:'Chinese (Traditional)'},{code:'hr',name:'Croatian'},{code:'cs',name:'Czech'},
  {code:'da',name:'Danish'},{code:'nl',name:'Dutch'},{code:'et',name:'Estonian'},
  {code:'fi',name:'Finnish'},{code:'fr',name:'French'},{code:'gl',name:'Galician'},
  {code:'ka',name:'Georgian'},{code:'de',name:'German'},{code:'el',name:'Greek'},
  {code:'gu',name:'Gujarati'},{code:'ht',name:'Haitian Creole'},{code:'he',name:'Hebrew'},
  {code:'hi',name:'Hindi'},{code:'hu',name:'Hungarian'},{code:'is',name:'Icelandic'},
  {code:'id',name:'Indonesian'},{code:'ga',name:'Irish'},{code:'it',name:'Italian'},
  {code:'ja',name:'Japanese'},{code:'kn',name:'Kannada'},{code:'kk',name:'Kazakh'},
  {code:'km',name:'Khmer'},{code:'ko',name:'Korean'},{code:'ku',name:'Kurdish'},
  {code:'lo',name:'Lao'},{code:'lv',name:'Latvian'},{code:'lt',name:'Lithuanian'},
  {code:'mk',name:'Macedonian'},{code:'ms',name:'Malay'},{code:'ml',name:'Malayalam'},
  {code:'mt',name:'Maltese'},{code:'mi',name:'Maori'},{code:'mr',name:'Marathi'},
  {code:'mn',name:'Mongolian'},{code:'ne',name:'Nepali'},{code:'nb',name:'Norwegian'},
  {code:'fa',name:'Persian'},{code:'pl',name:'Polish'},{code:'pt',name:'Portuguese'},
  {code:'pa',name:'Punjabi'},{code:'ro',name:'Romanian'},{code:'ru',name:'Russian'},
  {code:'sr',name:'Serbian'},{code:'si',name:'Sinhala'},{code:'sk',name:'Slovak'},
  {code:'sl',name:'Slovenian'},{code:'es',name:'Spanish'},{code:'sw',name:'Swahili'},
  {code:'sv',name:'Swedish'},{code:'tl',name:'Tagalog'},{code:'ta',name:'Tamil'},
  {code:'te',name:'Telugu'},{code:'th',name:'Thai'},{code:'tr',name:'Turkish'},
  {code:'uk',name:'Ukrainian'},{code:'ur',name:'Urdu'},{code:'vi',name:'Vietnamese'}
];

const LANGUAGES_40 = LANGUAGES_70.slice(0, 40);
const LANGUAGES_5  = [
  {code:'ko',name:'Korean'},{code:'ja',name:'Japanese'},
  {code:'zh-Hans',name:'Chinese (Simplified)'},{code:'fr',name:'French'},{code:'de',name:'German'}
];

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { email, title, description, keywords, planOverride } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });

  // Determine language set based on plan
  let langSet = LANGUAGES_5;
  let planName = 'free';

  if (email) {
    const { data: user } = await supabase.from('users').select('*').eq('email', email).single();
    if (user?.active) {
      if (user.plan === 'pro_monthly' || user.lifetime) { langSet = LANGUAGES_70; planName = 'pro'; }
      else if (user.plan === 'basic_monthly') { langSet = LANGUAGES_40; planName = 'basic'; }
    }
  }

  const startTime = Date.now();

  try {
    // Chunk processing - 23 languages per batch
    const chunkSize = 23;
    const chunks = [];
    for (let i = 0; i < langSet.length; i += chunkSize) {
      chunks.push(langSet.slice(i, i + chunkSize));
    }

    const results = {};

    await Promise.all(chunks.map(async (chunk) => {
      const langList = chunk.map(l => `${l.name} (${l.code})`).join(', ');

      const prompt = `You are a professional YouTube content localizer. Translate the following YouTube video metadata into these languages: ${langList}

Source content:
TITLE: ${title}
DESCRIPTION: ${description || ''}
KEYWORDS: ${keywords || ''}

Rules:
- Preserve the meaning and emotional tone, not literal word-for-word translation
- Adapt to local culture and search behavior for each country
- Keep titles under 100 characters
- Make keywords match local search patterns
- For descriptions, maintain the same structure but localize naturally

Return ONLY valid JSON in this exact format (no markdown, no extra text):
{
  "translations": [
    {
      "code": "language_code",
      "title": "translated title",
      "description": "translated description",
      "keywords": "translated keywords"
    }
  ]
}`;

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }]
      });

      const text = response.content[0].text.trim();
      const parsed = JSON.parse(text);
      parsed.translations.forEach(t => { results[t.code] = t; });
    }));

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    // Log usage
    if (email) {
      await supabase.from('usage_logs').insert({
        email,
        action: 'translate',
        languages_count: langSet.length,
        elapsed_seconds: parseFloat(elapsed)
      });
    }

    res.json({
      success: true,
      plan: planName,
      languages_count: langSet.length,
      elapsed_seconds: elapsed,
      translations: results
    });

  } catch (err) {
    console.error('Translation error:', err);
    res.status(500).json({ error: err.message });
  }
};

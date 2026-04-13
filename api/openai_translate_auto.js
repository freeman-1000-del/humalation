export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST 요청만 허용됩니다." });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "OPENAI_API_KEY 환경변수가 없습니다." });
  }

  const DEFAULT_TARGETS = [
    ["ko", "South Korea"], ["en-US", "United States"], ["en-GB", "United Kingdom"], ["es", "Spain"], ["fr", "France"],
    ["de", "Germany"], ["pt", "Portugal"], ["it", "Italy"], ["ja", "Japan"], ["zh-CN", "China (Simplified)"],
    ["zh-TW", "China (Traditional)"], ["ar", "Saudi Arabia"], ["hi", "India"], ["ru", "Russia"], ["nl", "Netherlands"],
    ["pl", "Poland"], ["tr", "Turkey"], ["sv", "Sweden"], ["da", "Denmark"], ["fi", "Finland"],
    ["cs", "Czech Republic"], ["ro", "Romania"], ["hu", "Hungary"], ["el", "Greece"], ["th", "Thailand"],
    ["id", "Indonesia"], ["ms", "Malaysia"], ["vi", "Vietnam"], ["uk", "Ukraine"], ["fa", "Iran"],
    ["af", "South Africa"], ["sq", "Albania"], ["am", "Ethiopia"], ["hy", "Armenia"], ["az", "Azerbaijan"],
    ["be", "Belarus"], ["bn", "Bangladesh"], ["bs", "Bosnia and Herzegovina"], ["bg", "Bulgaria"], ["hr", "Croatia"],
    ["et", "Estonia"], ["ka", "Georgia"], ["ht", "Haiti"], ["is", "Iceland"], ["ga", "Ireland"],
    ["kn", "India (Kannada)"], ["kk", "Kazakhstan"], ["km", "Cambodia"], ["rw", "Rwanda"], ["lv", "Latvia"],
    ["lt", "Lithuania"], ["mk", "North Macedonia"], ["ml", "India (Malayalam)"], ["mt", "Malta"], ["mr", "India (Marathi)"],
    ["mn", "Mongolia"], ["my", "Myanmar"], ["ne", "Nepal"], ["pa", "India (Punjabi)"], ["sr", "Serbia"],
    ["sk", "Slovakia"], ["sw", "Kenya"], ["tl", "Philippines"], ["ta", "India (Tamil)"], ["te", "India (Telugu)"],
    ["yo", "Nigeria"], ["zu", "South Africa (Zulu)"], ["ca", "Catalonia"], ["gl", "Galicia"], ["eu", "Basque Country"]
  ];

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim();
    const count = Number(body.count || 70) || 70;

    let targets = Array.isArray(body.targets) ? body.targets : [];
    if (!targets.length) {
      targets = DEFAULT_TARGETS.slice(0, count).map(([code, country]) => ({ code, country }));
    } else {
      targets = targets.slice(0, count).map((t) => ({
        code: String(t.code || "").trim(),
        country: String(t.country || "").trim()
      })).filter(t => t.code);
    }

    if (!title) {
      return res.status(400).json({ error: "title 값이 없습니다." });
    }

    if (!description) {
      return res.status(400).json({ error: "description 값이 없습니다." });
    }

    if (!targets.length) {
      return res.status(400).json({ error: "targets 값이 없습니다." });
    }

    const targetListText = targets
      .map((t, i) => `${i + 1}. ${t.code} : ${t.country}`)
      .join("\n");

    const prompt = `
You are a professional YouTube metadata localization assistant.

Translate the following source title and source description into each requested target locale.

Rules:
1. Keep the exact order of the requested targets.
2. Return plain text only.
3. Do not use JSON.
4. Do not add explanations, notes, markdown, tables, code fences, or headings outside the required format.
5. Preserve paragraph breaks in the description as naturally as possible.
6. For each target, use exactly this format:

Country Code: <code>
Country Name: <country>
Title: <translated title>
Description:
<translated description>

7. Separate each country block with one blank line only.

Requested targets:
${targetListText}

Source Title:
${title}

Source Description:
${description}
`.trim();

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          { role: "developer", content: "Return only the requested translation blocks in the exact specified format." },
          { role: "user", content: prompt }
        ],
        temperature: 0.4
      })
    });

    const raw = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: raw?.error?.message || `OpenAI 호출 실패 (${response.status})`
      });
    }

    const finalText = String(raw?.choices?.[0]?.message?.content || "").trim();

    if (!finalText) {
      return res.status(500).json({ error: "자동번역 결과가 비어 있습니다." });
    }

    return res.status(200).json({
      ok: true,
      count: targets.length,
      finalText
    });
  } catch (error) {
    return res.status(500).json({
      error: error?.message || "서버 함수 처리 중 오류가 발생했습니다."
    });
  }
}

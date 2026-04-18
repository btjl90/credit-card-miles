/**
 * Gemini 2.5 Flash integration for parsing T&C PDFs.
 *
 * Uses the free Google AI Gemini API. Rate limit: ~500 req/day.
 * We make 1 call per card per month — well within budget.
 */

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_API_URL = (apiKey: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

export interface EarnRate {
  category: string; // e.g. " dining", "travel", "online"
  rate: string; // e.g. "3 miles/S$1", "4x points/S$1"
  cap?: string; // e.g. "S$1,000/month", "10,000 miles/year"
  notes?: string; // e.g. "Capped at S$5,000/month spend"
}

export interface ParsedTerms {
  cardName: string;
  bank: string;
  parsedAt: string; // ISO timestamp
  effectiveDate?: string; // from T&C
  earnRates: EarnRate[];
  bonusCategories: string[];
  conversionRatio?: string; // e.g. "25,000 points → 10,000 miles"
  keyExclusions: string[];
  keyNotes: string[];
  rawSummary: string; // Gemini's free-text summary of changes
}

export interface GeminiChangeSummary {
  changed: boolean;
  summary: string;
  oldTerms?: ParsedTerms;
  newTerms: ParsedTerms;
}

const SYSTEM_PROMPT = `You are a credit card T&C analyst for Singapore credit cards.
Extract structured information from the provided credit card terms and conditions PDF text.
Be precise. When exact figures are not available, use "N/A".

Output a JSON object with this exact shape:
{
  "cardName": "...",
  "bank": "...",
  "effectiveDate": "...",
  "earnRates": [
    {
      "category": "...",
      "rate": "...",
      "cap": "...",
      "notes": "..."
    }
  ],
  "bonusCategories": ["..."],
  "conversionRatio": "...",
  "keyExclusions": ["..."],
  "keyNotes": ["..."],
  "rawSummary": "A 2-3 sentence plain-language summary of any changes compared to typical Singapore card terms, or 'No significant changes detected.'"
}

For earnRates, include every spending category mentioned (dining, travel, online, retail, etc.)
with the exact miles/points per dollar and any spend caps.
For keyExclusions, list MCC codes or merchant types that earn 0 (e.g. government, utilities, insurance).
For conversionRatio, state the points-to-miles ratio if mentioned (e.g. "25,000 HSBC points → 10,000 airline miles").
For keyNotes, include any notable changes, new restrictions, or promotional terms.

Return ONLY the JSON object — no markdown code fences, no explanation.`;

/**
 * Call Gemini 2.5 Flash to parse a T&C PDF.
 * Sends the raw PDF bytes directly — Gemini handles PDF parsing internally.
 */
export async function parseTermsWithGemini(
  pdfUrl: string,
  cardName: string,
  bank: string,
  apiKey: string,
): Promise<ParsedTerms> {
  const response = await fetch(pdfUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch PDF: ${response.status} ${response.statusText}`,
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  // Convert to base64 for Gemini's inline data
  const base64 = btoa(
    new Uint8Array(arrayBuffer).reduce(
      (data, byte) => data + String.fromCharCode(byte),
      "",
    ),
  );

  const geminiResponse = await fetch(GEMINI_API_URL(apiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: "application/pdf",
                data: base64,
              },
            },
            {
              text: `Extract structured terms from this credit card T&C PDF. Respond with JSON only.`,
            },
          ],
        },
      ],
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    }),
  });

  if (!geminiResponse.ok) {
    const errorText = await geminiResponse.text();
    throw new Error(`Gemini API error: ${geminiResponse.status} ${errorText}`);
  }

  const data = (await geminiResponse.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";

  // Strip markdown code fences if present
  const cleaned = rawText
    .replace(/^```json\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const parsed = JSON.parse(cleaned) as ParsedTerms;
  parsed.cardName = cardName;
  parsed.bank = bank;
  parsed.parsedAt = new Date().toISOString();

  return parsed;
}

/**
 * Compare two sets of terms and produce a human-readable change summary.
 */
export async function compareTerms(
  oldTerms: ParsedTerms,
  newTerms: ParsedTerms,
  apiKey: string,
): Promise<GeminiChangeSummary> {
  // Quick-diff first: check if any fields actually changed
  const quickChanged =
    JSON.stringify(oldTerms.earnRates) !== JSON.stringify(newTerms.earnRates) ||
    JSON.stringify(oldTerms.keyExclusions) !==
      JSON.stringify(newTerms.keyExclusions) ||
    oldTerms.conversionRatio !== newTerms.conversionRatio;

  if (!quickChanged) {
    return {
      changed: false,
      summary: "No changes detected.",
      oldTerms,
      newTerms,
    };
  }

  // Significant change — ask Gemini to summarize what changed
  const prompt = `Compare the OLD and NEW versions of credit card terms and produce a concise change summary.

OLD TERMS:
${JSON.stringify(oldTerms, null, 2)}

NEW TERMS:
${JSON.stringify(newTerms, null, 2)}

Respond with a JSON object:
{
  "summary": "2-3 sentence plain-language description of what changed",
  "changed": true
}`;

  const response = await fetch(GEMINI_API_URL(apiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.3,
      },
    }),
  });

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const rawText =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ??
    '{"summary": "Changes detected.","changed": true}';
  const cleaned = rawText
    .replace(/^```json\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const comparison = JSON.parse(cleaned) as {
    summary: string;
    changed: boolean;
  };

  return {
    changed: comparison.changed,
    summary: comparison.summary,
    oldTerms,
    newTerms,
  };
}

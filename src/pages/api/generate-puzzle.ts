// src/pages/api/generate-puzzle.ts
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const GET: APIRoute = async () => {
  try {
    const apiKey = env.GEMINI_API_KEY || (globalThis as any).process?.env?.GEMINI_API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Missing GEMINI_API_KEY' }), { status: 500 });
    }

    const prompt = `
Generate a batch of 3 distinct, concise logic puzzles for "Pick Your Poison".
Rules:
- 3 potion vials: I, II, and III per puzzle.
- Exactly TWO vials have truthful inscriptions.
- Exactly ONE vial is the "poison" and has a FALSE inscription (a lie).
- Keep descriptions and inscriptions very short and punchy.

Return JSON matching:
{
  "puzzles": [
    {
      "vials": [
        { "id": "I", "name": "...", "inscription": "..." },
        { "id": "II", "name": "...", "inscription": "..." },
        { "id": "III", "name": "...", "inscription": "..." }
      ],
      "poison_id": "I" | "II" | "III",
      "explanation": "..."
    }
  ]
}
`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            maxOutputTokens: 800,
          },
        }),
      }
    );

    const data = await geminiRes.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    return new Response(rawText, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
// src/pages/api/generate-puzzle.ts
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const GET: APIRoute = async ({ url }) => {
  const difficulty = (url.searchParams.get('difficulty') || 'medium').toLowerCase();
  const streak = parseInt(url.searchParams.get('streak') || '0', 10);

  const vialConfig: Record<string, { count: number; ids: string[] }> = {
    easy: { count: 2, ids: ['I', 'II'] },
    medium: { count: 3, ids: ['I', 'II', 'III'] },
    hard: { count: 4, ids: ['I', 'II', 'III', 'IV'] },
  };

  const currentConfig = vialConfig[difficulty] || vialConfig.medium;
  const vialCount = currentConfig.count;
  const vialIds = currentConfig.ids.join(', ');

  const apiKey = env.GEMINI_API_KEY || (globalThis as any).process?.env?.GEMINI_API_KEY;

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'Missing GEMINI_API_KEY secret on Cloudflare.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const prompt = `
Generate 1 unique logic puzzle for the game "Pick Your Poison".
Difficulty: ${difficulty.toUpperCase()} (${vialCount} Vials: ${vialIds}).
Player Streak: ${streak}.

RULES:
1. Exactly ${vialCount} vials: ${vialIds}.
2. Exactly ONE vial is the "poison" and has a FALSE inscription (a lie).
3. Exactly ${vialCount - 1} vial(s) are safe and have TRUE inscriptions.
4. Randomly pick which vial is the poison from (${vialIds}).
5. Keep inscriptions short (under 12 words) without nested quotes.
6. The puzzle MUST have exactly ONE logically consistent solution.

Return ONLY a valid JSON object matching this structure:
{
  "vials": [
    ${currentConfig.ids.map(id => `{"id": "${id}", "name": "Creative Potion Name", "inscription": "Short statement"}`).join(',\n    ')}
  ],
  "poison_id": "${currentConfig.ids[0]}",
  "explanation": "One short sentence explaining why."
}
`;

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            maxOutputTokens: 2048,
            temperature: 0.85,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return new Response(
        JSON.stringify({ error: `Gemini API Error (${geminiRes.status}): ${errText}` }),
        { status: geminiRes.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = await geminiRes.json();
    let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      return new Response(
        JSON.stringify({ error: 'Gemini returned empty candidate output', details: data }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const puzzle = JSON.parse(rawText);

    return new Response(JSON.stringify(puzzle), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Puzzle Generation Crash:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Failed to generate concoction' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
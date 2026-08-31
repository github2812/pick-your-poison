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
      JSON.stringify({ error: 'Missing GEMINI_API_KEY binding in Cloudflare environment.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Fast, precise logic prompt for a single puzzle
  const prompt = `
Generate EXACTLY 1 unique, infallible logic puzzle for "Pick Your Poison".
Difficulty: ${difficulty.toUpperCase()} (${vialCount} Vials: ${vialIds}).
Player Streak: ${streak}.

RULES:
- Exactly ${vialCount} vials: ${vialIds}.
- Exactly ONE vial is the "poison" and has a FALSE inscription (a lie).
- Exactly ${vialCount - 1} vial(s) are safe and have TRUE inscriptions.
- Randomize which vial is the poison (do NOT favor the last vial).
- Inscriptions must be under 10 words.
- The puzzle MUST have exactly ONE logically consistent solution.

Return ONLY this JSON schema:
{
  "vials": [
    ${currentConfig.ids.map(id => `{"id": "${id}", "name": "Thematic Potion Name", "inscription": "Short clue statement"}`).join(',\n    ')}
  ],
  "poison_id": "One of: ${vialIds}",
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
            maxOutputTokens: 400, // Keeps generation extremely fast (~1s)
            temperature: 0.9,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return new Response(
        JSON.stringify({ error: `Gemini API error: ${errText}` }),
        { status: geminiRes.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = await geminiRes.json();
    let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

    const puzzle = JSON.parse(rawText);

    return new Response(JSON.stringify(puzzle), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Puzzle gen error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Failed to distill logic puzzle' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
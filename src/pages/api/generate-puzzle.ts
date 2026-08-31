// src/pages/api/generate-puzzle.ts
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const GET: APIRoute = async () => {
  try {
    const apiKey = env.GEMINI_API_KEY || (globalThis as any).process?.env?.GEMINI_API_KEY;

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY secret is not detected by Cloudflare.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const prompt = `
You are generating a 3-vial logic puzzle for a game called "Pick Your Poison".
Rules:
- 3 potion vials: I, II, and III.
- Exactly TWO vials have truthful inscriptions.
- Exactly ONE vial is the "poison" and has a FALSE inscription (a lie).
- The puzzle MUST be uniquely solvable.

Return ONLY a JSON object matching this schema:
{
  "vials": [
    { "id": "I", "name": "...", "inscription": "..." },
    { "id": "II", "name": "...", "inscription": "..." },
    { "id": "III", "name": "...", "inscription": "..." }
  ],
  "poison_id": "I" | "II" | "III",
  "explanation": "..."
}
`;

    // Updated to gemini-3.6-flash
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errorData = await geminiRes.text();
      return new Response(
        JSON.stringify({ error: `Gemini API Error: ${errorData}` }),
        { status: geminiRes.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = await geminiRes.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    return new Response(rawText, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: `Worker Error: ${err.message || err.toString()}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
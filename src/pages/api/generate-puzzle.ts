// src/pages/api/generate-puzzle.ts
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

// Reliable fallback puzzles in case of network or rate-limit hiccups
const FALLBACK_PUZZLES = [
  {
    vials: [
      { id: "I", name: "Draught of Whispers", inscription: "Vial II contains the lethal poison." },
      { id: "II", name: "Elixir of Embers", inscription: "Vial III is completely safe to drink." },
      { id: "III", name: "Tears of the Siren", inscription: "I am safe, but Vial I is telling a lie." }
    ],
    poison_id: "III",
    explanation: "If III is lying, both I and II are telling the truth, which correctly places the poison in III."
  },
  {
    vials: [
      { id: "I", name: "Venom of the Sphinx", inscription: "The poison is located directly next to me." },
      { id: "II", name: "Solvent of Shadows", inscription: "Vial I is speaking the pure truth." },
      { id: "III", name: "Nectar of Null", inscription: "Vial II is the poisonous concoction." }
    ],
    poison_id: "III",
    explanation: "If III is the poison and lying, then Vial I and Vial II both speak truthfully."
  }
];

export const GET: APIRoute = async () => {
  try {
    const apiKey = env.GEMINI_API_KEY || (globalThis as any).process?.env?.GEMINI_API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ puzzles: FALLBACK_PUZZLES }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const prompt = `
Generate 3 distinct logic puzzles for the game "Pick Your Poison".
Rules:
- 3 potion vials: I, II, and III per puzzle.
- Exactly TWO vials have truthful inscriptions.
- Exactly ONE vial is the "poison" and has a FALSE inscription (a lie).
- The puzzle MUST have exactly one unique logical solution.
- Output clean JSON with no extra commentary or markdown formatting.

Format schema:
{
  "puzzles": [
    {
      "vials": [
        { "id": "I", "name": "Vial Name", "inscription": "Short clue statement" },
        { "id": "II", "name": "Vial Name", "inscription": "Short clue statement" },
        { "id": "III", "name": "Vial Name", "inscription": "Short clue statement" }
      ],
      "poison_id": "I",
      "explanation": "Brief solution reasoning."
    }
  ]
}
`;

    const geminiRes = await fetch(
      `[https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=$](https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=$){apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            maxOutputTokens: 2048,
            temperature: 0.7,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      console.warn('Gemini API returned an error, serving fallback batch.');
      return new Response(JSON.stringify({ puzzles: FALLBACK_PUZZLES }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await geminiRes.json();
    let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Strip markdown code fences if Gemini included them
    rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

    // Validate JSON on the server
    const parsedData = JSON.parse(rawText);

    return new Response(JSON.stringify(parsedData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Server generation error:', err);
    // Return fallback rather than a 500 error to keep the game playable
    return new Response(JSON.stringify({ puzzles: FALLBACK_PUZZLES }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
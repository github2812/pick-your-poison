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

  // Adaptive logic depth based on player's streak
  let logicStyle = 'Direct statements, simple assertions, or single contradictions.';
  if (streak >= 3 && streak < 7) {
    logicStyle = 'Mutual declarations, relative placement clues, and biconditional statements (e.g., "Either X or Y is lying, but not both").';
  } else if (streak >= 7) {
    logicStyle = 'Complex syllogisms, nested conditionals (e.g., "If X is safe, then Y is poison"), and parity/order constraints.';
  }

  const apiKey = env.GEMINI_API_KEY || (globalThis as any).process?.env?.GEMINI_API_KEY;

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'Missing GEMINI_API_KEY binding in Cloudflare environment.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const prompt = `
You are an expert formal logician creating 3 original, infallible logic puzzles for "Pick Your Poison".

Difficulty Level: ${difficulty.toUpperCase()} (${vialCount} Vials: ${vialIds})
Current Streak Level: ${streak}
Logic Archetype: ${logicStyle}

GAME RULES:
1. There are exactly ${vialCount} vials: ${vialIds}.
2. Exactly ONE vial is the "POISON" and its inscription is a FALSE statement (a Lie).
3. The remaining ${vialCount - 1} vial(s) are "SAFE" and their inscriptions are 100% TRUE statements.
4. UNIFORM DISTRIBUTION: Randomly choose the poison across ${vialIds} (do NOT default to the last vial).
5. VARIETY: Use diverse potion themes (e.g., Philtre of Lunar Frost, Draught of the Manticore, Essence of Oblivion) and vary statement sentence structures.

RIGOROUS LOGICAL PROOF REQUIREMENT (Truth-Table Verification):
Before outputting each puzzle, you must rigorously test all ${vialCount} hypotheses:
- Hypothesis 1 (Vial ${currentConfig.ids[0]} is Poison/Lie; all others Safe/True): Evaluate truth values of all inscriptions. Check if this creates a contradiction.
- Hypothesis 2 (Vial ${currentConfig.ids[1]} is Poison/Lie; all others Safe/True): Evaluate truth values.
${vialCount >= 3 ? `- Hypothesis 3 (Vial ${currentConfig.ids[2]} is Poison/Lie; all others Safe/True): Evaluate truth values.` : ''}
${vialCount >= 4 ? `- Hypothesis 4 (Vial ${currentConfig.ids[3]} is Poison/Lie; all others Safe/True): Evaluate truth values.` : ''}

CRITICAL: Exactly ONE hypothesis must be logically consistent (0 contradictions). The remaining ${vialCount - 1} hypotheses MUST contain at least one clear contradiction.

Output JSON with this exact schema:
{
  "puzzles": [
    {
      "vials": [
        ${currentConfig.ids.map(id => `{"id": "${id}", "name": "Unique Thematic Name", "inscription": "Concise clue (under 12 words)"}`).join(',\n        ')}
      ],
      "poison_id": "One of: ${vialIds}",
      "explanation": "Clear step-by-step deductive proof showing why this vial must be the only possible poison."
    }
  ]
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
            temperature: 0.95, // Higher entropy ensures fresh names and clue styles
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

    const parsedData = JSON.parse(rawText);

    // Validate that generated puzzles match the requested vial count and IDs
    if (!parsedData.puzzles || !Array.isArray(parsedData.puzzles)) {
      throw new Error('Invalid JSON structure returned by model.');
    }

    return new Response(JSON.stringify(parsedData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Puzzle generation error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Failed to distill logic puzzle' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
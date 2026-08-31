// src/pages/api/generate-puzzle.ts
import type { APIRoute } from 'astro';
import { GoogleGenAI, Type } from '@google/genai';
import { env } from 'cloudflare:workers';

export const GET: APIRoute = async () => {
  try {
    // Read directly from Cloudflare Workers environment bindings
    const apiKey = env.GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error('Missing GEMINI_API_KEY in Cloudflare environment bindings.');
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY is missing.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `
You are generating a 3-vial logic puzzle for a game called "Pick Your Poison".
Rules:
- 3 potion vials: I, II, and III.
- Exactly TWO vials have truthful inscriptions.
- Exactly ONE vial is the "poison" and has a FALSE inscription (a lie).
- The puzzle MUST be uniquely solvable.
`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            vials: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, enum: ['I', 'II', 'III'] },
                  name: { type: Type.STRING },
                  inscription: { type: Type.STRING },
                },
                required: ['id', 'name', 'inscription'],
              },
            },
            poison_id: { type: Type.STRING, enum: ['I', 'II', 'III'] },
            explanation: { type: Type.STRING },
          },
          required: ['vials', 'poison_id', 'explanation'],
        },
      },
    });

    return new Response(response.text, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Gemini Generation Error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Failed to generate concoction' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
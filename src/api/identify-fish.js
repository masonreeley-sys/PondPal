import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { imageUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ error: "Missing imageUrl" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    }

    const response = await client.responses.create({
      model: "gpt-5.5-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "You are PondPal's fish identification helper. Identify the freshwater fish in this photo. Return ONLY valid JSON with these exact keys: species, confidence, estimated_length_inches, notes. confidence must be a number from 0 to 100. estimated_length_inches should be a number only if there is a clear ruler, measuring board, or reliable scale reference in the image. If there is no reliable scale reference, use null. Keep notes short and mention uncertainty.",
            },
            {
              type: "input_image",
              image_url: imageUrl,
            },
          ],
        },
      ],
    });

    const text = response.output_text || "{}";

    let parsed;

    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = {
        species: "Unknown",
        confidence: 0,
        estimated_length_inches: null,
        notes: text,
      };
    }

    return res.status(200).json({
      species: parsed.species || "Unknown",
      confidence: Number(parsed.confidence) || 0,
      estimated_length_inches:
        parsed.estimated_length_inches === null ||
        parsed.estimated_length_inches === undefined
          ? null
          : Number(parsed.estimated_length_inches),
      notes: parsed.notes || "No notes returned.",
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Fish identification failed",
    });
  }
}

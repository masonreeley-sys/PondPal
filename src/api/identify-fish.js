import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function getMimeType(contentType, imageUrl) {
  if (contentType && contentType.startsWith("image/")) {
    return contentType.split(";")[0];
  }

  const lowerUrl = String(imageUrl || "").toLowerCase();

  if (lowerUrl.includes(".png")) return "image/png";
  if (lowerUrl.includes(".webp")) return "image/webp";
  if (lowerUrl.includes(".jpg") || lowerUrl.includes(".jpeg")) {
    return "image/jpeg";
  }

  return "image/jpeg";
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

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

    const imageResponse = await fetch(imageUrl);

    if (!imageResponse.ok) {
      return res.status(400).json({
        error: "Could not download fish photo. Make sure the catch-photos bucket is public.",
      });
    }

    const contentType = imageResponse.headers.get("content-type");
    const mimeType = getMimeType(contentType, imageUrl);

    if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
      return res.status(400).json({
        error: "Unsupported image type. Please upload JPG, PNG, or WEBP.",
      });
    }

    const arrayBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString("base64");
    const dataUrl = `data:${mimeType};base64,${base64Image}`;

    const response = await client.responses.create({
      model: "gpt-5.4-mini",
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
              image_url: dataUrl,
            },
          ],
        },
      ],
    });

    const text = response.output_text || "{}";
    const parsed = safeJsonParse(text) || {
      species: "Unknown",
      confidence: 0,
      estimated_length_inches: null,
      notes: text,
    };

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

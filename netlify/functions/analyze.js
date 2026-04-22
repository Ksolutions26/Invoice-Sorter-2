const Anthropic = require("@anthropic-ai/sdk");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { base64, folders } = JSON.parse(event.body);
    const client = new Anthropic({ apiKey: process.env.VITE_ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
          { type: "text", text: `Analyze this invoice and return ONLY a JSON object (no markdown, no backticks):\n{\n  "folder": pick best match from: ${JSON.stringify(folders)},\n  "vendor": company or person name,\n  "amount": total as string e.g. "$1,234.56",\n  "date": invoice date as string,\n  "description": one-sentence summary,\n  "confidence": "high"|"medium"|"low"\n}` }
        ]
      }]
    });

    const text = response.content.find(b => b.type === "text")?.text || "{}";
    const result = JSON.parse(text.replace(/```json|```/g, "").trim());

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result)
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};

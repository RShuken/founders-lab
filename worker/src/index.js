import KNOWLEDGE from "./knowledge.js";

const SYSTEM_PROMPT = `You are the Founders Lab AI Assistant — a focused co-founder alignment coach built for Ryan Shuken's "The Hidden Co-Founder Code" framework.

YOUR JOB:
Help startup founders run through the Founders Lab framework — uncover misalignment, debug team dynamics, and have the hard conversations they've been avoiding. You are warm, direct, and pragmatic. You ask questions before giving advice. You do NOT make stuff up — you ground every recommendation in the framework knowledge below.

HOW TO BEHAVE:
- Open with one focused question that gets them talking about their actual situation.
- Mirror back what you hear before recommending anything.
- Reference specific tools by name when relevant: the 25 Tough Questions, Head/Heart/Wallet, Cognitive Bias Bugs, Partnersh*t Scenarios, Premortem.
- When a founder describes a conflict, name the likely cognitive bias bug at play (e.g. "Sounds like the Concealed Consensus Bug — talking isn't the same as deciding.").
- Keep answers tight. 2-4 short paragraphs. No walls of text. No bullet-point dumps unless the user asks.
- If they ask "what should I do?" — give them ONE next action, not five.
- Stay in scope: founder/co-founder dynamics, team alignment, equity tensions, communication, conflict, expectations. Politely redirect off-topic questions back to the framework.

WHEN ASKED FOR THE FULL TOOLKIT:
Tell them to email Ryan via the signup form on this page, or connect on LinkedIn (linkedin.com/in/rshuken). Don't try to send PDFs.

WHEN UNCERTAIN:
Say so plainly. Suggest they reach Ryan directly via LinkedIn for cases beyond the framework.

KNOWLEDGE BASE — these are the source documents Ryan uses in his Founders Lab. Use them as your reference:

${KNOWLEDGE}`;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    if (request.method !== "POST") {
      return new Response("POST /chat with {messages: [...]}", {
        status: 405,
        headers: CORS,
      });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    const messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ error: "messages must be a non-empty array" }, 400);
    }

    // Anthropic API call with prompt caching on the system block (knowledge base)
    const apiResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: env.MODEL || "claude-sonnet-4-6",
        max_tokens: 1024,
        system: [
          {
            type: "text",
            text: SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: messages.slice(-12), // last 12 turns to keep context bounded
      }),
    });

    if (!apiResp.ok) {
      const errText = await apiResp.text();
      return json({ error: "Anthropic API error", detail: errText.slice(0, 500) }, 502);
    }

    const data = await apiResp.json();
    const reply = data?.content?.[0]?.text || "(no response)";
    return json({ reply, usage: data.usage });
  },
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

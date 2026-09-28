import { createServerFn } from "@tanstack/react-start";

export const narrateStep = createServerFn({ method: "POST" })
  .validator((input: { step: string; facts: string }) => input)
  .handler(async ({ data }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false as const, error: "Commentary is unavailable in this preview." };
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 280,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You narrate a vessel procurement decision for a superintendent. Use only the facts given. Four short sentences. Do not invent part numbers, prices, or vendors. Do not claim to be Qwen or GLM.",
          },
          { role: "user", content: `Step: ${data.step}\n${data.facts.slice(0, 2500)}` },
        ],
      }),
    });
    if (!res.ok) return { ok: false as const, error: `Commentary failed (${res.status}).` };
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = body.choices?.[0]?.message?.content?.trim() ?? "";
    return text ? { ok: true as const, text } : { ok: false as const, error: "Empty commentary." };
  });

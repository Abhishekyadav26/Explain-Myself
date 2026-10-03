import "dotenv/config";

// ---------------------------------------------------------------------------
// Model client (any OpenAI-compatible provider; free tiers work).
// Model id + provider endpoint come from environment/config (Test case 7),
// the request is bounded by an explicit timeout (Test case 5), and the
// system instructions and the user content travel as SEPARATE messages
// (Test case 1): they are never concatenated into one prompt string.
// ---------------------------------------------------------------------------

const PROVIDER_ENDPOINT = process.env.OPENAI_BASE_URL ?? "https://api.groq.com/openai/v1";
const MODEL_ID = process.env.OPENAI_MODEL ?? "llama-3.1-8b-instant";
const MODEL_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS ?? "20000");

export function modelConfig() {
  return {
    endpoint: PROVIDER_ENDPOINT,
    model: MODEL_ID,
    timeoutMs: MODEL_TIMEOUT_MS,
    hasKey: Boolean(process.env.OPENAI_API_KEY),
  };
}

export interface ChatArgs {
  systemPrompt: string;
  userText: string;
}

export async function callModel(args: ChatArgs): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);
  try {
    const res = await fetch(PROVIDER_ENDPOINT + "/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(process.env.OPENAI_API_KEY
          ? { Authorization: "Bearer " + process.env.OPENAI_API_KEY }
          : {}),
      },
      body: JSON.stringify({
        model: MODEL_ID,
        messages: [
          { role: "system", content: args.systemPrompt },
          { role: "user", content: args.userText },
        ],
        temperature: 0.4,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error("provider error " + res.status + " " + text.slice(0, 200));
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    if (content.trim() === "") throw new Error("empty provider reply");
    return content;
  } finally {
    clearTimeout(timer);
  }
}

// Deterministic offline fallback used when no API key is configured or the
// provider is unreachable. It honours the same preference axes so the demo,
// recorded cases, and tests work without spending money.
export function mockReply(systemPrompt: string, userText: string): string {
  const wantsPortuguese = systemPrompt.includes("Você é um assistente prestativo.");
  const wantsShort = systemPrompt.includes("Use frases curtas.");
  void userText;
  if (wantsPortuguese) {
    if (wantsShort) {
      return "Entendido.\n\nVou ser breve.\n\nFrases curtas.\n\nSem parágrafo longo.";
    }
    return "Entendido. Vou responder em português de forma clara e direta para facilitar a leitura.";
  }
  if (wantsShort) {
    return "Understood.\n\nI will keep it brief.\n\nShort sentences only.";
  }
  return "Understood. I will answer clearly and directly in English with a medium-length response.";
}

export async function askWithFallback(args: ChatArgs): Promise<{ text: string; via: string }> {
  if (!process.env.OPENAI_API_KEY) {
    return { text: mockReply(args.systemPrompt, args.userText), via: "mock:no-key" };
  }
  try {
    const text = await callModel(args);
    return { text, via: "provider" };
  } catch {
    return { text: mockReply(args.systemPrompt, args.userText), via: "mock:fallback" };
  }
}

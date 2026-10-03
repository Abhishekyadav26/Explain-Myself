import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolvePreferences, validatePrefsFromRecords } from "./prefs.js";
import { buildSystemPrompt } from "./prompt.js";
import { askWithFallback, modelConfig } from "./model.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "64kb" }));

function formatReply(text: string, prefs: { sentences: string; length: string }): string {
  let out = text.trim();
  if (prefs.sentences === "short") {
    const parts = out
      .split(/(?<=[.!?。])\s+|\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
    out = parts.join("\n\n");
  }
  if (prefs.length === "short") {
    const parts = out.split(/\n\n+/).slice(0, 5);
    out = parts.join("\n\n");
  }
  return out;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, model: modelConfig() });
});

// Preview resolved preferences without asking (helps debugging ENS records).
app.get("/api/resolve", async (req, res) => {
  try {
    const name = String(req.query.name ?? "");
    if (!name.trim()) return res.status(400).json({ error: "missing name" });
    const result = await resolvePreferences(name);
    res.json(result);
  } catch (e) {
    // Invalid names (bad normalization) fall back cleanly — never throw raw.
    const prefs = validatePrefsFromRecords({});
    res.json({ normalizedName: "", prefs, note: "invalid name; using defaults" });
  }
});

app.post("/api/chat", async (req, res) => {
  try {
    const ensName = String(req.body?.ensName ?? "");
    const question = String(req.body?.question ?? "");
    if (!ensName.trim() || !question.trim()) {
      return res.status(400).json({ error: "ensName and question are required" });
    }
    let resolved;
    try {
      resolved = await resolvePreferences(ensName);
    } catch {
      resolved = {
        normalizedName: ensName.trim(),
        prefs: validatePrefsFromRecords({}),
        note: "invalid name; using defaults",
      };
    }
    const systemPrompt = buildSystemPrompt(resolved.prefs);
    const { text, via } = await askWithFallback({ systemPrompt, userText: question });
    res.json({
      normalizedName: resolved.normalizedName,
      prefs: resolved.prefs,
      answer: formatReply(text, resolved.prefs),
      via,
    });
  } catch (e) {
    res.status(500).json({ error: "chat failed" });
  }
});

const pub = path.join(__dirname, "..", "public");
app.use(express.static(pub));

const PORT = Number(process.env.PORT ?? "5173");
app.listen(PORT, () => {
  console.log("Explain-Myself listening on http://localhost:" + PORT);
  console.log("model endpoint: " + modelConfig().endpoint + " model: " + modelConfig().model);
});

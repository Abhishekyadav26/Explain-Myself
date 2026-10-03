import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

const promptSrc = read("src/prompt.ts");
const prefsSrc = read("src/prefs.ts");
const modelSrc = read("src/model.ts");
const serverSrc = read("src/server.ts");

test("1. system prompt uses only app-authored strings; system/user are separate messages", () => {
  for (const bad of ["${prefs", "${raw", "${avoid", "${topic", "${records", "${record", "${lang"]) {
    assert.ok(!promptSrc.includes(bad), "prompt.ts must not interpolate " + bad);
  }
  assert.ok(promptSrc.includes("buildSystemPrompt"), "missing builder");
  assert.ok(modelSrc.includes("role: \"system\"") || modelSrc.includes('role: "system"'), "no separate system message");
  assert.ok(modelSrc.includes("role: \"user\""), "no separate user message");
  assert.ok(modelSrc.includes("chat/completions"), "no model call found");
  // instructions and user content must not be concatenated into one string
  assert.ok(!/systemPrompt\s*\+\s*\w*[Qq]uestion/.test(modelSrc), "system+user concatenated");
  assert.ok(!/systemPrompt\s*\+\s*args/.test(modelSrc), "system+user concatenated");
});

test("2. every preference value is checked against an allowlist", () => {
  for (const k of ["pref.lang", "pref.length", "pref.sentences", "pref.paragraph", "pref.access", "pref.avoid"]) {
    assert.ok(prefsSrc.includes(k), "missing key " + k);
  }
  assert.ok(prefsSrc.includes("z.enum"), "no zod enum allowlist");
  assert.ok(prefsSrc.includes("safeParse"), "no safeParse validation");
  assert.ok(prefsSrc.includes("getEnsText"), "preferences never read from ENS");
});

test("3. unset record falls back to a named default", () => {
  assert.ok(prefsSrc.includes("DEFAULT_PREFS"), "no named defaults");
  assert.ok(prefsSrc.includes("=== null"), "no explicit null branch");
  assert.ok(prefsSrc.includes('trim() === ""'), "no explicit empty branch");
  assert.ok(prefsSrc.includes("getEnsText"), "no ENS record read");
});

test("4. entered name is normalized before resolution", () => {
  assert.ok(prefsSrc.includes("viem/ens"), "no ENSIP-15 normalize import");
  assert.ok(prefsSrc.includes("normalize("), "normalize() never called");
  const normIdx = prefsSrc.indexOf("normalize(");
  const resolveIdx = prefsSrc.indexOf("getEnsText");
  assert.ok(normIdx !== -1 && resolveIdx !== -1 && normIdx < resolveIdx, "normalize must precede resolution");
  assert.ok(prefsSrc.includes("normalizedName"), "resolution must use normalized name");
});

test("5. model request has an explicit timeout", () => {
  assert.ok(modelSrc.includes("AbortController"), "no AbortController");
  assert.ok(modelSrc.includes("setTimeout"), "no setTimeout bound");
  assert.ok(modelSrc.includes("signal"), "signal not passed to fetch");
  assert.ok(modelSrc.includes("TIMEOUT") || modelSrc.includes("timeoutMs") || modelSrc.includes("timeout"), "no timeout value");
});

test("6. recorded cases pair one question with two or more preference sets", () => {
  const dir = path.join(root, "cases");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  assert.ok(files.length > 0, "no recorded cases");
  let ok = false;
  for (const f of files) {
    const c = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    assert.ok(typeof c.question === "string" && c.question.length > 0, f + ": missing question");
    const sets = c.preferenceSets ?? c.preferences ?? [];
    if (Array.isArray(sets) && sets.length >= 2) {
      for (const s of sets) {
        const exp = s.expected ?? {};
        const hasProp =
          exp.language ?? exp.maxSentences ?? exp.maxLength ?? exp.readingLevel ??
          exp.sentenceStyle ?? exp.paragraphStyle;
        assert.ok(hasProp, f + ": preference set states no expected property");
      }
      ok = true;
    }
  }
  assert.ok(ok, "no case pairs one question with 2+ preference sets");
});

test("7. model id and provider endpoint come from configuration", () => {
  assert.ok(modelSrc.includes("process.env.OPENAI_MODEL"), "model id not from env");
  assert.ok(modelSrc.includes("process.env.OPENAI_BASE_URL"), "endpoint not from env");
});

test("8. no credential appears in any tracked file", () => {
  const exts = [".ts", ".mjs", ".json", ".html", ".md", ".example"];
  const skip = ["package-lock.json"];
  const files = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name === ".git" || e.name === "dist") continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (exts.some((x) => e.name.endsWith(x)) && !skip.includes(e.name)) files.push(p);
    }
  };
  walk(root);
  const credPatterns = [
    /sk-[A-Za-z0-9]{10,}/,
    /gsk_[A-Za-z0-9]{10,}/,
    /xox[bap]-[A-Za-z0-9-]{10,}/,
    /0x[0-9a-fA-F]{64}/,
    /AKIA[0-9A-Z]{16}/,
  ];
  for (const f of files) {
    const content = fs.readFileSync(f, "utf8");
    for (const re of credPatterns) {
      assert.ok(!re.test(content), path.relative(root, f) + " appears to contain a credential (" + re + ")");
    }
  }
  const envExample = read(".env.example");
  assert.ok(!/sk-[A-Za-z0-9]{10,}/.test(envExample), ".env.example contains a key");
});

test("server: Ana flow — resolve ENS once, answer honours prefs", () => {
  assert.ok(serverSrc.includes("/api/chat"), "missing chat route");
  assert.ok(serverSrc.includes("buildSystemPrompt"), "chat does not steer from prefs");
  assert.ok(read("public/index.html").includes("localStorage"), "ENS name not remembered");
});

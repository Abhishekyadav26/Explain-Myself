import type { ResolvedPrefs } from "./prefs.js";

// ---------------------------------------------------------------------------
// System prompt steering.
// CRITICAL INVARIANT (Test case 1): the system/instruction message is composed
// ONLY of app-authored strings below. Validated preference values SELECT which
// constant block is used, but no raw text-record content is ever inserted.
// There is intentionally zero string interpolation of preference values here.
// ---------------------------------------------------------------------------

const BASE_PT = "Você é um assistente prestativo.";
const BASE_EN = "You are a helpful assistant.";
const BASE_ES = "Eres un asistente servicial.";

const SHORT_PT = "Use frases curtas.";
const SHORT_EN = "Use short sentences.";
const SHORT_ES = "Usa frases cortas.";

const NO_LONG_PARA_PT = "Nunca use parágrafos longos. Uma ideia por linha.";
const NO_LONG_PARA_EN = "Never use long paragraphs. One idea per line.";
const NO_LONG_PARA_ES = "Nunca uses párrafos largos. Una idea por línea.";

const DYSLEXIA_PT = "Use palavras simples. Use linhas em branco entre frases.";
const DYSLEXIA_EN = "Use simple words. Leave blank lines between sentences.";
const DYSLEXIA_ES = "Usa palabras simples. Deja líneas en blanco entre frases.";

const BRIEF_PT = "Respostas curtas. No máximo cinco frases.";
const BRIEF_EN = "Keep answers short. At most five sentences.";
const BRIEF_ES = "Respuestas cortas. Máximo cinco frases.";

const AVOID_POLITICS = "Do not discuss politics.";
const AVOID_HORROR = "Do not discuss horror.";
const AVOID_SPORTS = "Do not discuss sports.";
const AVOID_FINANCE = "Do not give financial advice.";
const AVOID_DIET = "Do not give diet advice.";

export function buildSystemPrompt(prefs: ResolvedPrefs): string {
  const lines: string[] = [];

  if (prefs.lang === "pt") {
    lines.push(BASE_PT);
  } else if (prefs.lang === "es") {
    lines.push(BASE_ES);
  } else {
    lines.push(BASE_EN);
  }

  if (prefs.sentences === "short") {
    if (prefs.lang === "pt") {
      lines.push(SHORT_PT);
    } else if (prefs.lang === "es") {
      lines.push(SHORT_ES);
    } else {
      lines.push(SHORT_EN);
    }
  }

  if (prefs.paragraph === "no-long") {
    if (prefs.lang === "pt") {
      lines.push(NO_LONG_PARA_PT);
    } else if (prefs.lang === "es") {
      lines.push(NO_LONG_PARA_ES);
    } else {
      lines.push(NO_LONG_PARA_EN);
    }
  }

  if (prefs.access === "dyslexia") {
    if (prefs.lang === "pt") {
      lines.push(DYSLEXIA_PT);
    } else if (prefs.lang === "es") {
      lines.push(DYSLEXIA_ES);
    } else {
      lines.push(DYSLEXIA_EN);
    }
  }

  if (prefs.length === "short") {
    if (prefs.lang === "pt") {
      lines.push(BRIEF_PT);
    } else if (prefs.lang === "es") {
      lines.push(BRIEF_ES);
    } else {
      lines.push(BRIEF_EN);
    }
  }

  // Avoid-topics: validated enum values select app-authored constants.
  // No raw record text is inserted.
  if (prefs.avoid.includes("politics")) {
    lines.push(AVOID_POLITICS);
  }
  if (prefs.avoid.includes("horror")) {
    lines.push(AVOID_HORROR);
  }
  if (prefs.avoid.includes("sports")) {
    lines.push(AVOID_SPORTS);
  }
  if (prefs.avoid.includes("finance")) {
    lines.push(AVOID_FINANCE);
  }
  if (prefs.avoid.includes("diet")) {
    lines.push(AVOID_DIET);
  }

  return lines.join("\n");
}

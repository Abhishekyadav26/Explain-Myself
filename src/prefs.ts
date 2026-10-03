import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import { normalize } from "viem/ens";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Preference format (documented in README).
// ENS text record keys + allowed values. Everything is validated; anything
// outside the allowlist is discarded and replaced by the named default.
// ---------------------------------------------------------------------------

export const RECORD_KEYS = {
  lang: "pref.lang",
  length: "pref.length",
  sentences: "pref.sentences",
  paragraph: "pref.paragraph",
  access: "pref.access",
  avoid: "pref.avoid",
} as const;

export const LangSchema = z.enum(["pt", "en", "es"]);
export const LengthSchema = z.enum(["short", "medium"]);
export const SentencesSchema = z.enum(["short", "any"]);
export const ParagraphSchema = z.enum(["no-long", "allow"]);
export const AccessSchema = z.enum(["dyslexia", "none"]);

// Bounded allowlist for topics to avoid. Raw entries outside this set are
// dropped — never passed through.
export const ALLOWED_AVOID_TOPICS = [
  "politics",
  "horror",
  "sports",
  "finance",
  "diet",
] as const;
export const AvoidTopicSchema = z.enum(ALLOWED_AVOID_TOPICS);

export type Lang = z.infer<typeof LangSchema>;
export type AvoidTopic = z.infer<typeof AvoidTopicSchema>;

export interface ResolvedPrefs {
  lang: Lang;
  length: z.infer<typeof LengthSchema>;
  sentences: z.infer<typeof SentencesSchema>;
  paragraph: z.infer<typeof ParagraphSchema>;
  access: z.infer<typeof AccessSchema>;
  avoid: AvoidTopic[];
}

// Named defaults used whenever a record is unset or empty (Test case 3).
export const DEFAULT_PREFS: ResolvedPrefs = {
  lang: "en",
  length: "medium",
  sentences: "any",
  paragraph: "allow",
  access: "none",
  avoid: [],
};

const sepoliaClient = createPublicClient({
  chain: sepolia,
  transport: http(),
});

// Validate one raw record value against its schema, falling back to default.
function validateOne<T>(schema: z.ZodType<T>, raw: string | null | undefined, fallback: T): T {
  if (raw === null || raw === undefined || raw.trim() === "") {
    return fallback;
  }
  const parsed = schema.safeParse(raw.trim().toLowerCase());
  if (!parsed.success) {
    return fallback;
  }
  return parsed.data;
}

function validateAvoidList(raw: string | null | undefined): AvoidTopic[] {
  if (raw === null || raw === undefined || raw.trim() === "") {
    return DEFAULT_PREFS.avoid;
  }
  const parts = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0)
    .slice(0, 5);
  const out: AvoidTopic[] = [];
  for (const part of parts) {
    const parsed = AvoidTopicSchema.safeParse(part);
    if (parsed.success) {
      if (!out.includes(parsed.data)) out.push(parsed.data);
    }
    // values outside the allowlist are silently discarded
  }
  return out;
}

/**
 * Pure validation entry point (no chain). Used by recorded cases and tests.
 * Every value is checked against its allowlist; unset/empty falls back.
 */
export function validatePrefsFromRecords(
  records: Record<string, string | null | undefined>
): ResolvedPrefs {
  const rawLang = records[RECORD_KEYS.lang];
  let lang: ResolvedPrefs["lang"];
  if (rawLang === null || rawLang === undefined || rawLang.trim() === "") {
    lang = DEFAULT_PREFS.lang;
  } else {
    lang = validateOne(LangSchema, rawLang, DEFAULT_PREFS.lang);
  }

  const rawLength = records[RECORD_KEYS.length];
  let length: ResolvedPrefs["length"];
  if (rawLength === null || rawLength === undefined || rawLength.trim() === "") {
    length = DEFAULT_PREFS.length;
  } else {
    length = validateOne(LengthSchema, rawLength, DEFAULT_PREFS.length);
  }

  const rawSentences = records[RECORD_KEYS.sentences];
  let sentences: ResolvedPrefs["sentences"];
  if (rawSentences === null || rawSentences === undefined || rawSentences.trim() === "") {
    sentences = DEFAULT_PREFS.sentences;
  } else {
    sentences = validateOne(SentencesSchema, rawSentences, DEFAULT_PREFS.sentences);
  }

  const rawParagraph = records[RECORD_KEYS.paragraph];
  let paragraph: ResolvedPrefs["paragraph"];
  if (rawParagraph === null || rawParagraph === undefined || rawParagraph.trim() === "") {
    paragraph = DEFAULT_PREFS.paragraph;
  } else {
    paragraph = validateOne(ParagraphSchema, rawParagraph, DEFAULT_PREFS.paragraph);
  }

  const rawAccess = records[RECORD_KEYS.access];
  let access: ResolvedPrefs["access"];
  if (rawAccess === null || rawAccess === undefined || rawAccess.trim() === "") {
    access = DEFAULT_PREFS.access;
  } else {
    access = validateOne(AccessSchema, rawAccess, DEFAULT_PREFS.access);
  }

  const rawAvoid = records[RECORD_KEYS.avoid];
  let avoid: AvoidTopic[];
  if (rawAvoid === null || rawAvoid === undefined || rawAvoid.trim() === "") {
    avoid = DEFAULT_PREFS.avoid;
  } else {
    avoid = validateAvoidList(rawAvoid);
  }

  return { lang, length, sentences, paragraph, access, avoid };
}

export interface ResolveResult {
  normalizedName: string;
  prefs: ResolvedPrefs;
  note: string;
}

/**
 * Resolve preferences for a user-entered ENS name on Sepolia.
 * The entered name is ALWAYS normalized (ENSIP-15) before any resolution.
 */
export async function resolvePreferences(enteredName: string): Promise<ResolveResult> {
  const trimmed = enteredName.trim();
  // ENSIP-15 normalization FIRST — raw input never reaches a resolution call.
  const normalizedName = normalize(trimmed);

  const keys = Object.values(RECORD_KEYS);
  const raws: Record<string, string | null> = {};
  for (const key of keys) {
    try {
      const raw = await sepoliaClient.getEnsText({
        name: normalizedName,
        key,
      });
      raws[key] = raw;
    } catch {
      raws[key] = null;
    }
  }

  const prefs = validatePrefsFromRecords(raws);
  const allUnset = keys.every((k) => raws[k] === null || raws[k] === undefined || String(raws[k]).trim() === "");
  return {
    normalizedName,
    prefs,
    note: allUnset ? "no records set; using defaults" : "records resolved",
  };
}

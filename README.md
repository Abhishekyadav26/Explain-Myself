# Explain Myself — Stop Making Me Explain Myself

Ana is dyslexic and reads Portuguese far more comfortably than English.
She writes her preferences down **once**, as **ENS text records on a name she
controls** (Sepolia), and this assistant honours them on **every** answer —
so the next assistant she tries could honour them too.

## Preference format (ENS text records)

Namespace `pref.*`. Every value is validated against an allowlist; anything
missing, empty, or outside the list falls back to the named default and is
never injected into the model prompt.

| Key | Allowed values | Default | Meaning |
|---|---|---|---|
| `pref.lang` | `pt` \| `en` \| `es` | `en` | Answer language |
| `pref.length` | `short` \| `medium` | `medium` | `short` = at most 5 sentences |
| `pref.sentences` | `short` \| `any` | `any` | `short` = short sentences, one idea per line |
| `pref.paragraph` | `no-long` \| `allow` | `allow` | `no-long` = never long paragraphs |
| `pref.access` | `dyslexia` \| `none` | `none` | `dyslexia` = simple words + blank lines between sentences |
| `pref.avoid` | comma list of `politics,horror,sports,finance,diet` (max 5) | empty | Topics to avoid; entries outside the list are dropped |

Example (Ana): `pref.lang=pt`, `pref.length=short`,
`pref.sentences=short`, `pref.paragraph=no-long`, `pref.access=dyslexia`,
`pref.avoid=politics`.

## Sepolia names tested

| Name | Profile |
|---|---|
| `ana-curta-pt.eth` | pt, short, short-sentences, no-long paragraphs, dyslexia-friendly, avoid politics |
| `leo-longo-en.eth` | en, medium, any sentence length, paragraphs allowed, no access tweaks |

Set the records with your own controller wallet (nothing secret is committed):

```sh
cp .env.example .env   # fill SEPOLIA_RPC_URL + SETTER_PRIVATE_KEY only in .env (gitignored)
npm install
npm run set-records    # dry-run without env; writes via setText with env
```

## Run the assistant

Any OpenAI-compatible provider works (Groq / OpenRouter / Gemini-compat free
tiers are enough). Model id + endpoint come from the environment.

```sh
npm install
cp .env.example .env   # set OPENAI_BASE_URL, OPENAI_MODEL, OPENAI_API_KEY
npm run dev            # http://localhost:5173
```

No key? The app still runs in deterministic mock mode so Ana's flow
(short Portuguese sentences) is demonstrable offline.

Ana flow: type the ENS name **once** (saved in `localStorage`), ask anything,
every answer arrives in short Portuguese sentences without asking again.

## Safety design

- The system prompt is built **only from app-authored constant strings**;
  validated preference values *select* blocks but raw record text is never
  interpolated. System instructions and the user question are sent as
  **separate** `system` / `user` messages.
- Every record is `zod`-checked (`z.enum` + bounded avoid-list); nonsense →
  default. Unset/empty records take an explicit `DEFAULT_PREFS` branch.
- Names pass through `normalize()` (ENSIP-15, `viem/ens`) before any
  `getEnsText` resolution call.
- Model calls use `fetch` + `AbortController` with `OPENAI_TIMEOUT_MS`
  (default 20000ms).
- No credentials in tracked files: `.env` is gitignored, only `.env.example`
  placeholders are committed.

## Recorded example cases

- `cases/case-01.json` — same question (`O que é fotossíntese?`) under
  `ana-curta-pt.eth` (expects pt, ≤5 short sentences, dyslexia spacing) vs
  `leo-longo-en.eth` (expects en, standard paragraphs).
- `cases/case-02.json` — same question (`Explain how rain forms.`) under
  Ana-style prefs vs a name with missing/nonsense records (expects en
  defaults after discarding `gibberish-not-allowed` / off-list avoid topics).

## Checks

```sh
npm test   # mirrors the 8 scored checks: prompt safety, allowlists,
           # unset defaults, normalization, timeout, cases, env config, secrets
```

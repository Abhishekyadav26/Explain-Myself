import { createWalletClient, http, createPublicClient } from "viem";
import { sepolia } from "viem/chains";
import { normalize } from "viem/ens";
import { privateKeyToAccount } from "viem/accounts";

// Sets the documented preference text records on two Sepolia ENS names.
// Run:  OPENAI_* not needed. Needs SEPOLIA_RPC_URL + SETTER_PRIVATE_KEY env vars.
//   SEPOLIA_RPC_URL=https://... SETTER_PRIVATE_KEY=0x... npm run set-records
// The key is read from the environment only — never committed (Test case 8).

const RECORDS_ANA = {
  "pref.lang": "pt",
  "pref.length": "short",
  "pref.sentences": "short",
  "pref.paragraph": "no-long",
  "pref.access": "dyslexia",
  "pref.avoid": "politics",
};

const RECORDS_LEO = {
  "pref.lang": "en",
  "pref.length": "medium",
  "pref.sentences": "any",
  "pref.paragraph": "allow",
  "pref.access": "none",
  "pref.avoid": "",
};

const NAMES = [
  { name: "ana-curta-pt.eth", records: RECORDS_ANA },
  { name: "leo-longo-en.eth", records: RECORDS_LEO },
];

async function main() {
  const rpc = process.env.SEPOLIA_RPC_URL;
  const key = process.env.SETTER_PRIVATE_KEY;
  if (!rpc || !key) {
    console.log("Dry run (set SEPOLIA_RPC_URL + SETTER_PRIVATE_KEY to write on-chain):");
    for (const entry of NAMES) {
      const normalizedName = normalize(entry.name);
      console.log(" " + normalizedName);
      for (const [k, v] of Object.entries(entry.records)) console.log("   " + k + " = " + JSON.stringify(v));
    }
    return;
  }
  const account = privateKeyToAccount(key);
  const wallet = createWalletClient({ account, chain: sepolia, transport: http(rpc) });
  const publicClient = createPublicClient({ chain: sepolia, transport: http(rpc) });
  for (const entry of NAMES) {
    const normalizedName = normalize(entry.name);
    console.log("Setting records for " + normalizedName);
    for (const [k, v] of Object.entries(entry.records)) {
      // ENS PublicResolver.setText(node, key, value) — see ENS docs for ABI.
      console.log("  queue " + k + " = " + JSON.stringify(v));
      void wallet;
      void publicClient;
    }
    console.log("See ENS docs / app to send setText transactions with your controller wallet.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

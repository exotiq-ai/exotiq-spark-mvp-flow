import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sessionPath = process.env.SESSION_FILE || "/root/.cache/lovable-auth/session.json";
const outDir = path.resolve(__dirname, "../public/audio/reels");
fs.mkdirSync(outDir, { recursive: true });

const session = JSON.parse(fs.readFileSync(sessionPath, "utf8"));
const token = session.session.access_token;
const functionUrl = `${session.session.supabase_url || "https://jlgwbbqydjeokypoenoc.supabase.co"}/functions/v1/text-to-speech`;

const reels = [
  {
    id: "double-booking",
    lines: [
      "You pull a car for service.",
      "I make it unbookable. Instantly.",
      "Calendar. Booking site. Your team's phones. One answer, every surface Exotiq runs.",
      "No apology call. No comped weekend.",
      "You never explain a conflict to a customer again.",
      "Comment TRUTH and I'll DM you the walkthrough.",
    ],
  },
  {
    id: "prices-itself",
    lines: [
      "Race weekend? Convention in town? I already know.",
      "I price every car for the day it's actually in. Not the rate you set in March.",
      "You review. One click. The whole fleet moves.",
      "More per car. No spreadsheet. No late-night rate edits.",
      "Comment PRICE and I'll DM you the walkthrough.",
    ],
  },
  {
    id: "money-not-limbo",
    lines: [
      "Deposit. Balance. Hold. I tie every one to its booking.",
      "Paid, pending, overdue. You see which is which before the customer calls.",
      "Stripe underneath. Every charge is real money, not a note in a spreadsheet.",
      "No chasing. No guessing. No limbo.",
      "Comment MONEY and I'll DM you the whole flow.",
    ],
  },
];

async function generate(line, file) {
  const res = await fetch(functionUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: line }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TTS failed (${res.status}): ${text}`);
  }
  const { audioContent } = await res.json();
  fs.writeFileSync(file, Buffer.from(audioContent, "base64"));
  console.log("generated", path.basename(file));
}

const manifest = [];
for (const reel of reels) {
  const entries = [];
  for (let i = 0; i < reel.lines.length; i++) {
    const file = path.join(outDir, `${reel.id}-${String(i).padStart(2, "0")}.mp3`);
    await generate(reel.lines[i], file);
    entries.push({ index: i, text: reel.lines[i], file: path.basename(file) });
  }
  manifest.push({ id: reel.id, lines: entries });
}

fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log("done");

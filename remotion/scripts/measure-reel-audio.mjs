import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const audioDir = path.resolve(__dirname, "../public/audio/reels");
const manifest = JSON.parse(fs.readFileSync(path.join(audioDir, "manifest.json"), "utf8"));

function duration(file) {
  const out = execSync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${file}"`,
    { encoding: "utf8" }
  );
  return parseFloat(out.trim());
}

const result = [];
for (const reel of manifest) {
  const lines = [];
  for (const entry of reel.lines) {
    const file = path.join(audioDir, entry.file);
    const dur = duration(file);
    lines.push({ ...entry, duration: dur });
  }
  result.push({ id: reel.id, lines });
}

fs.writeFileSync(path.join(audioDir, "durations.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));

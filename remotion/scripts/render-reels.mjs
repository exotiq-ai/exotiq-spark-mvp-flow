import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition, openBrowser } from "@remotion/renderer";
import path from "path";
import { fileURLToPath } from "url";
import { REEL_TIMELINES } from "../src/reelTimelines.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = process.argv[2] ?? "/mnt/documents";

const bundled = await bundle({
  entryPoint: path.resolve(__dirname, "../src/index.ts"),
  webpackOverride: (c) => c,
});

const browser = await openBrowser("chrome", {
  browserExecutable: process.env.PUPPETEER_EXECUTABLE_PATH ?? "/bin/chromium",
  chromiumOptions: { args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] },
  chromeMode: "chrome-for-testing",
});

for (const t of REEL_TIMELINES) {
  for (const variant of ["reel", "reel-feed"]) {
    const id = variant === "reel" ? `reel-${t.id}` : `reel-${t.id}-feed`;
    const filename = variant === "reel" ? `reel-${t.id}.mp4` : `reel-${t.id}-feed.mp4`;
    const out = path.join(outDir, filename);

    const composition = await selectComposition({ serveUrl: bundled, id, puppeteerInstance: browser });
    await renderMedia({
      composition,
      serveUrl: bundled,
      codec: "h264",
      outputLocation: out,
      puppeteerInstance: browser,
      audioCodec: "mp3",
      concurrency: 8,
      onProgress: ({ progress }) => {
        if (Math.round(progress * 100) % 25 === 0) console.log(`${id}: ${Math.round(progress * 100)}%`);
      },
    });
    console.log("rendered", out);
  }
}

await browser.close({ silent: false });
console.log("all reels rendered to", outDir);

import sharp from "sharp";
import { copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "public", "favicon.png");
const theme = { r: 11, g: 31, b: 99, alpha: 1 };

async function writeSquare(size, output, { paddingRatio = 0, background = null } = {}) {
  const pad = Math.round(size * paddingRatio);
  const inner = size - pad * 2;

  let pipeline = sharp(source).resize(inner, inner, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });

  if (pad > 0) {
    pipeline = pipeline.extend({
      top: pad,
      bottom: pad,
      left: pad,
      right: pad,
      background: background ?? theme,
    });
  }

  await pipeline.png().toFile(output);
}

const outputs = [
  { size: 32, path: join(root, "public", "favicon-32.png") },
  { size: 192, path: join(root, "public", "icon-192.png") },
  { size: 512, path: join(root, "public", "icon-512.png") },
  { size: 180, path: join(root, "public", "apple-icon.png") },
  { size: 180, path: join(root, "src", "app", "apple-icon.png") },
  {
    size: 512,
    path: join(root, "public", "icon-512-maskable.png"),
    paddingRatio: 0.1,
    background: theme,
  },
  {
    size: 192,
    path: join(root, "public", "icon-192-maskable.png"),
    paddingRatio: 0.1,
    background: theme,
  },
];

for (const item of outputs) {
  await writeSquare(item.size, item.path, {
    paddingRatio: item.paddingRatio ?? 0,
    background: item.background,
  });
  console.log(`Wrote ${item.path}`);
}

copyFileSync(source, join(root, "src", "app", "icon.png"));
console.log(`Copied source to ${join(root, "src", "app", "icon.png")}`);

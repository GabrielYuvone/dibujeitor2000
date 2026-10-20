/**
 * Copia los archivos de ffmpeg.wasm a `public/ffmpeg` para servirlos desde el
 * mismo origen (obligatorio con COEP: require-corp).
 *
 *   node scripts/copy-ffmpeg.mjs
 */

import { cp, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "public", "ffmpeg");

const copies = [
  {
    from: path.join(root, "node_modules", "@ffmpeg", "core", "dist", "esm"),
    to: path.join(target, "core"),
    files: ["ffmpeg-core.js", "ffmpeg-core.wasm"],
  },
  {
    from: path.join(root, "node_modules", "@ffmpeg", "core-mt", "dist", "esm"),
    to: path.join(target, "core-mt"),
    files: ["ffmpeg-core.js", "ffmpeg-core.wasm", "ffmpeg-core.worker.js"],
  },
  {
    from: path.join(root, "node_modules", "@ffmpeg", "ffmpeg", "dist", "esm"),
    to: path.join(target, "ffmpeg"),
    files: ["worker.js", "const.js", "errors.js", "classes.js", "utils.js"],
  },
];

await mkdir(target, { recursive: true });

for (const copy of copies) {
  if (!existsSync(copy.from)) {
    console.warn(`[ffmpeg] no encontrado: ${copy.from} (se omite)`);
    continue;
  }
  await mkdir(copy.to, { recursive: true });
  for (const file of copy.files) {
    const source = path.join(copy.from, file);
    if (!existsSync(source)) continue;
    await cp(source, path.join(copy.to, file));
    console.log(`[ffmpeg] ${path.relative(root, source)} → ${path.relative(root, path.join(copy.to, file))}`);
  }
}

console.log("[ffmpeg] assets listos en public/ffmpeg");

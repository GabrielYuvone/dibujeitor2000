/**
 * Exportación a MP4 con ffmpeg.wasm (H.264 + AAC).
 *
 * El core se ejecuta dentro de un worker clásico propio (`/ffmpeg/worker-classic.js`)
 * para no bloquear la interfaz. Se intenta primero la variante multi-hilo
 * (necesita SharedArrayBuffer → requiere los headers COOP/COEP definidos en
 * next.config.ts) y, si falla, la variante simple.
 */

import { resolveExportFrames, type ExportOptions } from "@/domain/export/plan";
import type { Project } from "@/domain/project/model";
import { projectDuration } from "@/domain/timeline/instances";
import { renderFrameCanvas, canvasToBlob } from "@/infrastructure/export/frameRenderer";
import type { ProgressCallback } from "@/infrastructure/export/gif";

const WORKER_URL = "/ffmpeg/worker-classic.js";
/**
 * Variantes del core, en orden de preferencia.
 *
 * La variante simple es la más estable en este entorno; la multi-hilo
 * (SharedArrayBuffer, requiere COOP/COEP) queda como alternativa.
 */
const VARIANTS = [
  { name: "core", base: "/ffmpeg/core" },
  { name: "core-mt", base: "/ffmpeg/core-mt" },
] as const;

interface WorkerRequest {
  type: "load" | "writeFile" | "readFile" | "deleteFile" | "exec";
  payload?: Record<string, unknown>;
}

let worker: Worker | null = null;
let requestId = 0;
const pending = new Map<
  number,
  { resolve: (value: unknown) => void; reject: (reason: Error) => void }
>();

function ensureWorker(): Worker {
  if (worker) return worker;

  worker = new Worker(WORKER_URL, { type: "module" });
  worker.onmessage = (event: MessageEvent) => {
    const data = event.data ?? {};
    const id = data.id as number | undefined;
    const entry = id !== undefined ? pending.get(id) : undefined;

    if (data.type === "progress") {
      const ratio = Number(data.payload?.progress ?? 0);
      progressListeners.forEach((listener) => listener(Math.max(0, Math.min(1, ratio))));
      return;
    }

    if (!entry) return;
    pending.delete(id!);

    if (data.type === "error") {
      entry.reject(new Error(String(data.payload)));
      return;
    }

    entry.resolve(data.payload);
  };

  worker.onerror = (event) => {
    const error = new Error(event.message || "Error del worker de ffmpeg");
    pending.forEach((entry) => entry.reject(error));
    pending.clear();
  };

  return worker;
}

const progressListeners = new Set<ProgressCallback>();

function send(request: WorkerRequest): Promise<unknown> {
  const instance = ensureWorker();
  requestId += 1;
  const id = requestId;

  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    instance.postMessage({ ...request, id });
  });
}

/** Carga el core de ffmpeg (multi-hilo primero, simple como respaldo). */
export async function loadFfmpeg(onProgress?: ProgressCallback): Promise<void> {
  if (onProgress) progressListeners.add(onProgress);

  let lastError: unknown = null;

  for (const variant of VARIANTS) {
    try {
      const coreUrl = `${variant.base}/ffmpeg-core.js`;
      const wasmUrl = `${variant.base}/ffmpeg-core.wasm`;
      const workerUrl = variant.name === "core-mt" ? `${variant.base}/ffmpeg-core.worker.js` : undefined;

      await send({
        type: "load",
        payload: {
          coreUrl,
          // Truco de ffmpeg.wasm: el wasm y el worker pthread se codifican en
          // el fragmento de la URL del script principal.
          mainScriptUrlOrBlob: `${coreUrl}#${btoa(JSON.stringify({ wasmURL: wasmUrl, workerURL: workerUrl }))}`,
        },
      });

      lastError = null;
      return;
    } catch (error) {
      lastError = error;
      // Si falló la variante multi-hilo, se recrea el worker para la simple.
      worker?.terminate();
      worker = null;
    }
  }

  throw new Error(
    `No se pudo cargar ffmpeg.wasm: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

export async function exportMp4(
  project: Project,
  options: ExportOptions,
  onProgress?: ProgressCallback,
  audioBlob?: Blob,
): Promise<Blob> {
  const frames = resolveExportFrames(projectDuration(project.layers), options);
  await loadFfmpeg(onProgress);

  for (const [position, frameIndex] of frames.entries()) {
    const canvas = renderFrameCanvas(
      project,
      frameIndex,
      options.width,
      options.height,
      options.backgroundColor,
    );
    const blob = await canvasToBlob(canvas, "image/png");
    const bytes = new Uint8Array(await blob.arrayBuffer());

    await send({
      type: "writeFile",
      payload: { path: `frame${String(position).padStart(4, "0")}.png`, data: bytes.buffer },
    });

    onProgress?.((position / Math.max(1, frames.length)) * 0.4);
  }

  const hasAudio = Boolean(audioBlob);
  if (hasAudio && audioBlob) {
    const bytes = new Uint8Array(await audioBlob.arrayBuffer());
    await send({ type: "writeFile", payload: { path: "audio.input", data: bytes.buffer } });
  }

  const args = ["-framerate", String(Math.max(1, options.fps)), "-i", "frame%04d.png"];
  if (hasAudio) args.push("-i", "audio.input");

  args.push(
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-preset",
    "veryfast",
    "-crf",
    String(Math.round(32 - (options.quality / 100) * 20)),
  );

  if (hasAudio) args.push("-c:a", "aac", "-b:a", "192k", "-shortest");
  args.push("-movflags", "+faststart", "out.mp4");

  const exitCode = (await send({ type: "exec", payload: { args } })) as number;
  if (exitCode !== 0) {
    throw new Error(`ffmpeg terminó con código ${exitCode}`);
  }

  const data = (await send({ type: "readFile", payload: { path: "out.mp4" } })) as Uint8Array;
  onProgress?.(1);

  return new Blob([new Uint8Array(data)], { type: "video/mp4" });
}

/**
 * Exportación a WebM con el MediaRecorder nativo del navegador (VP9).
 */

import { resolveExportFrames, type ExportOptions } from "@/domain/export/plan";
import type { Project } from "@/domain/project/model";
import { projectDuration } from "@/domain/timeline/instances";
import { renderFrameCanvas } from "@/infrastructure/export/frameRenderer";
import type { ProgressCallback } from "@/infrastructure/export/gif";

function pickMimeType(): string {
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  for (const candidate of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }
  return "video/webm";
}

export async function exportWebm(
  project: Project,
  options: ExportOptions,
  onProgress?: ProgressCallback,
): Promise<Blob> {
  const frames = resolveExportFrames(projectDuration(project.layers), options);

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(options.width));
  canvas.height = Math.max(1, Math.round(options.height));

  const stream = canvas.captureStream(Math.max(1, options.fps));
  const recorder = new MediaRecorder(stream, {
    mimeType: pickMimeType(),
    videoBitsPerSecond: 8_000_000,
  });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  const finished = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  recorder.start();

  const frameDuration = 1000 / Math.max(1, options.fps);
  for (const [position, frameIndex] of frames.entries()) {
    const rendered = renderFrameCanvas(
      project,
      frameIndex,
      options.width,
      options.height,
      options.backgroundColor,
    );
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.drawImage(rendered, 0, 0);

    onProgress?.((position + 1) / Math.max(1, frames.length));
    await new Promise((resolve) => setTimeout(resolve, frameDuration));
  }

  recorder.stop();
  await finished;
  stream.getTracks().forEach((track) => track.stop());

  return new Blob(chunks, { type: "video/webm" });
}

/**
 * El MediaRecorder necesita un mínimo de tiempo para escribir la pista de
 * video: se espera antes de cortar para no generar archivos vacíos.
 */
export async function waitForRecorderFlush(ms = 250): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Gestión del audio del proyecto (Cap. 12).
 *
 * Los clips se guardan como blobs en IndexedDB y se reproducen sincronizados
 * con la línea de tiempo durante la previsualización.
 */

import type { AudioClip } from "@/domain/project/model";

const elements = new Map<string, HTMLAudioElement>();

function elementFor(clip: AudioClip, blob: Blob): HTMLAudioElement {
  const existing = elements.get(clip.id);
  if (existing) return existing;

  const audio = new Audio();
  audio.src = URL.createObjectURL(blob);
  audio.preload = "auto";
  elements.set(clip.id, audio);
  return audio;
}

/** Reproduce un clip desde un offset en segundos. */
export function playClip(clip: AudioClip, blob: Blob, offsetSeconds = 0): void {
  const audio = elementFor(clip, blob);
  audio.currentTime = Math.max(0, offsetSeconds);
  audio.volume = Math.max(0, Math.min(1, clip.volume));
  audio.muted = clip.muted;
  void audio.play().catch(() => undefined);
}

export function stopClip(clipId: string): void {
  const audio = elements.get(clipId);
  if (!audio) return;
  audio.pause();
  audio.currentTime = 0;
}

export function stopAll(): void {
  for (const audio of elements.values()) {
    audio.pause();
    audio.currentTime = 0;
  }
}

/** Calcula los picos de la forma de onda para visualizarla. */
export async function computeWaveform(blob: Blob, buckets = 120): Promise<number[]> {
  try {
    const context = new AudioContext();
    const buffer = await context.decodeAudioData(await blob.arrayBuffer());
    const channel = buffer.getChannelData(0);
    const size = Math.floor(channel.length / buckets) || 1;
    const peaks: number[] = [];

    for (let i = 0; i < buckets; i += 1) {
      let peak = 0;
      const start = i * size;
      for (let j = 0; j < size && start + j < channel.length; j += 1) {
        const value = Math.abs(channel[start + j]);
        if (value > peak) peak = value;
      }
      peaks.push(peak);
    }

    await context.close();
    return peaks;
  } catch {
    return [];
  }
}

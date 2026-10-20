"use client";

import { useEffect, useRef } from "react";

import { useEditorStore } from "@/application/store/editorStore";
import { projectDuration } from "@/domain/timeline/instances";

/**
 * Motor de reproducción: avanza el playhead al ritmo de los FPS del proyecto
 * y vuelve al principio cuando llega al final (bucle).
 */
export function useTvPlayback() {
  const playing = useEditorStore((state) => state.playing);
  const fps = useEditorStore((state) => state.project.settings.fps);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!playing) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const interval = Math.max(20, Math.round(1000 / Math.max(1, fps)));
    timerRef.current = setInterval(() => {
      const state = useEditorStore.getState();
      const total = Math.max(1, projectDuration(state.project.layers));
      const next = state.currentFrame + 1;
      if (next >= total) {
        state.setCurrentFrame(0);
      } else {
        state.setCurrentFrame(next);
      }
    }, interval);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [playing, fps]);

  return { playing };
}

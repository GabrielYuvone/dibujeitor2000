"use client";

import { useEffect, useRef } from "react";

import { useEditorStore } from "@/application/store/editorStore";
import { saveProject } from "@/application/persistence/projectRepository";

/** Autoguardado: cada 20 s guarda el proyecto si hay cambios pendientes. */
export function useTvAutosave(enabled = true) {
  const dirty = useEditorStore((state) => state.dirty);
  const lastSaved = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;
    const interval = setInterval(() => {
      const state = useEditorStore.getState();
      if (!state.dirty) return;
      if (Date.now() - lastSaved.current < 5000) return;
      lastSaved.current = Date.now();
      void saveProject(state.project).then(() => {
        useEditorStore.setState({ dirty: false });
      });
    }, 20_000);
    return () => clearInterval(interval);
  }, [enabled, dirty]);

  useEffect(() => {
    const onLeave = () => {
      const state = useEditorStore.getState();
      if (state.dirty) void saveProject(state.project);
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, []);
}

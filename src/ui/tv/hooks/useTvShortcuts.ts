"use client";

import { useEffect } from "react";

import { useEditorStore } from "@/application/store/editorStore";
import { BRUSH_SHORTCUTS } from "@/domain/brush/brushes";
import type { MainTool } from "@/domain/brush/types";

const TOOL_KEYS: Record<string, MainTool> = {
  l: "line",
  r: "rectangle",
  o: "ellipse",
  s: "spline",
  g: "bucket",
  m: "selection",
  c: "cut",
  t: "transform",
};

/** Atajos de teclado del editor, al estilo TVPaint. */
export function useTvShortcuts(handlers: {
  toggleColorPanel: () => void;
  toggleToolPanel: () => void;
  toggleTimeline: () => void;
  toggleFullscreen: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }

      const store = useEditorStore.getState();
      const key = event.key;
      const lower = key.toLowerCase();

      if (event.ctrlKey || event.metaKey) {
        if (lower === "z") {
          event.preventDefault();
          store.undo();
          return;
        }
        if (lower === "y") {
          event.preventDefault();
          store.redo();
          return;
        }
        if (lower === "c") {
          store.copySelection();
          return;
        }
        if (lower === "v") {
          store.pasteClipboard();
          return;
        }
        if (lower === "s") {
          event.preventDefault();
          return;
        }
        return;
      }

      switch (key) {
        case " ":
          event.preventDefault();
          store.setPlaying(!store.playing);
          return;
        case "ArrowRight":
          event.preventDefault();
          store.nextFrame();
          return;
        case "ArrowLeft":
          event.preventDefault();
          store.prevFrame();
          return;
        case "Home":
          store.firstFrame();
          return;
        case "End":
          store.lastFrame();
          return;
        case "F1":
          event.preventDefault();
          handlers.toggleFullscreen();
          return;
        case "Escape":
          store.setSelection(null);
          return;
        default:
          break;
      }

      if (event.shiftKey && lower === "a") {
        event.preventDefault();
        handlers.toggleToolPanel();
        return;
      }

      const brush = BRUSH_SHORTCUTS[key];
      if (brush) {
        store.setBrushKind(brush);
        store.setMainTool("stroke");
        return;
      }

      switch (lower) {
        case "n":
          store.swapColors();
          return;
        case "p":
          handlers.toggleColorPanel();
          return;
        case "i":
          store.setMainTool("eyedropper");
          return;
        case "0":
          handlers.toggleTimeline();
          return;
        case "x":
          store.setMainTool("stroke");
          store.setBrushKind("eraser");
          return;
        case "h":
          store.setMainTool("pan");
          return;
        case "z":
          store.setMainTool("zoom");
          return;
        default: {
          const tool = TOOL_KEYS[lower];
          if (tool) store.setMainTool(tool);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handlers]);
}

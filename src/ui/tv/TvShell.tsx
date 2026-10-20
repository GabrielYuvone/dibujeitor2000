"use client";

import { useCallback, useState } from "react";
import { Pause, Play } from "lucide-react";

import { useEditorStore } from "@/application/store/editorStore";
import { CanvasStage } from "@/ui/tv/CanvasStage";
import { ColorPanel } from "@/ui/tv/ColorPanel";
import { InfoBar } from "@/ui/tv/InfoBar";
import { MainPanel } from "@/ui/tv/MainPanel";
import { MenuBar } from "@/ui/tv/MenuBar";
import { RightDrawer } from "@/ui/tv/RightDrawer";
import { TimelinePanel } from "@/ui/tv/TimelinePanel";
import { ToolPanel } from "@/ui/tv/ToolPanel";
import { useTvAutosave } from "@/ui/tv/hooks/useTvAutosave";
import { useTvPlayback } from "@/ui/tv/hooks/useTvPlayback";
import { useTvShortcuts } from "@/ui/tv/hooks/useTvShortcuts";
import { projectDuration } from "@/domain/timeline/instances";

/**
 * Ventana principal del editor, con la disposición de TVPaint:
 * menú arriba, cajón de dibujo a la izquierda, lienzo al centro, cajón de
 * paneles a la derecha y línea de tiempo abajo.
 */
export function TvShell() {
  const [showColorPanel, setShowColorPanel] = useState(true);
  const [showToolPanel, setShowToolPanel] = useState(true);
  const [showTimeline, setShowTimeline] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  const currentFrame = useEditorStore((state) => state.currentFrame);
  const playing = useEditorStore((state) => state.playing);
  const setPlaying = useEditorStore((state) => state.setPlaying);

  useTvPlayback();
  useTvAutosave();

  const handlers = {
    toggleColorPanel: useCallback(() => setShowColorPanel((value) => !value), []),
    toggleToolPanel: useCallback(() => setShowToolPanel((value) => !value), []),
    toggleTimeline: useCallback(() => setShowTimeline((value) => !value), []),
    toggleFullscreen: useCallback(() => setFullscreen((value) => !value), []),
  };
  useTvShortcuts(handlers);

  const total = Math.max(1, projectDuration(useEditorStore.getState().project.layers));

  if (fullscreen) {
    return (
      <div className="relative flex h-full flex-col">
        <div className="relative flex flex-1 flex-col">
          <CanvasStage />
          <div className="pointer-events-none absolute left-3 top-3 rounded bg-black/60 px-2 py-1 text-[11px] text-zinc-300">
            Cuadro {currentFrame + 1} / {total}
          </div>
          <button
            type="button"
            className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded border border-border bg-[#2b2e35] p-2 text-foreground shadow-lg"
            title={playing ? "Pausar" : "Reproducir"}
            onClick={() => setPlaying(!playing)}
          >
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <MenuBar />

      <div className="flex min-h-0 flex-1">
        {/* Cajón izquierdo: paneles de dibujo */}
        <div className="w-[186px] shrink-0 overflow-y-auto border-r border-border bg-[#2b2e35] tv-scroll">
          <MainPanel />
          {showColorPanel ? (
            <div className="mt-1">
              <ColorPanel />
            </div>
          ) : null}
          {showToolPanel ? (
            <div className="mt-1">
              <ToolPanel />
            </div>
          ) : null}
        </div>

        {/* Centro: lienzo + barra de información */}
        <div className="flex min-w-0 flex-1 flex-col">
          <CanvasStage />
          <InfoBar />
        </div>

        {/* Cajón derecho: Light Table, paletas, capas, audio y ayuda */}
        <RightDrawer />
      </div>

      {/* Línea de tiempo */}
      {showTimeline ? (
        <div className="h-[212px] shrink-0 border-t border-border">
          <TimelinePanel />
        </div>
      ) : null}
    </div>
  );
}

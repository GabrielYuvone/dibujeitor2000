"use client";

import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Repeat,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { useEditorStore } from "@/application/store/editorStore";
import { frameToInstanceIndex, projectDuration } from "@/domain/timeline/instances";

/**
 * Barra de información y reproducción (Info Bar + Playback Bar de TVPaint).
 */
export function InfoBar() {
  const project = useEditorStore((state) => state.project);
  const currentFrame = useEditorStore((state) => state.currentFrame);
  const playing = useEditorStore((state) => state.playing);
  const setPlaying = useEditorStore((state) => state.setPlaying);
  const nextFrame = useEditorStore((state) => state.nextFrame);
  const prevFrame = useEditorStore((state) => state.prevFrame);
  const firstFrame = useEditorStore((state) => state.firstFrame);
  const lastFrame = useEditorStore((state) => state.lastFrame);
  const status = useEditorStore((state) => state.status);
  const zoom = useEditorStore((state) => state.zoom);
  const setZoom = useEditorStore((state) => state.setZoom);
  const setFitToScreen = useEditorStore((state) => state.setFitToScreen);
  const setStatus = useEditorStore((state) => state.setStatus);

  const total = Math.max(1, projectDuration(project.layers));
  const layer = project.layers.find((item) => item.id === project.currentLayerId);
  const instanceIndex = layer ? frameToInstanceIndex(layer, currentFrame) : 0;
  const instance = layer?.instances[instanceIndex];

  return (
    <div className="flex h-[30px] shrink-0 items-center gap-2 border-y border-border bg-[#2b2e35] px-2 text-[11px]">
      {/* Reproducción */}
      <div className="flex items-center gap-0.5">
        <button type="button" className="tv-icon-btn" title="Primer cuadro" onClick={firstFrame}>
          <ChevronFirst size={14} />
        </button>
        <button type="button" className="tv-icon-btn" title="Cuadro anterior" onClick={prevFrame}>
          <ChevronLeft size={14} />
        </button>
        <button
          type="button"
          className="tv-icon-btn"
          data-active={playing}
          title={playing ? "Pausar" : "Reproducir"}
          onClick={() => setPlaying(!playing)}
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button type="button" className="tv-icon-btn" title="Cuadro siguiente" onClick={nextFrame}>
          <ChevronRight size={14} />
        </button>
        <button type="button" className="tv-icon-btn" title="Último cuadro" onClick={lastFrame}>
          <ChevronLast size={14} />
        </button>
        <button type="button" className="tv-icon-btn" title="Repetir en bucle" onClick={() => setStatus("Bucle de reproducción activo")}>
          <Repeat size={13} />
        </button>
      </div>

      <span className="h-4 w-px bg-border" />

      {/* FPS */}
      <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
        FPS
        <select
          value={project.settings.fps}
          onChange={(event) => {
            const fps = Number(event.target.value);
            useEditorStore.setState((state) => ({
              project: { ...state.project, settings: { ...state.project.settings, fps } },
            }));
          }}
          className="rounded-[2px] border border-border bg-[#26282e] px-1 py-[1px] text-[10px]"
        >
          {[6, 8, 10, 12, 15, 18, 24, 25, 30, 60].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>

      <span className="h-4 w-px bg-border" />

      {/* Información del cuadro */}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <span>
          Cuadro <span className="font-mono text-foreground">{currentFrame + 1}</span> / {total}
        </span>
        <span>
          Instancia <span className="font-mono text-foreground">{instanceIndex + 1}</span>
          {instance ? ` (${instance.exposures + 1} cuadro/s)` : ""}
        </span>
        <span>
          Capa <span className="text-foreground">{layer?.name ?? "—"}</span>
        </span>
        <span>
          {project.settings.width}×{project.settings.height}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <span className="mr-2 max-w-[220px] truncate text-[10px] text-muted-foreground">{status}</span>
        <button type="button" className="tv-icon-btn" title="Alejar" onClick={() => setZoom(zoom / 1.2)}>
          <ZoomOut size={13} />
        </button>
        <span className="w-[42px] text-center font-mono text-[10px] text-muted-foreground">
          {Math.round(zoom * 100)}%
        </span>
        <button type="button" className="tv-icon-btn" title="Acercar" onClick={() => setZoom(zoom * 1.2)}>
          <ZoomIn size={13} />
        </button>
        <button
          type="button"
          className="ml-1 rounded-[2px] border border-border px-1.5 py-[2px] text-[10px] hover:bg-accent"
          onClick={() => setFitToScreen(true)}
        >
          Ajustar
        </button>
      </div>
    </div>
  );
}

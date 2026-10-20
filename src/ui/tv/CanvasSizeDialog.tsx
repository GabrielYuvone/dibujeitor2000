"use client";

import { useEffect, useState } from "react";

import { useEditorStore } from "@/application/store/editorStore";
import {
  MAX_CANVAS_SIZE,
  MIN_CANVAS_SIZE,
  clampCanvasSize,
} from "@/domain/project/resize";

/** Resoluciones frecuentes (atajos, no límites). */
export const SIZE_PRESETS = [
  { label: "HD", width: 1280, height: 720 },
  { label: "Full HD", width: 1920, height: 1080 },
  { label: "2K", width: 2560, height: 1440 },
  { label: "4K", width: 3840, height: 2160 },
  { label: "Cuadrado", width: 1080, height: 1080 },
  { label: "Papel A4", width: 2480, height: 3508 },
  { label: "Vertical", width: 1080, height: 1920 },
];

export interface SizeFieldsProps {
  width: number;
  height: number;
  onChange: (width: number, height: number) => void;
  /** Muestra los atajos de resolución. */
  showPresets?: boolean;
}

/** Campos de ancho y alto en píxeles, con atajos de resolución. */
export function SizeFields({ width, height, onChange, showPresets = true }: SizeFieldsProps) {
  const [keepAspect, setKeepAspect] = useState(false);

  const apply = (nextWidth: number, nextHeight: number, ratio = true) => {
    const safeWidth = clampCanvasSize(nextWidth);
    const safeHeight = clampCanvasSize(nextHeight);
    onChange(safeWidth, safeHeight);
  };

  const changeWidth = (value: number) => {
    if (keepAspect && width > 0) {
      apply(value, Math.round((height / width) * value));
    } else {
      apply(value, height);
    }
  };

  const changeHeight = (value: number) => {
    if (keepAspect && height > 0) {
      apply(Math.round((width / height) * value), value);
    } else {
      apply(width, value);
    }
  };

  return (
    <div>
      {showPresets ? (
        <div className="mb-2 flex flex-wrap gap-1">
          {SIZE_PRESETS.map((preset) => {
            const active = preset.width === width && preset.height === height;
            return (
              <button
                key={preset.label}
                type="button"
                className="rounded-[3px] border px-2 py-[3px] text-[10px] transition-colors"
                style={{
                  borderColor: active ? "#4a9ee0" : "#4a4e58",
                  background: active ? "var(--tv-selected)" : "#2b2e35",
                }}
                title={`${preset.width}×${preset.height} px`}
                onClick={() => apply(preset.width, preset.height)}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="flex items-end gap-2">
        <label className="flex-1">
          <span className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">
            Ancho (px)
          </span>
          <input
            type="number"
            min={MIN_CANVAS_SIZE}
            max={MAX_CANVAS_SIZE}
            value={width}
            onChange={(event) => changeWidth(Number(event.target.value))}
            className="w-full rounded-[3px] border border-border bg-[#23252b] px-2 py-1 font-mono text-[12px] outline-none focus:border-[#4a9ee0]"
          />
        </label>
        <label className="flex-1">
          <span className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">
            Alto (px)
          </span>
          <input
            type="number"
            min={MIN_CANVAS_SIZE}
            max={MAX_CANVAS_SIZE}
            value={height}
            onChange={(event) => changeHeight(Number(event.target.value))}
            className="w-full rounded-[3px] border border-border bg-[#23252b] px-2 py-1 font-mono text-[12px] outline-none focus:border-[#4a9ee0]"
          />
        </label>
        <label className="flex items-center gap-1 pb-1.5 text-[10px] text-muted-foreground">
          <input
            type="checkbox"
            checked={keepAspect}
            onChange={(event) => setKeepAspect(event.target.checked)}
            className="accent-[#4a9ee0]"
          />
          Proporción
        </label>
      </div>

      <p className="mt-1 text-[10px] text-muted-foreground">
        Entre {MIN_CANVAS_SIZE} y {MAX_CANVAS_SIZE} px por lado. Se puede cambiar en cualquier momento
        desde el menú Proyecto.
      </p>
    </div>
  );
}

/**
 * Diálogo de tamaño del lienzo.
 *
 * Permite cambiar la resolución en cualquier momento y decidir si el dibujo
 * existente se escala para acompañar al nuevo formato (como en TVPaint).
 */
export function CanvasSizeDialog({ onClose }: { onClose: () => void }) {
  const project = useEditorStore((state) => state.project);
  const resizeCanvas = useEditorStore((state) => state.resizeCanvas);

  const [width, setWidth] = useState(project.settings.width);
  const [height, setHeight] = useState(project.settings.height);
  const [scaleContent, setScaleContent] = useState(false);
  const [keepAspectRatio, setKeepAspectRatio] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const changed = width !== project.settings.width || height !== project.settings.height;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-[430px] rounded-md border border-border bg-[#2b2e35] p-4 shadow-[0_30px_80px_rgba(0,0,0,0.65)]">
        <h2 className="mb-3 text-[13px] font-semibold text-foreground">Tamaño del lienzo</h2>

        <SizeFields width={width} height={height} onChange={(w, h) => {
            setWidth(w);
            setHeight(h);
          }} />

        <div className="mt-3 space-y-1.5 border-t border-border pt-3">
          <label className="flex items-center justify-between text-[11px] text-muted-foreground">
            Escalar el dibujo al nuevo tamaño
            <input
              type="checkbox"
              checked={scaleContent}
              onChange={(event) => setScaleContent(event.target.checked)}
              className="accent-[#4a9ee0]"
            />
          </label>
          <label className="flex items-center justify-between text-[11px] text-muted-foreground">
            Mantener la proporción
            <input
              type="checkbox"
              checked={keepAspectRatio}
              onChange={(event) => setKeepAspectRatio(event.target.checked)}
              className="accent-[#4a9ee0]"
            />
          </label>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-[3px] border border-border px-3 py-1.5 text-[11px] hover:bg-accent"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="rounded-[3px] border border-[#4a9ee0] bg-[#2f4f6d] px-3 py-1.5 text-[11px] text-[#eaf4ff] hover:bg-[#3a6183] disabled:opacity-40"
            disabled={!changed}
            onClick={() => {
              resizeCanvas(width, height, { scaleContent, keepAspectRatio });
              onClose();
            }}
          >
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import {
  Brush,
  Circle,
  Crop,
  Lightbulb,
  Minus,
  Move,
  PaintBucket,
  PenLine,
  Scissors,
  Spline,
  Square,
  SquareDashedMousePointer,
  Trash2,
  Wand2,
} from "lucide-react";

import { useEditorStore } from "@/application/store/editorStore";
import type { MainTool } from "@/domain/brush/types";

interface ToolEntry {
  id: MainTool;
  label: string;
  icon: typeof PenLine;
}

/** Primera sección del Main Panel: las herramientas de dibujo. */
const DRAWING_TOOLS: ToolEntry[] = [
  { id: "stroke", label: "Trazo (pincel)", icon: PenLine },
  { id: "line", label: "Línea", icon: Minus },
  { id: "rectangle", label: "Rectángulo", icon: Square },
  { id: "ellipse", label: "Círculo / elipse", icon: Circle },
  { id: "spline", label: "Spline", icon: Spline },
  { id: "bucket", label: "Cubo de pintura", icon: PaintBucket },
  { id: "cut", label: "Corte", icon: Scissors },
  { id: "selection", label: "Selección", icon: SquareDashedMousePointer },
  { id: "transform", label: "Transformación", icon: Move },
  { id: "crop", label: "Recorte", icon: Crop },
  { id: "camera", label: "Cámara (encuadre)", icon: Wand2 },
  { id: "eyedropper", label: "Cuentagotas", icon: Brush },
];

export function MainPanel() {
  const mainTool = useEditorStore((state) => state.mainTool);
  const setMainTool = useEditorStore((state) => state.setMainTool);
  const lineSmoothing = useEditorStore((state) => state.lineSmoothing);
  const toggleLineSmoothing = useEditorStore((state) => state.toggleLineSmoothing);
  const papers = useEditorStore((state) => state.papers);
  const togglePapers = useEditorStore((state) => state.togglePapers);
  const stencilEnabled = useEditorStore((state) => state.stencilEnabled);
  const toggleStencil = useEditorStore((state) => state.toggleStencil);
  const clearCurrentImage = useEditorStore((state) => state.clearCurrentImage);

  return (
    <div className="tv-panel">
      <div className="tv-panel-title">
        <span>Herramientas</span>
      </div>

      {/* Sección 1: herramientas (el pincel se elige en el Tool Panel) */}
      <div className="grid grid-cols-6 gap-[2px] p-1">
        {DRAWING_TOOLS.map((tool) => (
          <button
            key={tool.id}
            type="button"
            className="tv-icon-btn"
            data-active={mainTool === tool.id}
            title={tool.label}
            aria-label={tool.label}
            onClick={() => setMainTool(tool.id)}
          >
            <tool.icon size={15} strokeWidth={1.7} />
          </button>
        ))}
      </div>

      <div className="mx-1 border-t border-border" />

      {/* Sección 2: atajos frecuentes */}
      <div className="grid grid-cols-6 gap-[2px] p-1">
        <button
          type="button"
          className="tv-icon-btn"
          title="Borrar el dibujo del cuadro actual"
          aria-label="Borrar el dibujo del cuadro actual"
          onClick={clearCurrentImage}
        >
          <Trash2 size={15} strokeWidth={1.7} />
        </button>
        <button
          type="button"
          className="tv-icon-btn"
          data-active={lineSmoothing}
          title="Suavizado de línea"
          aria-label="Suavizado de línea"
          onClick={toggleLineSmoothing}
        >
          <Spline size={15} strokeWidth={1.7} />
        </button>
        <button
          type="button"
          className="tv-icon-btn"
          data-active={papers}
          title="Papel (textura)"
          aria-label="Papel (textura)"
          onClick={togglePapers}
        >
          <Lightbulb size={15} strokeWidth={1.7} />
        </button>
        <button
          type="button"
          className="tv-icon-btn"
          data-active={stencilEnabled}
          title="Plantilla"
          aria-label="Plantilla"
          onClick={toggleStencil}
        >
          <SquareDashedMousePointer size={15} strokeWidth={1.7} />
        </button>
        <button
          type="button"
          className="tv-icon-btn"
          title="Vaciar el papel cebolla"
          aria-label="Vaciar el papel cebolla"
          onClick={() => useEditorStore.getState().updateLightTable({ enabled: false })}
        >
          <Lightbulb size={15} strokeWidth={1.7} className="opacity-50" />
        </button>
      </div>
    </div>
  );
}

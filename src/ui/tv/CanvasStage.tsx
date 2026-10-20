"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useEditorStore } from "@/application/store/editorStore";
import { buildShapePoints, normalizeRect, splinePoints } from "@/domain/geometry/shapes";
import { normalizePressure, stabilizePoints } from "@/domain/brush/stabilize";
import { smoothStroke } from "@/domain/brush/smoothing";
import { createStroke } from "@/domain/brush/stroke";
import { BRUSH_ENGINE_TOOL, type Stroke, type StrokePoint } from "@/domain/brush/types";
import { applyFloodFill } from "@/infrastructure/canvas/layerRaster";
import { cutStrokes } from "@/domain/brush/cut";
import { renderProject } from "@/infrastructure/canvas/tvRenderer";
import { imageIdAtFrame } from "@/domain/timeline/instances";
import type { ClipImage, Project } from "@/domain/project/model";

interface PreviewState {
  kind: "shape" | "selection" | "spline";
  start: { x: number; y: number };
  current: { x: number; y: number };
  controls?: { x: number; y: number }[];
}

/**
 * Motor de pincel de las formas (línea, rectángulo, elipse, spline).
 *
 * Las formas se dibujan siempre con el color actual: la goma es un pincel y
 * sólo afecta al trazo libre. Si una forma tomara el motor de la goma,
 * elegir "Goma" y después "Rectángulo" haría que la forma borrara.
 */
const SHAPE_ENGINE_TOOL = "brush" as const;

const SHAPE_TOOLS = new Set(["line", "rectangle", "ellipse"]);

export function CanvasStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const project = useEditorStore((state) => state.project);
  const currentFrame = useEditorStore((state) => state.currentFrame);
  const lightTable = useEditorStore((state) => state.lightTable);
  const zoom = useEditorStore((state) => state.zoom);
  const pan = useEditorStore((state) => state.pan);
  const fitToScreen = useEditorStore((state) => state.fitToScreen);
  const mainTool = useEditorStore((state) => state.mainTool);
  const brushKind = useEditorStore((state) => state.brushKind);
  const brushSettings = useEditorStore((state) => state.brushSettings);
  const colorA = useEditorStore((state) => state.colorA);
  const selection = useEditorStore((state) => state.selection);
  const papers = useEditorStore((state) => state.papers);
  const showGuides = useEditorStore((state) => state.showGuides);
  const lineSmoothing = useEditorStore((state) => state.lineSmoothing);
  const smoothingAmount = useEditorStore((state) => state.smoothingAmount);

  const [draft, setDraft] = useState<Stroke | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0, visible: false });
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  const draftRef = useRef<Stroke | null>(null);
  const rawPointsRef = useRef<StrokePoint[]>([]);
  const panningRef = useRef<{ x: number; y: number } | null>(null);
  const sizeDragRef = useRef<{ startY: number; startSize: number } | null>(null);

  /* ------------------------------------------------------------------ */
  /* Vista: ajuste automático o zoom manual                               */
  /* ------------------------------------------------------------------ */

  const fitZoom = useCallback(() => {
    if (viewport.width === 0 || viewport.height === 0) return 1;
    const padding = 24;
    const scaleX = (viewport.width - padding) / project.settings.width;
    const scaleY = (viewport.height - padding) / project.settings.height;
    return Math.max(0.05, Math.min(scaleX, scaleY));
  }, [viewport, project.settings.width, project.settings.height]);

  const effectiveZoom = fitToScreen ? fitZoom() : zoom;

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const observer = new ResizeObserver(() => {
      const rect = wrapper.getBoundingClientRect();
      setViewport({ width: rect.width, height: rect.height });
    });
    observer.observe(wrapper);
    const rect = wrapper.getBoundingClientRect();
    setViewport({ width: rect.width, height: rect.height });
    return () => observer.disconnect();
  }, []);

  /* ------------------------------------------------------------------ */
  /* Render                                                              */
  /* ------------------------------------------------------------------ */

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // El búfer de píxeles se acota: un lienzo de 16000 px multiplicado por el
    // DPR pediría gigabytes y mataría el navegador. El lienzo se ve igual,
    // sólo con menos resolución interna.
    const width = project.settings.width;
    const height = project.settings.height;
    const maxPixels = 16_777_216; // 4096×4096

    let dpr = Math.min(2, window.devicePixelRatio || 1);
    const requested = width * effectiveZoom * dpr * (height * effectiveZoom * dpr);
    if (requested > maxPixels) {
      dpr = Math.max(0.05, dpr * Math.sqrt(maxPixels / requested));
    }

    canvas.width = Math.max(1, Math.round(width * effectiveZoom * dpr));
    canvas.height = Math.max(1, Math.round(height * effectiveZoom * dpr));
    canvas.style.width = `${Math.round(width * effectiveZoom)}px`;
    canvas.style.height = `${Math.round(height * effectiveZoom)}px`;

    ctx.setTransform(effectiveZoom * dpr, 0, 0, effectiveZoom * dpr, 0, 0);

    renderProject(ctx, project, currentFrame, {
      lightTable,
      draft,
      papers,
      guides: showGuides,
    });

    if (preview) {
      const rect = {
        x: Math.min(preview.start.x, preview.current.x),
        y: Math.min(preview.start.y, preview.current.y),
        width: Math.abs(preview.current.x - preview.start.x),
        height: Math.abs(preview.current.y - preview.current.y),
      };

      ctx.save();
      if (preview.kind === "selection") {
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
        ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = colorA;
        ctx.lineWidth = Math.max(1, brushSettings.size);
        ctx.beginPath();
        const points =
          preview.kind === "spline"
            ? splinePoints(preview.controls ?? [preview.start, preview.current], false, 12)
            : buildShapePoints(mainTool as never, preview.start, preview.current);
        if (points.length > 0) {
          ctx.moveTo(points[0].x, points[0].y);
          for (let index = 1; index < points.length; index += 1) {
            ctx.lineTo(points[index].x, points[index].y);
          }
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    if (selection && !preview) {
      ctx.save();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = "#4a9ee0";
      ctx.lineWidth = 1;
      ctx.strokeRect(selection.x, selection.y, selection.width, selection.height);
      ctx.restore();
    }
  }, [project, currentFrame, lightTable, effectiveZoom, draft, preview, selection, papers, showGuides, colorA, brushSettings.size, mainTool]);

  useEffect(() => {
    draw();
  }, [draw]);

  /* ------------------------------------------------------------------ */
  /* Coordenadas                                                         */
  /* ------------------------------------------------------------------ */

  const toProject = useCallback(
    (event: { clientX: number; clientY: number }) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: (event.clientX - rect.left) / effectiveZoom,
        y: (event.clientY - rect.top) / effectiveZoom,
      };
    },
    [effectiveZoom],
  );

  /* ------------------------------------------------------------------ */
  /* Puntero                                                             */
  /* ------------------------------------------------------------------ */

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    const store = useEditorStore.getState();
    const point = toProject(event);

    if (event.ctrlKey || event.metaKey) {
      sizeDragRef.current = { startY: event.clientY, startSize: store.brushSettings.size };
      (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
      return;
    }

    if (mainTool === "pan" || mainTool === "camera") {
      panningRef.current = { x: event.clientX, y: event.clientY };
      (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
      return;
    }

    if (mainTool === "zoom") {
      sizeDragRef.current = { startY: event.clientY, startSize: store.zoom * 100 };
      (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
      return;
    }

    if (mainTool === "eyedropper") {
      const color = sampleColor(point);
      if (color) store.setColorA(color);
      return;
    }

    if (mainTool === "bucket") {
      applyFill(point);
      return;
    }

    if (mainTool === "selection" || mainTool === "crop" || mainTool === "cut") {
      setPreview({ kind: "selection", start: point, current: point });
      (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
      return;
    }

    if (mainTool === "spline") {
      setPreview({
        kind: "spline",
        start: point,
        current: point,
        controls: [point, point],
      });
      (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
      return;
    }

    if (SHAPE_TOOLS.has(mainTool)) {
      setPreview({ kind: "shape", start: point, current: point });
      (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
      return;
    }

    if (mainTool === "stroke") {
      const layer = store.project.layers.find((item) => item.id === store.project.currentLayerId);
      if (layer?.locked) return;

      const rawPoint: StrokePoint = {
        x: point.x,
        y: point.y,
        pressure: normalizePressure(event.pressure),
        t: event.timeStamp,
      };
      rawPointsRef.current = [rawPoint];

      const stroke = createStroke(
        BRUSH_ENGINE_TOOL[brushKind],
        [point],
        { ...store.brushSettings, color: store.colorA },
        Math.floor(Math.random() * 1_000_000),
        { brush: brushKind },
      );
      draftRef.current = stroke;
      setDraft(stroke);
      (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const store = useEditorStore.getState();
    const point = toProject(event);

    if (sizeDragRef.current) {
      const delta = (sizeDragRef.current.startY - event.clientY) / 10;
      store.setBrushSettings({ size: Math.max(0.5, Math.min(100, sizeDragRef.current.startSize + delta)) });
      return;
    }

    if (panningRef.current) {
      store.setPan({
        x: pan.x + (event.clientX - panningRef.current.x),
        y: pan.y + (event.clientY - panningRef.current.y),
      });
      panningRef.current = { x: event.clientX, y: event.clientY };
      return;
    }

    if (preview) {
      if (preview.kind === "spline") {
        setPreview({ ...preview, current: point, controls: [preview.start, point] });
      } else {
        setPreview({ ...preview, current: point });
      }
      return;
    }

    if (draftRef.current) {
      const rawPoint: StrokePoint = {
        x: point.x,
        y: point.y,
        pressure: normalizePressure(event.pressure),
        t: event.timeStamp,
      };
      rawPointsRef.current = [...rawPointsRef.current, rawPoint];

      const store2 = useEditorStore.getState();
      let points = stabilizePoints(rawPointsRef.current, store2.brushSettings.smoothing);
      if (store2.lineSmoothing) points = smoothStroke(points, store2.smoothingAmount);
      const next: Stroke = { ...draftRef.current, points };
      draftRef.current = next;
      setDraft(next);
    }
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const store = useEditorStore.getState();
    sizeDragRef.current = null;
    panningRef.current = null;

    if (preview) {
      const rect = {
        x: Math.min(preview.start.x, preview.current.x),
        y: Math.min(preview.start.y, preview.current.y),
        width: Math.abs(preview.current.x - preview.start.x),
        height: Math.abs(preview.current.y - preview.start.y),
      };

      if (preview.kind === "selection") {
        if (mainTool === "selection") {
          store.setSelection(rect.width > 2 && rect.height > 2 ? rect : null);
        } else if (mainTool === "cut") {
          eraseRegion(rect);
        } else if (mainTool === "crop") {
          cropOutside(rect);
        }
      } else if (preview.kind === "spline") {
        const controls = preview.controls ?? [preview.start, preview.current];
        const stroke = createStroke(
          SHAPE_ENGINE_TOOL,
          splinePoints(controls, false, 14),
          { ...store.brushSettings, color: store.colorA },
          Math.floor(Math.random() * 1_000_000),
          { kind: "shape", shape: "spline", brush: brushKind },
        );
        store.addStroke(stroke);
      } else {
        const points = buildShapePoints(mainTool as never, preview.start, preview.current);
        const stroke = createStroke(
          SHAPE_ENGINE_TOOL,
          points,
          { ...store.brushSettings, color: store.colorA },
          Math.floor(Math.random() * 1_000_000),
          { kind: "shape", shape: mainTool as never, brush: brushKind },
        );
        store.addStroke(stroke);
      }
      setPreview(null);
      return;
    }

    if (draftRef.current) {
      const stroke = draftRef.current;
      draftRef.current = null;
      rawPointsRef.current = [];
      setDraft(null);
      if (stroke.points.length > 0) store.addStroke(stroke);
    }
  };

  const handleWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
    const store = useEditorStore.getState();
    if (event.ctrlKey || event.metaKey || mainTool === "zoom") {
      store.setZoom(store.zoom * (event.deltaY > 0 ? 0.9 : 1.1));
    }
  };

  /* ------------------------------------------------------------------ */
  /* Acciones sobre el lienzo                                             */
  /* ------------------------------------------------------------------ */

  const sampleColor = (point: { x: number; y: number }): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    // El lienzo visible se dibuja escalado (zoom y DPR): para leer un píxel
    // hay que traducir de coordenadas del proyecto a píxeles del búfer.
    const scaleX = canvas.width / Math.max(1, project.settings.width);
    const scaleY = canvas.height / Math.max(1, project.settings.height);
    const px = Math.floor(point.x * scaleX);
    const py = Math.floor(point.y * scaleY);
    if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const data = ctx.getImageData(px, py, 1, 1).data;
    return `#${[data[0], data[1], data[2]]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("")}`;
  };

  const applyFill = (point: { x: number; y: number }) => {
    const store = useEditorStore.getState();
    // El relleno por inundación trabaja sobre píxeles: con lienzos enormes
    // el costo sería prohibitivo, así que se avisa en lugar de colgar.
    const pixels = store.project.settings.width * store.project.settings.height;
    if (pixels > 40_000_000) {
      store.setStatus("El lienzo es demasiado grande para el relleno por inundación");
      return;
    }
    const outcome = applyFloodFill(
      store.project,
      store.currentFrame,
      store.project.currentLayerId,
      point.x,
      point.y,
      store.colorA,
      store.brushSettings.fillTolerance,
    );
    // El bitmap del relleno se *añade* encima de los trazos vectoriales:
    // el dibujo sigue siendo vectorial y el undo lo devuelve intacto.
    if (outcome.stroke) {
      store.addStroke(outcome.stroke);
      store.setStatus(
        `Relleno aplicado (${outcome.filledPixels.toLocaleString("es-AR")} píxeles)`,
      );
    }
  };

  /** Borra la región indicada (herramienta de corte). */
  const eraseRegion = (rect: { x: number; y: number; width: number; height: number }) => {
    const current = useEditorStore.getState();
    const image = currentImageOf(current.project, current.currentFrame, current.project.currentLayerId);
    if (!image) return;
    // El corte parte los trazos que cruzan la región y borra los píxeles de
    // los rellenos: no se limita a descartar los trazos enteros.
    const kept = cutStrokes(image.strokes, rect);
    current.replaceCurrentStrokes(kept);
    current.setStatus("Corte aplicado");
  };

  /** Recorta: elimina lo que queda fuera del rectángulo. */
  const cropOutside = (rect: { x: number; y: number; width: number; height: number }) => {
    const store = useEditorStore.getState();
    const image = currentImageOf(store.project, store.currentFrame, store.project.currentLayerId);
    if (!image) return;
    const kept = image.strokes.filter((stroke) =>
      stroke.points.some(
        (point) =>
          point.x >= rect.x &&
          point.x <= rect.x + rect.width &&
          point.y >= rect.y &&
          point.y <= rect.y + rect.height,
      ),
    );
    store.replaceCurrentStrokes(kept);
    store.setStatus("Recorte aplicado");
  };

  /* ------------------------------------------------------------------ */
  /* Cursor del pincel                                                   */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    const move = (event: PointerEvent) => setCursor({ x: event.clientX, y: event.clientY, visible: true });
    const leave = () => setCursor((state) => ({ ...state, visible: false }));
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerleave", leave);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerleave", leave);
    };
  }, []);

  const isEraser = brushKind === "eraser" && mainTool === "stroke";
  const cursorColor = isEraser ? "#ff4d4d" : "#ffffff";

  return (
    <div
      ref={wrapperRef}
      className="relative flex-1 overflow-hidden"
      style={{
        backgroundColor: "#141619",
        backgroundImage:
          "linear-gradient(45deg, #1b1d21 25%, transparent 25%), linear-gradient(-45deg, #1b1d21 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1b1d21 75%), linear-gradient(-45deg, transparent 75%, #1b1d21 75%)",
        backgroundSize: "20px 20px",
        backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
      }}
    >
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          transform: `translate(-50%, -50%) translate(${fitToScreen ? 0 : pan.x}px, ${fitToScreen ? 0 : pan.y}px)`,
        }}
      >
        <canvas
          ref={canvasRef}
          className="drawing-surface rounded-[2px] shadow-[0_18px_50px_rgba(0,0,0,0.6)]"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
          style={{ touchAction: "none" }}
        />
      </div>

      {cursor.visible ? (
        <div
          className="pointer-events-none fixed z-50 rounded-full border"
          style={{
            left: cursor.x,
            top: cursor.y,
            width: Math.max(4, brushSettings.size * effectiveZoom),
            height: Math.max(4, brushSettings.size * effectiveZoom),
            transform: "translate(-50%, -50%)",
            borderColor: cursorColor,
            opacity: 0.8,
            boxShadow: "0 0 0 1px rgba(0,0,0,0.45)",
          }}
        />
      ) : null}
    </div>
  );
}

/** Imagen de la capa indicada en el cuadro dado. */
function currentImageOf(project: Project, frame: number, layerId: string): ClipImage | undefined {
  const layer = project.layers.find((item) => item.id === layerId);
  if (!layer) return undefined;
  const imageId = imageIdAtFrame(layer, frame);
  return imageId ? project.images[imageId] : undefined;
}

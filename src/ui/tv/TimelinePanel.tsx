"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, Lightbulb, Lock, Unlock } from "lucide-react";

import { useEditorStore } from "@/application/store/editorStore";
import type { ClipImage, Layer } from "@/domain/project/model";
import {
  frameToInstanceIndex,
  instanceDuration,
  instanceStarts,
  layerDuration,
  projectDuration,
} from "@/domain/timeline/instances";
import { renderThumbnail } from "@/infrastructure/canvas/tvRenderer";

const CELL_WIDTH = 34;
const ROW_HEIGHT = 54;
const LAYER_ROW_HEIGHT = 26;

/**
 * Línea de tiempo al estilo TVPaint.
 *
 * A la izquierda está el *Layer Stack* (las capas del proyecto) y a la
 * derecha las instancias de cada capa. Cada instancia ocupa un bloque cuyo
 * ancho depende de su duración (1 cuadro + celdas de exposición). El tirador
 * derecho del bloque estira la instancia, como en TVPaint.
 */
export function TimelinePanel() {
  const project = useEditorStore((state) => state.project);
  const currentFrame = useEditorStore((state) => state.currentFrame);
  const setCurrentFrame = useEditorStore((state) => state.setCurrentFrame);
  const setCurrentLayer = useEditorStore((state) => state.setCurrentLayer);
  const setCurrentInstanceExposures = useEditorStore((state) => state.setCurrentInstanceExposures);

  const totalFrames = Math.max(1, projectDuration(project.layers));
  const rulerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  /** Arrastra el playhead sobre la regla. */
  const usePlayheadDrag = () => {
    const onPointerDown = (event: React.PointerEvent) => {
      const ruler = rulerRef.current;
      if (!ruler) return;
      (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
      setDragging(true);

      const move = (moveEvent: PointerEvent) => {
        const rect = ruler.getBoundingClientRect();
        const frame = Math.floor((moveEvent.clientX - rect.left) / CELL_WIDTH);
        setCurrentFrame(Math.max(0, Math.min(totalFrames - 1, frame)));
      };
      const up = () => {
        setDragging(false);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    };
    return onPointerDown;
  };

  return (
    <div className="tv-panel flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1">
        {/* Layer Stack */}
        <div className="w-[190px] shrink-0 overflow-y-auto border-r border-border bg-[#2b2e35] tv-scroll">
          <div className="sticky top-0 z-10 flex h-[22px] items-center justify-between bg-[#33363d] px-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Capas</span>
            <span>{project.layers.length}</span>
          </div>
          {[...project.layers].reverse().map((layer) => (
            <LayerStackRow
              key={layer.id}
              layer={layer}
              active={layer.id === project.currentLayerId}
              onSelect={() => setCurrentLayer(layer.id)}
            />
          ))}
        </div>

        {/* Instancias */}
        <div className="flex min-w-0 flex-1 flex-col">
        {/* Regla de cuadros */}
        <div
          ref={rulerRef}
          className="relative h-[22px] shrink-0 cursor-col-resize overflow-hidden border-b border-border bg-[#2b2e35]"
          onPointerDown={usePlayheadDrag()}
        >
          <div className="absolute inset-0 flex">
            {Array.from({ length: totalFrames }, (_, index) => (
              <div
                key={index}
                className="shrink-0 border-r border-[#3a3e47] text-center text-[9px] leading-[22px] text-muted-foreground"
                style={{ width: CELL_WIDTH }}
              >
                {index + 1}
              </div>
            ))}
          </div>
          <Playhead frame={currentFrame} height={22} />
        </div>
        <div className="relative min-w-0 flex-1 overflow-auto tv-scroll">
          <div className="relative" style={{ minWidth: totalFrames * CELL_WIDTH }}>
            {[...project.layers].reverse().map((layer) => (
              <LayerRow
                key={layer.id}
                layer={layer}
                project={project}
                currentFrame={currentFrame}
                onSelectFrame={setCurrentFrame}
                onSelectLayer={() => setCurrentLayer(layer.id)}
                onChangeExposures={(instanceIndex, exposures) => {
                  // El store opera sobre la capa activa: se selecciona y se aplica.
                  useEditorStore.getState().setCurrentLayer(layer.id);
                  const state = useEditorStore.getState();
                  const target = state.project.layers.find((item) => item.id === layer.id);
                  if (!target) return;
                  const index = frameToInstanceIndex(target, state.currentFrame);
                  if (index !== instanceIndex) {
                    setCurrentFrame(instanceStarts(target)[instanceIndex] ?? 0);
                  }
                  useEditorStore.getState().setCurrentInstanceExposures(exposures);
                }}
              />
            ))}

            {/* Playhead sobre las instancias */}
            <Playhead frame={currentFrame} height={999} />
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

function Playhead({ frame, height }: { frame: number; height: number }) {
  return (
    <div
      className="pointer-events-none absolute top-0 z-20 w-[2px] bg-[var(--tv-playhead)]"
      style={{ left: frame * CELL_WIDTH + CELL_WIDTH / 2, height }}
    >
      <div className="absolute -left-[4px] top-0 h-0 w-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-[var(--tv-playhead)]" />
    </div>
  );
}

function LayerStackRow({
  layer,
  active,
  onSelect,
}: {
  layer: Layer;
  active: boolean;
  onSelect: () => void;
}) {
  const toggleLayerVisible = useEditorStore((state) => state.toggleLayerVisible);
  const toggleLayerLocked = useEditorStore((state) => state.toggleLayerLocked);
  const toggleLayerLightTable = useEditorStore((state) => state.toggleLayerLightTable);
  const setLayerOpacity = useEditorStore((state) => state.setLayerOpacity);
  const renameLayer = useEditorStore((state) => state.renameLayer);

  return (
    <div
      className="flex items-center gap-1 border-b border-[#33363d] px-1.5"
      style={{ background: active ? "#39414d" : "transparent" }}
      onClick={onSelect}
    >
      <span className="h-3 w-1 shrink-0 rounded-[1px]" style={{ background: layer.color }} />
      <button
        type="button"
        className="tv-icon-btn !h-[20px] !w-[18px]"
        title={layer.visible ? "Ocultar capa" : "Mostrar capa"}
        onClick={(event) => {
          event.stopPropagation();
          toggleLayerVisible(layer.id);
        }}
      >
        {layer.visible ? <Eye size={13} /> : <EyeOff size={13} className="opacity-50" />}
      </button>
      <button
        type="button"
        className="tv-icon-btn !h-[20px] !w-[18px]"
        title={layer.locked ? "Desbloquear capa" : "Bloquear capa"}
        onClick={(event) => {
          event.stopPropagation();
          toggleLayerLocked(layer.id);
        }}
      >
        {layer.locked ? <Lock size={13} /> : <Unlock size={13} className="opacity-50" />}
      </button>
      <button
        type="button"
        className="tv-icon-btn !h-[20px] !w-[18px]"
        data-active={layer.lightTable}
        title="Light Table de la capa"
        onClick={(event) => {
          event.stopPropagation();
          toggleLayerLightTable(layer.id);
        }}
      >
        <Lightbulb size={13} className={layer.lightTable ? "text-[#ffd166]" : "opacity-40"} />
      </button>
      <input
        className="min-w-0 flex-1 bg-transparent text-[11px] outline-none focus:bg-[#1f2228]"
        defaultValue={layer.name}
        onClick={(event) => event.stopPropagation()}
        onBlur={(event) => renameLayer(layer.id, event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") (event.target as HTMLInputElement).blur();
        }}
      />
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(layer.opacity * 100)}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => setLayerOpacity(layer.id, Number(event.target.value) / 100)}
        className="h-1 w-[52px] shrink-0 cursor-pointer accent-[#4a9ee0]"
        title={`Opacidad ${Math.round(layer.opacity * 100)}%`}
      />
    </div>
  );
}

function LayerRow({
  layer,
  project,
  currentFrame,
  onSelectFrame,
  onSelectLayer,
  onChangeExposures,
}: {
  layer: Layer;
  project: { images: Record<string, ClipImage>; settings: { width: number; height: number } };
  currentFrame: number;
  onSelectFrame: (frame: number) => void;
  onSelectLayer: () => void;
  onChangeExposures: (instanceIndex: number, exposures: number) => void;
}) {
  const starts = useMemo(() => instanceStarts(layer), [layer]);
  const duration = useMemo(() => layerDuration(layer), [layer]);
  const currentInstance = frameToInstanceIndex(layer, currentFrame);
  // Durante el arrastre del tirador el valor vive en estado local: así el
  // arrastre completo se registra como un único paso del historial.
  const [drag, setDrag] = useState<{ index: number; exposures: number } | null>(null);

  return (
    <div
      className="relative border-b border-[#33363d]"
      style={{ height: ROW_HEIGHT, minWidth: Math.max(duration, 1) * CELL_WIDTH }}
    >
      {layer.instances.map((instance, index) => {
        const image = instance.headImageId ? project.images[instance.headImageId] : undefined;
        const exposures = drag?.index === index ? drag.exposures : instance.exposures;
        const width = (1 + exposures) * CELL_WIDTH;
        const left = starts[index] * CELL_WIDTH;
        const isCurrent = index === currentInstance;

        return (
          <div
            key={instance.id}
            className="absolute top-1 select-none"
            style={{ left, width: width - 2 }}
          >
            <div
              className="relative h-[42px] w-full overflow-hidden rounded-[2px] border"
              style={{
                borderColor: isCurrent ? "#4a9ee0" : "#3f434c",
                background: "#1b1d21",
              }}
              onClick={(event) => {
                event.stopPropagation();
                onSelectLayer();
                onSelectFrame(starts[index]);
              }}
              title={`Instancia ${index + 1} — ${instanceDuration(instance)} cuadro(s)`}
            >
              <InstanceThumbnail
                image={image}
                width={Math.max(1, width - 2)}
                height={42}
                projectWidth={project.settings.width}
                projectHeight={project.settings.height}
              />

              {/* Número de celdas de exposición */}
              {exposures > 0 ? (
                <span className="absolute right-0.5 top-0.5 rounded-[2px] bg-black/70 px-1 text-[9px] text-[#ffd166]">
                  {exposures + 1}
                </span>
              ) : null}

              {/* Tirador derecho: estira la instancia */}
              <span
                className="absolute inset-y-0 right-0 w-[9px] cursor-ew-resize border-l border-white/25 bg-white/5 hover:bg-[#4a9ee0]/50"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  const startX = event.clientX;
                  const base = instance.exposures;
                  let latest = base;
                  const move = (moveEvent: PointerEvent) => {
                    const delta = Math.round((moveEvent.clientX - startX) / CELL_WIDTH);
                    latest = Math.max(0, base + delta);
                    setDrag({ index, exposures: latest });
                  };
                  const up = () => {
                    window.removeEventListener("pointermove", move);
                    window.removeEventListener("pointerup", up);
                    setDrag(null);
                    if (latest !== base) onChangeExposures(index, latest);
                  };
                  window.addEventListener("pointermove", move);
                  window.addEventListener("pointerup", up);
                }}
                title="Estirar la instancia (agregar celdas de exposición)"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function InstanceThumbnail({
  image,
  width,
  height,
  projectWidth,
  projectHeight,
}: {
  image: ClipImage | undefined;
  width: number;
  height: number;
  projectWidth: number;
  projectHeight: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const thumb = renderThumbnail(image, width, height, projectWidth, projectHeight);
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(thumb, 0, 0);
  }, [image, width, height, projectWidth, projectHeight]);

  return <canvas ref={ref} width={width} height={height} className="block" />;
}

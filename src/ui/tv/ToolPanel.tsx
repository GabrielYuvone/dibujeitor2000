"use client";

import { useEditorStore } from "@/application/store/editorStore";
import { BRUSH_PRESETS, BRUSH_SHORTCUTS } from "@/domain/brush/brushes";

/**
 * Tool Panel: es un panel polimórfico. Muestra la lista de pinceles y, debajo,
 * los parámetros del pincel activo (que cambian según el pincel elegido).
 */
export function ToolPanel() {
  const mainTool = useEditorStore((state) => state.mainTool);
  const brushKind = useEditorStore((state) => state.brushKind);
  const setBrushKind = useEditorStore((state) => state.setBrushKind);
  const settings = useEditorStore((state) => state.brushSettings);
  const setBrushSettings = useEditorStore((state) => state.setBrushSettings);
  const colorA = useEditorStore((state) => state.colorA);
  const setColorA = useEditorStore((state) => state.setColorA);

  const preset = BRUSH_PRESETS.find((item) => item.kind === brushKind) ?? BRUSH_PRESETS[0];
  const has = (control: string) => preset.controls.includes(control as never);
  const shortcutOf = (kind: string): string | undefined =>
    Object.entries(BRUSH_SHORTCUTS).find(([, value]) => value === kind)?.[0];
  // El pincel sólo afecta al trazo libre: avisarlo evita la confusión de
  // "elegí la goma y el rectángulo borró el dibujo".
  const usesBrush = mainTool === "stroke";

  return (
    <div className="tv-panel">
      <div className="tv-panel-title">
        <span>Pincel</span>
        <span className="text-[9px] font-normal normal-case">{preset.label}</span>
      </div>

      {!usesBrush ? (
        <p className="mx-2 mt-1 rounded-[3px] border border-[#4a9ee0]/40 bg-[#24333f] px-1.5 py-1 text-[9px] leading-tight text-[#cfe6ff]">
          El pincel se aplica al <strong>Trazo</strong>. Con esta herramienta se usan el color y
          el tamaño de forma directo.
        </p>
      ) : null}

      {/* Lista de pinceles */}
      <div className="grid grid-cols-3 gap-[2px] p-1">
        {BRUSH_PRESETS.map((item) => (
          <button
            key={item.kind}
            type="button"
            className="flex flex-col items-center gap-0.5 rounded-[3px] border border-transparent px-1 py-1 text-[9px] text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            data-active={brushKind === item.kind}
            style={
              brushKind === item.kind
                ? { background: "var(--tv-selected)", borderColor: "#4a9ee0", color: "#eaf4ff" }
                : undefined
            }
            title={item.hint}
            onClick={() => setBrushKind(item.kind)}
          >
            <span
              className="block h-2.5 w-6 rounded-full"
              style={{
                background: item.kind === "eraser" ? "#7c828e" : colorA,
                opacity: item.kind === "eraser" ? 0.8 : 1,
                borderRadius: item.kind === "pencil" ? 1 : 999,
              }}
            />
            <span className="flex items-center gap-1">
              {item.label}
              <kbd className="rounded-[2px] bg-black/30 px-1 text-[8px] text-muted-foreground">
                {shortcutOf(item.kind)}
              </kbd>
            </span>
          </button>
        ))}
      </div>

      <div className="mx-1 border-t border-border" />

      {/* Parámetros del pincel activo */}
      <div className="space-y-1.5 p-2">
        <p className="text-[10px] leading-tight text-muted-foreground">{preset.hint}</p>

        {has("size") ? (
          <RangeRow
            label="Tamaño"
            value={settings.size}
            min={0.5}
            max={100}
            step={0.5}
            suffix="px"
            onChange={(value) => setBrushSettings({ size: value })}
          />
        ) : null}

        {has("color") ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-muted-foreground">Color</span>
            <div className="flex items-center gap-1">
              <input
                type="color"
                value={colorA}
                onChange={(event) => setColorA(event.target.value)}
                className="h-5 w-8 cursor-pointer rounded-[2px] border border-border bg-transparent"
                aria-label="Color del pincel"
              />
              <span className="font-mono text-[10px] text-muted-foreground">{colorA}</span>
            </div>
          </div>
        ) : null}

        {has("opacity") ? (
          <RangeRow
            label="Opacidad"
            value={settings.opacity}
            min={0.05}
            max={1}
            step={0.05}
            format={(value) => `${Math.round(value * 100)}%`}
            onChange={(value) => setBrushSettings({ opacity: value })}
          />
        ) : null}

        {has("hardness") ? (
          <RangeRow
            label="Dureza"
            value={settings.hardness}
            min={0}
            max={1}
            step={0.05}
            format={(value) => `${Math.round(value * 100)}%`}
            onChange={(value) => setBrushSettings({ hardness: value })}
          />
        ) : null}

        {has("grain") ? (
          <RangeRow
            label="Grano"
            value={settings.grain}
            min={0}
            max={1}
            step={0.05}
            format={(value) => `${Math.round(value * 100)}%`}
            onChange={(value) => setBrushSettings({ grain: value })}
          />
        ) : null}

        {has("flow") ? (
          <RangeRow
            label="Flujo"
            value={settings.flow}
            min={0.05}
            max={1}
            step={0.05}
            format={(value) => `${Math.round(value * 100)}%`}
            onChange={(value) => setBrushSettings({ flow: value })}
          />
        ) : null}

        {has("soft") ? (
          <label className="flex items-center justify-between text-[10px] text-muted-foreground">
            Goma suave
            <input
              type="checkbox"
              checked={settings.softEraser}
              onChange={(event) => setBrushSettings({ softEraser: event.target.checked })}
              className="accent-[#4a9ee0]"
            />
          </label>
        ) : null}

        <label className="flex items-center justify-between text-[10px] text-muted-foreground">
          Sensibilidad a presión
          <input
            type="checkbox"
            checked={settings.pressureEnabled}
            onChange={(event) => setBrushSettings({ pressureEnabled: event.target.checked })}
            className="accent-[#4a9ee0]"
          />
        </label>
      </div>
    </div>
  );
}

interface RangeRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  format?: (value: number) => string;
  onChange: (value: number) => void;
}

function RangeRow({ label, value, min, max, step, suffix, format, onChange }: RangeRowProps) {
  return (
    <label className="flex items-center gap-2">
      <span className="w-[62px] shrink-0 text-[10px] text-muted-foreground">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1 min-w-0 flex-1 cursor-pointer accent-[#4a9ee0]"
      />
      <span className="w-[42px] shrink-0 text-right font-mono text-[10px] text-muted-foreground">
        {format ? format(value) : `${value}${suffix ?? ""}`}
      </span>
    </label>
  );
}

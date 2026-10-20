"use client";

import { useRef, useState } from "react";
import {
  CircleHelp,
  Eye,
  EyeOff,
  Lightbulb,
  Lock,
  Music,
  Palette,
  Plus,
  Trash2,
  Unlock,
} from "lucide-react";

import { useEditorStore } from "@/application/store/editorStore";
import { DEFAULT_PALETTE } from "@/domain/color/palette";
import { loadAsset, saveAsset } from "@/application/persistence/projectRepository";
import { LightTablePanel } from "@/ui/tv/LightTablePanel";
import { HelpPanel } from "@/ui/tv/HelpPanel";

type DrawerTab = "lighttable" | "paleta" | "capas" | "audio" | "ayuda";

const TABS: { id: DrawerTab; label: string; icon: typeof Lightbulb }[] = [
  { id: "lighttable", label: "Light Table", icon: Lightbulb },
  { id: "paleta", label: "Paleta", icon: Palette },
  { id: "capas", label: "Capas", icon: Eye },
  { id: "audio", label: "Audio", icon: Music },
  { id: "ayuda", label: "Ayuda", icon: CircleHelp },
];

/** Cajón derecho: paneles auxiliares (TVPaint los llama "Right Drawer"). */
export function RightDrawer() {
  const [tab, setTab] = useState<DrawerTab>("lighttable");

  return (
    <div className="tv-panel flex h-full min-h-0 w-[248px] shrink-0 flex-col">
      <div className="flex shrink-0 border-b border-border bg-[#2b2e35]">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="tv-icon-btn !h-[26px] !w-[30px] rounded-none border-b-2 border-transparent"
            style={tab === item.id ? { borderBottomColor: "#4a9ee0", background: "#33363d" } : undefined}
            title={item.label}
            aria-label={item.label}
            onClick={() => setTab(item.id)}
          >
            <item.icon size={14} />
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto tv-scroll">
        {tab === "lighttable" ? <LightTablePanel /> : null}
        {tab === "paleta" ? <PalettePanel /> : null}
        {tab === "capas" ? <LayersPanel /> : null}
        {tab === "audio" ? <AudioPanel /> : null}
        {tab === "ayuda" ? <HelpPanel /> : null}
      </div>
    </div>
  );
}

function PalettePanel() {
  const colorA = useEditorStore((state) => state.colorA);
  const setColorA = useEditorStore((state) => state.setColorA);
  const setColorB = useEditorStore((state) => state.setColorB);

  return (
    <div className="tv-panel border-0">
      <div className="tv-panel-title">
        <span>Paleta</span>
      </div>

      <div className="p-2">
        <p className="mb-1 text-[10px] text-muted-foreground">Colores (clic: A · clic derecho: B)</p>
        <div className="grid grid-cols-6 gap-1">
          {DEFAULT_PALETTE.map((color) => (
            <button
              key={color.hex}
              type="button"
              className="h-5 w-5 rounded-[2px] border border-black/40"
              style={{
                background: color.hex,
                outline: color.hex === colorA ? "2px solid #4a9ee0" : undefined,
              }}
              title={`${color.name} ${color.hex}`}
              onClick={() => setColorA(color.hex)}
              onContextMenu={(event) => {
                event.preventDefault();
                setColorB(color.hex);
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function LayersPanel() {
  const project = useEditorStore((state) => state.project);
  const setCurrentLayer = useEditorStore((state) => state.setCurrentLayer);
  const addLayer = useEditorStore((state) => state.addLayer);
  const deleteLayer = useEditorStore((state) => state.deleteLayer);
  const toggleLayerVisible = useEditorStore((state) => state.toggleLayerVisible);
  const toggleLayerLocked = useEditorStore((state) => state.toggleLayerLocked);
  const toggleLayerLightTable = useEditorStore((state) => state.toggleLayerLightTable);
  const moveLayer = useEditorStore((state) => state.moveLayer);

  return (
    <div className="tv-panel border-0">
      <div className="tv-panel-title">
        <span>Capas</span>
        <button
          type="button"
          className="tv-icon-btn !h-[18px] !w-[18px]"
          title="Nueva capa"
          onClick={() => addLayer()}
        >
          <Plus size={13} />
        </button>
      </div>

      <div className="p-1.5">
        {[...project.layers].reverse().map((layer) => (
          <div
            key={layer.id}
            className="mb-1 rounded-[3px] border p-1.5"
            style={{
              borderColor: layer.id === project.currentLayerId ? "#4a9ee0" : "#3f434c",
              background: layer.id === project.currentLayerId ? "#2f3f4d" : "#2b2e35",
            }}
            onClick={() => setCurrentLayer(layer.id)}
          >
            <div className="flex items-center gap-1">
              <span className="h-3 w-1 rounded-[1px]" style={{ background: layer.color }} />
              <span className="min-w-0 flex-1 truncate text-[11px]">{layer.name}</span>
              <button
                type="button"
                className="tv-icon-btn !h-[18px] !w-[18px]"
                title="Visibilidad"
                onClick={(event) => {
                  event.stopPropagation();
                  toggleLayerVisible(layer.id);
                }}
              >
                {layer.visible ? <Eye size={12} /> : <EyeOff size={12} className="opacity-50" />}
              </button>
              <button
                type="button"
                className="tv-icon-btn !h-[18px] !w-[18px]"
                title="Bloqueo"
                onClick={(event) => {
                  event.stopPropagation();
                  toggleLayerLocked(layer.id);
                }}
              >
                {layer.locked ? <Lock size={12} /> : <Unlock size={12} className="opacity-50" />}
              </button>
              <button
                type="button"
                className="tv-icon-btn !h-[18px] !w-[18px]"
                title="Light Table"
                onClick={(event) => {
                  event.stopPropagation();
                  toggleLayerLightTable(layer.id);
                }}
              >
                <Lightbulb size={12} className={layer.lightTable ? "text-[#ffd166]" : "opacity-40"} />
              </button>
            </div>
            <div className="mt-1 flex items-center gap-1">
              <button
                type="button"
                className="tv-icon-btn !h-[18px] !w-[18px]"
                title="Subir capa"
                onClick={(event) => {
                  event.stopPropagation();
                  moveLayer(layer.id, 1);
                }}
              >
                ▲
              </button>
              <button
                type="button"
                className="tv-icon-btn !h-[18px] !w-[18px]"
                title="Bajar capa"
                onClick={(event) => {
                  event.stopPropagation();
                  moveLayer(layer.id, -1);
                }}
              >
                ▼
              </button>
              <span className="ml-auto text-[9px] text-muted-foreground">
                {layer.instances.length} instancia(s)
              </span>
              <button
                type="button"
                className="tv-icon-btn !h-[18px] !w-[18px]"
                title="Eliminar capa"
                onClick={(event) => {
                  event.stopPropagation();
                  deleteLayer(layer.id);
                }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AudioPanel() {
  const project = useEditorStore((state) => state.project);
  const currentFrame = useEditorStore((state) => state.currentFrame);
  const fileRef = useRef<HTMLInputElement>(null);

  const addClip = async (file: File) => {
    const assetId = `audio-${Date.now()}`;
    await saveAsset({
      id: assetId,
      name: file.name,
      type: file.type,
      blob: file,
      createdAt: Date.now(),
    });
    const clip = {
      id: `clip-${Date.now()}`,
      name: file.name,
      startFrame: currentFrame,
      duration: 24,
      assetId,
      volume: 1,
      muted: false,
    };
    useEditorStore.setState((state) => ({
      project: { ...state.project, audio: [...state.project.audio, clip] },
      dirty: true,
    }));
  };

  return (
    <div className="tv-panel border-0">
      <div className="tv-panel-title">
        <span>Audio</span>
        <button
          type="button"
          className="tv-icon-btn !h-[18px] !w-[18px]"
          title="Agregar audio"
          onClick={() => fileRef.current?.click()}
        >
          <Plus size={13} />
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void addClip(file);
        }}
      />
      <div className="p-2">
        {project.audio.length === 0 ? (
          <p className="text-[10px] text-muted-foreground">
            Sin pistas de audio. Agregá un archivo para incluirlo en la línea de tiempo.
          </p>
        ) : (
          project.audio.map((clip) => (
            <div key={clip.id} className="mb-1 rounded-[3px] bg-[#2b2e35] p-1.5 text-[10px]">
              <div className="truncate">{clip.name}</div>
              <div className="text-muted-foreground">
                cuadro {clip.startFrame + 1} · {clip.duration} cuadros
              </div>
            </div>
          ))
        )}
        {project.audio.length > 0 ? (
          <button
            type="button"
            className="mt-1 w-full rounded-[3px] border border-border py-1 text-[10px] hover:bg-accent"
            onClick={async () => {
              const clip = project.audio[0];
              const asset = await loadAsset(clip.assetId);
              if (asset) {
                const audio = new Audio(URL.createObjectURL(asset.blob));
                void audio.play();
              }
            }}
          >
            Reproducir la primera pista
          </button>
        ) : null}
      </div>
    </div>
  );
}

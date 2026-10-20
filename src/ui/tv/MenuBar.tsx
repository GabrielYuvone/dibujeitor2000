"use client";

import { useEffect, useRef, useState } from "react";
import {
  Download,
  FilePlus2,
  FolderOpen,
  Redo2,
  Save,
  Undo2,
} from "lucide-react";

import { useEditorStore } from "@/application/store/editorStore";
import { saveProject } from "@/application/persistence/projectRepository";
import { exportProject } from "@/infrastructure/export";
import { CanvasSizeDialog } from "@/ui/tv/CanvasSizeDialog";
import type { ExportOptions } from "@/domain/export/plan";
import { projectDuration } from "@/domain/timeline/instances";

interface MenuEntry {
  label: string;
  shortcut?: string;
  action?: () => void;
  separator?: boolean;
}

const MENUS = ["Archivo", "Edición", "Proyecto", "Clip", "Capa", "Imagen", "Vista", "Ayuda"];

export function MenuBar() {
  const [open, setOpen] = useState<string | null>(null);
  const [showSizeDialog, setShowSizeDialog] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  const project = useEditorStore((state) => state.project);
  const currentFrame = useEditorStore((state) => state.currentFrame);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const newProject = useEditorStore((state) => state.newProject);
  const setStatus = useEditorStore((state) => state.setStatus);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!barRef.current?.contains(event.target as Node)) setOpen(null);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, []);

  const doSave = async () => {
    await saveProject(useEditorStore.getState().project);
    useEditorStore.setState({ dirty: false });
    setStatus("Proyecto guardado");
  };

  const doExport = async (format: ExportOptions["format"]) => {
    const state = useEditorStore.getState();
    setStatus(`Exportando a ${format.toUpperCase()}…`);
    const result = await exportProject(state.project, {
      format,
      width: state.project.settings.width,
      height: state.project.settings.height,
      fps: state.project.settings.fps,
      start: 0,
      end: Math.max(0, projectDuration(state.project.layers) - 1),
      backgroundColor: state.project.settings.backgroundColor,
      quality: 90,
    });
    const url = URL.createObjectURL(result.blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = result.filename;
    link.click();
    URL.revokeObjectURL(url);
    setStatus(`Exportado: ${result.filename}`);
  };

  const buildMenu = (name: string): MenuEntry[] => {
    switch (name) {
      case "Archivo":
        return [
          { label: "Nuevo proyecto", shortcut: "Ctrl+N", action: () => newProject() },
          { label: "Guardar proyecto", shortcut: "Ctrl+S", action: () => void doSave() },
          { separator: true, label: "" },
          { label: "Exportar MP4", action: () => void doExport("mp4") },
          { label: "Exportar WebM", action: () => void doExport("webm") },
          { label: "Exportar GIF", action: () => void doExport("gif") },
          { label: "Exportar PNG del cuadro", action: () => void doExport("png") },
        ];
      case "Edición":
        return [
          { label: "Deshacer", shortcut: "Ctrl+Z", action: undo },
          { label: "Rehacer", shortcut: "Ctrl+Y", action: redo },
          { separator: true, label: "" },
          { label: "Copiar selección", shortcut: "Ctrl+C", action: () => useEditorStore.getState().copySelection() },
          { label: "Pegar", shortcut: "Ctrl+V", action: () => useEditorStore.getState().pasteClipboard() },
          { separator: true, label: "" },
          { label: "Borrar dibujo actual", action: () => useEditorStore.getState().clearCurrentImage() },
        ];
      case "Proyecto":
        return [
          { label: "Tamaño del lienzo…", action: () => setShowSizeDialog(true) },
          { separator: true, label: "" },
          { label: "Renombrar proyecto", action: () => {
            const name = window.prompt("Nombre del proyecto", project.name);
            if (name) useEditorStore.getState().renameProject(name);
          } },
          { label: "Ajustar a la pantalla", action: () => useEditorStore.getState().setFitToScreen(true) },
        ];
      case "Clip":
        return [
          { label: "Nueva instancia", action: () => useEditorStore.getState().addInstance() },
          { label: "Agregar exposición", action: () => useEditorStore.getState().addExposure() },
          { label: "Instancia vacía", action: () => useEditorStore.getState().insertEmptyInstance() },
          { label: "Duplicar instancia", action: () => useEditorStore.getState().duplicateCurrentInstance() },
          { label: "Dividir instancia", action: () => useEditorStore.getState().splitCurrentInstance() },
          { separator: true, label: "" },
          { label: "Repetir dibujo (×2)", action: () => useEditorStore.getState().repeatHoldFrames(2) },
          { label: "Agregar 2 exposiciones", action: () => useEditorStore.getState().repeatExposureFrames(2) },
        ];
      case "Capa":
        return [
          { label: "Nueva capa", action: () => useEditorStore.getState().addLayer() },
          { label: "Eliminar capa", action: () => useEditorStore.getState().deleteLayer(project.currentLayerId) },
          { separator: true, label: "" },
          { label: "Subir capa", action: () => useEditorStore.getState().moveLayer(project.currentLayerId, 1) },
          { label: "Bajar capa", action: () => useEditorStore.getState().moveLayer(project.currentLayerId, -1) },
        ];
      case "Imagen":
        return [
          { label: "Limpiar imagen actual", action: () => useEditorStore.getState().clearCurrentImage() },
          { label: "Eliminar imagen actual", action: () => useEditorStore.getState().deleteCurrentImage() },
          { separator: true, label: "" },
          { label: "Seleccionar todo", action: () => {
            const state = useEditorStore.getState();
            state.setSelection({ x: 0, y: 0, width: state.project.settings.width, height: state.project.settings.height });
          } },
        ];
      case "Vista":
        return [
          { label: "Ajustar a la pantalla", action: () => useEditorStore.getState().setFitToScreen(true) },
          { label: "Zoom 100%", action: () => useEditorStore.getState().setZoom(1) },
          { separator: true, label: "" },
          { label: "Mostrar / ocultar guides", action: () => useEditorStore.getState().toggleGuides() },
          { label: "Papel (textura)", action: () => useEditorStore.getState().togglePapers() },
        ];
      case "Ayuda":
        return [
          { label: "Atajos de teclado", action: () => setStatus("Mirá el panel Ayuda del cajón derecho") },
        ];
      default:
        return [];
    }
  };

  return (
    <div
      ref={barRef}
      className="flex h-[30px] shrink-0 items-center gap-1 border-b border-border bg-[#2b2e35] px-1"
    >
      {MENUS.map((name) => (
        <div key={name} className="relative">
          <button
            type="button"
            className="rounded-[2px] px-2 py-1 text-[11px] text-foreground/90 hover:bg-accent"
            style={open === name ? { background: "var(--tv-selected)" } : undefined}
            onClick={() => setOpen(open === name ? null : name)}
          >
            {name}
          </button>
          {open === name ? (
            <div className="absolute left-0 top-[26px] z-50 min-w-[190px] rounded-[3px] border border-border bg-[#31343c] py-1 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
              {buildMenu(name).map((entry, index) =>
                entry.separator ? (
                  <div key={`sep-${index}`} className="my-1 border-t border-border" />
                ) : (
                  <button
                    key={entry.label}
                    type="button"
                    className="flex w-full items-center justify-between gap-6 px-3 py-1 text-left text-[11px] hover:bg-[#3d434e]"
                    onClick={() => {
                      entry.action?.();
                      setOpen(null);
                    }}
                  >
                    <span>{entry.label}</span>
                    {entry.shortcut ? (
                      <span className="text-[10px] text-muted-foreground">{entry.shortcut}</span>
                    ) : null}
                  </button>
                ),
              )}
            </div>
          ) : null}
        </div>
      ))}

      <div className="ml-2 flex items-center gap-0.5 border-l border-border pl-2">
        <button type="button" className="tv-icon-btn" title="Nuevo proyecto" onClick={() => newProject()}>
          <FilePlus2 size={14} />
        </button>
        <button type="button" className="tv-icon-btn" title="Abrir" onClick={() => setStatus("Abrir: usa el Gestor de proyectos") }>
          <FolderOpen size={14} />
        </button>
        <button type="button" className="tv-icon-btn" title="Guardar" onClick={() => void doSave()}>
          <Save size={14} />
        </button>
        <span className="mx-1 h-4 w-px bg-border" />
        <button type="button" className="tv-icon-btn" title="Deshacer (Ctrl+Z)" onClick={undo}>
          <Undo2 size={14} />
        </button>
        <button type="button" className="tv-icon-btn" title="Rehacer (Ctrl+Y)" onClick={redo}>
          <Redo2 size={14} />
        </button>
        <span className="mx-1 h-4 w-px bg-border" />
        <button type="button" className="tv-icon-btn" title="Exportar" onClick={() => setOpen("Archivo")}>
          <Download size={14} />
        </button>
      </div>

      {showSizeDialog ? <CanvasSizeDialog onClose={() => setShowSizeDialog(false)} /> : null}

      <div className="ml-auto flex items-center gap-3 pr-2 text-[10px] text-muted-foreground">
        <span>{project.name}</span>
        <span className="font-mono">
          {currentFrame + 1} / {Math.max(1, projectDuration(project.layers))}
        </span>
        {useEditorStore.getState().dirty ? <span className="text-[#e0b341]">• sin guardar</span> : null}
      </div>
    </div>
  );
}

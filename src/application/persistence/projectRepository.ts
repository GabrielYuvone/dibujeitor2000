/**
 * Persistencia local (IndexedDB vía `idb`).
 *
 * Esta es la única pieza que conoce el almacenamiento: el resto de la
 * aplicación habla con el repositorio a través de una interfaz simple.
 */

import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import type { Project } from "@/domain/project/model";
import { projectDuration } from "@/domain/timeline/instances";

const DB_NAME = "dibujeitor-tv";
const DB_VERSION = 1;

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: number;
  createdAt: number;
  frameCount: number;
}

export interface StoredAsset {
  id: string;
  name: string;
  type: string;
  blob: Blob;
  createdAt: number;
}

interface DibujeitorDB extends DBSchema {
  projects: {
    key: string;
    value: Project;
    indexes: { "by-updated": number };
  };
  assets: {
    key: string;
    value: StoredAsset;
  };
  session: {
    key: string;
    value: { key: string; value: string };
  };
}

let dbPromise: Promise<IDBPDatabase<DibujeitorDB>> | null = null;

function getDb(): Promise<IDBPDatabase<DibujeitorDB>> {
  if (!dbPromise) {
    dbPromise = openDB<DibujeitorDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const projects = db.createObjectStore("projects", { keyPath: "id" });
        projects.createIndex("by-updated", "updatedAt");
        db.createObjectStore("assets", { keyPath: "id" });
        db.createObjectStore("session", { keyPath: "key" });
      },
    });
  }
  return dbPromise;
}

/** Guarda el proyecto completo (trazos incluidos: son datos, no píxeles). */
export async function saveProject(project: Project): Promise<void> {
  const db = await getDb();
  const payload: Project = { ...project, updatedAt: Date.now() };
  await db.put("projects", payload);
}

/** Lista los proyectos guardados, del más reciente al más antiguo. */
export async function listProjects(): Promise<ProjectSummary[]> {
  const db = await getDb();
  const projects = await db.getAll("projects");
  return projects
    .map((project) => ({
      id: project.id,
      name: project.name,
      updatedAt: project.updatedAt,
      createdAt: project.createdAt,
      frameCount: projectDuration(project.layers),
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function loadProject(id: string): Promise<Project | null> {
  const db = await getDb();
  const project = await db.get("projects", id);
  return project ?? null;
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("projects", id);
}

/** Guarda un recurso de la biblioteca (imagen o audio). */
export async function saveAsset(asset: StoredAsset): Promise<void> {
  const db = await getDb();
  await db.put("assets", asset);
}

export async function loadAsset(id: string): Promise<StoredAsset | null> {
  const db = await getDb();
  const asset = await db.get("assets", id);
  return asset ?? null;
}

export async function deleteAsset(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("assets", id);
}

export async function listAssets(): Promise<StoredAsset[]> {
  const db = await getDb();
  return db.getAll("assets");
}

/* --- Sesión: permite recuperar el trabajo tras un cierre inesperado --- */

export interface SessionState {
  lastProjectId: string | null;
  /** El proyecto tenía cambios sin guardar al cerrarse. */
  dirty: boolean;
  savedAt: number;
}

export async function saveSession(state: SessionState): Promise<void> {
  const db = await getDb();
  await db.put("session", { key: "current", value: JSON.stringify(state) });
}

export async function loadSession(): Promise<SessionState | null> {
  const db = await getDb();
  const record = await db.get("session", "current");
  if (!record) return null;
  try {
    return JSON.parse(record.value) as SessionState;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  const db = await getDb();
  await db.delete("session", "current");
}

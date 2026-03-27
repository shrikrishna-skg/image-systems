import type { ImageInfo, ImageVersion } from "../types";

const DB_NAME = "image-enhance-local";
const STORE = "images";
const DB_VERSION = 1;

export type LocalVersion = {
  id: string;
  version_type: string;
  width: number | null;
  height: number | null;
  file_size_bytes: number;
  created_at: string;
  data: ArrayBuffer;
};

export type LocalImageRecord = {
  id: string;
  original_filename: string;
  width: number | null;
  height: number | null;
  file_size_bytes: number;
  mime_type: string | null;
  created_at: string;
  originalData: ArrayBuffer;
  versions: LocalVersion[];
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
  });
}

async function putRecord(rec: LocalImageRecord): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(rec);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export function recordToImageInfo(rec: LocalImageRecord): ImageInfo {
  return {
    id: rec.id,
    original_filename: rec.original_filename,
    width: rec.width,
    height: rec.height,
    file_size_bytes: rec.file_size_bytes,
    mime_type: rec.mime_type,
    created_at: rec.created_at,
    versions: rec.versions.map(
      (v): ImageVersion => ({
        id: v.id,
        version_type: v.version_type,
        width: v.width,
        height: v.height,
        file_size_bytes: v.file_size_bytes,
        provider: "local",
        model: "browser",
        scale_factor: null,
        processing_cost_usd: null,
        created_at: v.created_at,
      })
    ),
  };
}

function probeDimensions(file: File): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const u = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(u);
      resolve({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(u);
      reject(new Error("Could not read image dimensions"));
    };
    img.src = u;
  });
}

export async function saveFileAsLocalImage(file: File): Promise<ImageInfo> {
  const id = crypto.randomUUID();
  const originalData = await file.arrayBuffer();
  const { w, h } = await probeDimensions(file);
  const now = new Date().toISOString();
  const rec: LocalImageRecord = {
    id,
    original_filename: file.name,
    width: w,
    height: h,
    file_size_bytes: file.size,
    mime_type: file.type || null,
    created_at: now,
    originalData,
    versions: [],
  };
  await putRecord(rec);
  return recordToImageInfo(rec);
}

export async function getLocalRecord(id: string): Promise<LocalImageRecord | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result as LocalImageRecord | undefined);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export async function addLocalVersion(
  imageId: string,
  blob: Blob,
  versionType: string
): Promise<ImageInfo> {
  const rec = await getLocalRecord(imageId);
  if (!rec) throw new Error("Image not found");
  const data = await blob.arrayBuffer();
  const bmp = await createImageBitmap(blob);
  const vid = crypto.randomUUID();
  const now = new Date().toISOString();
  rec.versions.push({
    id: vid,
    version_type: versionType,
    width: bmp.width,
    height: bmp.height,
    file_size_bytes: data.byteLength,
    created_at: now,
    data,
  });
  bmp.close();
  try {
    await putRecord(rec);
  } catch (e: unknown) {
    const name = e instanceof DOMException ? e.name : (e as Error)?.name;
    if (name === "QuotaExceededError") {
      throw new Error(
        "Browser storage is full or this file is too large for IndexedDB. Try a smaller export or clear other local data."
      );
    }
    throw e;
  }
  return recordToImageInfo(rec);
}

export async function listLocalImages(): Promise<ImageInfo[]> {
  const db = await openDb();
  const all = await new Promise<LocalImageRecord[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as LocalImageRecord[]) || []);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
  return all
    .map(recordToImageInfo)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function deleteLocalImage(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function getLocalBlob(imageId: string, versionId?: string | null): Promise<Blob | null> {
  const rec = await getLocalRecord(imageId);
  if (!rec) return null;
  if (!versionId) {
    return new Blob([rec.originalData], { type: rec.mime_type || "image/jpeg" });
  }
  const v = rec.versions.find((x) => x.id === versionId);
  if (!v) return null;
  return new Blob([v.data], { type: "image/png" });
}

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { uploadImages } from "../api/images";
import { mapPool } from "../lib/asyncPool";
import {
  LOCAL_PERSIST_CONCURRENCY,
  SNIFF_CONCURRENCY,
} from "../lib/ingestConfig";
import { isLikelyImageFile } from "../lib/imageSniff";
import { saveFileAsLocalImage } from "../lib/localImageStore";
import { isStorageOnlyMode } from "../lib/storageOnlyMode";
import { uploadErrorMessage } from "../lib/uploadErrorMessage";
import { MAX_WORKSPACE_ASSETS, remainingWorkspaceSlots } from "../lib/workspaceLimits";
import { useImageStore } from "../stores/imageStore";
import type { AddSessionImagesResult } from "../stores/imageStore";

export function useWorkspaceFileImport() {
  const [uploading, setUploading] = useState(false);
  const workspaceMode = useImageStore((s) => s.workspaceMode);
  const sessionCount = useImageStore((s) => s.sessionImages.length);

  const slots = workspaceMode ? remainingWorkspaceSlots(sessionCount) : MAX_WORKSPACE_ASSETS;
  const isFull = workspaceMode && sessionCount >= MAX_WORKSPACE_ASSETS;

  const importFiles = useCallback(
    async (acceptedFiles: File[]): Promise<AddSessionImagesResult | null> => {
      if (acceptedFiles.length === 0) return null;

      const state = useImageStore.getState();
      const wm = state.workspaceMode;

      if (!wm && acceptedFiles.length > 1) {
        toast.message("One photo at a time", {
          description: `Using the first of ${acceptedFiles.length} files. Enable workspace batch on the home screen to import many at once.`,
          duration: 5500,
        });
      }

      if (wm) {
        const count = state.sessionImages.length;
        const room = remainingWorkspaceSlots(count);
        if (room <= 0) {
          toast.error("Workspace is full", {
            description: `This batch holds at most ${MAX_WORKSPACE_ASSETS} assets. Remove some or clear the console, then import again.`,
            duration: 6000,
          });
          return null;
        }
      }

      const count = state.sessionImages.length;
      const room = wm ? remainingWorkspaceSlots(count) : 1;
      const batch = acceptedFiles.slice(0, room);
      const overflow = acceptedFiles.length - batch.length;

      setUploading(true);
      try {
        const sniffRows = await mapPool(batch, SNIFF_CONCURRENCY, async (file) => ({
          file,
          ok: await isLikelyImageFile(file),
        }));
        const eligible = sniffRows.filter((r) => r.ok).map((r) => r.file);
        const typeRejected = sniffRows.filter((r) => !r.ok).map((r) => r.file.name);

        if (typeRejected.length > 0) {
          toast.warning(`Skipped ${typeRejected.length} non-image file(s)`, {
            description:
              typeRejected.slice(0, 5).join(" · ") + (typeRejected.length > 5 ? " …" : ""),
            duration: 6500,
          });
        }

        if (eligible.length === 0) {
          toast.error("No images to import", {
            description: "Drop photos or graphics (JPEG, PNG, WebP, HEIC, SVG, TIFF, …).",
            duration: 6000,
          });
          return null;
        }

        if (isStorageOnlyMode()) {
          const rows = await mapPool(eligible, LOCAL_PERSIST_CONCURRENCY, async (f) => {
            try {
              const img = await saveFileAsLocalImage(f);
              return { ok: true as const, img };
            } catch {
              return { ok: false as const, name: f.name };
            }
          });
          const results = rows.filter((r) => r.ok).map((r) => r.img);
          const failures = rows.filter((r) => !r.ok).map((r) => r.name);
          if (failures.length > 0) {
            toast.warning(`Couldn’t import ${failures.length} file(s)`, {
              description: failures.slice(0, 6).join(" · ") + (failures.length > 6 ? " …" : ""),
              duration: 6500,
            });
          }
          if (results.length === 0) return null;
          if (!useImageStore.getState().workspaceMode) {
            useImageStore.getState().setStandardImport(results[0]);
            notifyImportToast(null, overflow, results.length, "standard");
            return { added: 1, droppedDueToCapacity: 0, duplicatesSkipped: 0 };
          }
          const r = useImageStore.getState().addImagesToSession(results);
          notifyImportToast(r, overflow, results.length, "workspace");
          return r;
        }

        const results = await uploadImages(eligible);
        if (results.length === 0) return null;
        if (!useImageStore.getState().workspaceMode) {
          useImageStore.getState().setStandardImport(results[0]);
          notifyImportToast(null, overflow, results.length, "standard");
          return { added: 1, droppedDueToCapacity: 0, duplicatesSkipped: 0 };
        }
        const r = useImageStore.getState().addImagesToSession(results);
        notifyImportToast(r, overflow, results.length, "workspace");
        return r;
      } catch (err: unknown) {
        toast.error("Import failed", {
          description: uploadErrorMessage(err),
          duration: 7000,
        });
        return null;
      } finally {
        setUploading(false);
      }
    },
    [workspaceMode]
  );

  return {
    importFiles,
    uploading,
    slots,
    sessionCount,
    isFull,
    maxAssets: MAX_WORKSPACE_ASSETS,
  };
}

function notifyImportToast(
  r: AddSessionImagesResult | null,
  overflowFromSlice: number,
  uploadedLen: number,
  mode: "standard" | "workspace"
) {
  if (mode === "standard" && uploadedLen > 0) {
    toast.success("Photo ready", {
      description: "Adjust enhancement settings below, then run the pipeline.",
      duration: 4200,
    });
    return;
  }

  if (!r) return;

  const descParts: string[] = [];
  if (r.droppedDueToCapacity > 0) {
    descParts.push(`${r.droppedDueToCapacity} skipped (workspace full)`);
  }
  if (r.duplicatesSkipped > 0) {
    descParts.push(`${r.duplicatesSkipped} duplicate(s) skipped`);
  }
  if (overflowFromSlice > 0) {
    descParts.push(
      `${overflowFromSlice} not taken (only ${MAX_WORKSPACE_ASSETS} slots per workspace)`
    );
  }
  const description = descParts.length > 0 ? descParts.join(" · ") : undefined;

  if (r.added > 0) {
    toast.success(r.added === 1 ? "1 photo added to workspace" : `${r.added} photos added to workspace`, {
      description,
      duration: description ? 5500 : 4000,
    });
    return;
  }
  if (uploadedLen > 0 && description) {
    toast.message("Import finished", { description, duration: 5000 });
    return;
  }
  if (uploadedLen > 0) {
    toast.success("Import complete");
  }
}

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Loader2,
  Wand2,
  AlertCircle,
  ImageIcon,
  CheckCircle2,
  Upload,
  Layers,
  Orbit,
  Maximize2,
  Minimize2,
  Ban,
} from "lucide-react";
import DropZone from "../components/upload/DropZone";
import WorkflowModePicker from "../components/upload/WorkflowModePicker";
import WorkspaceBulkImportStrip from "../components/upload/WorkspaceBulkImportStrip";
import FullscreenImageRegion from "../components/media/FullscreenImageRegion";
import OptimizedImage from "../components/media/OptimizedImage";
import EnhancePanel from "../components/enhance/EnhancePanel";
import UpscalePanel from "../components/upscale/UpscalePanel";
import BeforeAfterSlider from "../components/comparison/BeforeAfterSlider";
import DownloadPanel from "../components/download/DownloadPanel";
import BulkExportBar from "../components/download/BulkExportBar";
import WorkspaceOutputPreviewStrip from "../components/download/WorkspaceOutputPreviewStrip";
import GenerationRecipePanel from "../components/pipeline/GenerationRecipePanel";
import SessionQueuePanel from "../components/batch/SessionQueuePanel";
import WorkspaceArchivePanel from "../components/archive/WorkspaceArchivePanel";
import WorkspaceBulkOriginalsPreview from "../components/workspace/WorkspaceBulkOriginalsPreview";
import WorkspaceBulkResultsPreview, {
  WORKSPACE_COMPARE_ANCHOR,
} from "../components/workspace/WorkspaceBulkResultsPreview";
import { useImageStore } from "../stores/imageStore";
import { useJobPolling } from "../hooks/useJobPolling";
import { useAuthenticatedImage } from "../hooks/useAuthenticatedImage";
import { processImage, estimateCost, getImage, postLocalImprove } from "../api/images";
import { getLatestImageVersion } from "../lib/imageVersions";
import { getHealth } from "../api/health";
import { getCachedImageBlob } from "../lib/imageBlobCache";
import { runLocalEnhancePipeline, runLocalImproveOnBlob } from "../lib/localPipeline";
import { listKeys } from "../api/apiKeys";
import { isStorageOnlyMode } from "../lib/storageOnlyMode";
import { pollJobUntilComplete } from "../lib/pollJob";
import { mapPool } from "../lib/asyncPool";
import { getBatchPipelineConcurrency } from "../lib/batchPipelineConcurrency";
import { buildFullPipelineRequest, buildFullPipelineRequestWithBlob } from "../lib/pipelineParams";
import { commitBrowserImproveBeforeCloud } from "../lib/browserImproveBeforeCloud";
import { consumePipelineCompletionOnce } from "../lib/jobCompletionLedger";
import {
  calibrationIncrementForCompletion,
  resolveCalibrationProviderKind,
} from "../lib/adaptiveCalibration";
import {
  MAX_WORKSPACE_ASSETS,
  WORKSPACE_UI_SHOW_SLASH_TOTAL,
  workspaceQueueCountLabel,
} from "../lib/workspaceLimits";
import { useFullscreen } from "../hooks/useFullscreen";
import { useAdaptiveExperienceStore } from "../stores/adaptiveExperienceStore";
import { toast } from "sonner";
import { toastProcessingError } from "../lib/processingToast";
import type { ImageInfo, JobInfo } from "../types";

const storageOnly = isStorageOnlyMode();
const localDev =
  import.meta.env.VITE_LOCAL_DEV_MODE === "true" || import.meta.env.VITE_LOCAL_DEV_MODE === true || storageOnly;

export default function DashboardPage() {
  const store = useImageStore();
  const { startPolling, stopPolling } = useJobPolling();

  const scrollToPipelineSettings = useCallback(() => {
    window.setTimeout(() => {
      document.getElementById("pipeline-settings")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
  }, []);

  /** After recipe “Edit”, reopen tuning panels (params already applied by the recipe UI). */
  const handleEditPipelineFromRecipe = useCallback(() => {
    stopPolling();
    useImageStore.getState().setCurrentJob(null);
    scrollToPipelineSettings();
  }, [stopPolling, scrollToPipelineSettings]);
  const [processing, setProcessing] = useState(false);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [batchProcessingIds, setBatchProcessingIds] = useState<Set<string>>(() => new Set());
  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
    filename: string;
  } | null>(null);
  /** Workspace rows included in the next batch run (order follows queue). */
  const [batchSelectedIds, setBatchSelectedIds] = useState<Set<string>>(() => new Set());
  const [hasEnhanceKey, setHasEnhanceKey] = useState(false);
  const [hasReplicateKey, setHasReplicateKey] = useState(false);
  const [aiNamingProviders, setAiNamingProviders] = useState<("openai" | "gemini")[]>([]);
  const [pipelineElapsedSec, setPipelineElapsedSec] = useState(0);
  /** Backend LOCAL_DEV_SKIP_UPSCALE — Replicate not required for pipeline. Optimistic default matches `npm run dev`. */
  const [devSkipUpscale, setDevSkipUpscale] = useState(
    () =>
      !storageOnly &&
      (import.meta.env.VITE_LOCAL_DEV_MODE === "true" || import.meta.env.VITE_LOCAL_DEV_MODE === true)
  );

  const replicateOk = hasReplicateKey || devSkipUpscale;

  const displayQueue = useMemo(() => {
    if (store.sessionImages.length > 0) return store.sessionImages;
    if (store.currentImage) return [store.currentImage];
    return [];
  }, [store.sessionImages, store.currentImage]);

  const pendingCount = useMemo(
    () => displayQueue.filter((img) => !img.versions?.length).length,
    [displayQueue]
  );

  const queueIdFingerprint = useMemo(
    () =>
      displayQueue
        .map((i) => i.id)
        .sort()
        .join("\n"),
    [displayQueue]
  );

  useEffect(() => {
    const valid = new Set(displayQueue.map((i) => i.id));
    setBatchSelectedIds((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => {
        if (valid.has(id)) next.add(id);
      });
      if (next.size === prev.size && [...prev].every((id) => next.has(id))) return prev;
      return next;
    });
  }, [queueIdFingerprint, displayQueue]);

  const batchTargetsOrdered = useMemo(
    () => displayQueue.filter((img) => batchSelectedIds.has(img.id)),
    [displayQueue, batchSelectedIds]
  );

  const selectedBatchCount = batchTargetsOrdered.length;
  const selectedPendingCount = useMemo(
    () => batchTargetsOrdered.filter((img) => !img.versions?.length).length,
    [batchTargetsOrdered]
  );

  const bulkExportEligibleImages = useMemo(() => {
    if (!store.workspaceMode) return [];
    return store.sessionImages.filter((img) => (img.versions?.length ?? 0) > 0);
  }, [store.workspaceMode, store.sessionImages]);
  const showBulkExport = bulkExportEligibleImages.length >= 2;

  const workspaceMode = store.workspaceMode;
  const sessionCount = store.sessionImages.length;

  const previewFsRef = useRef<HTMLDivElement>(null);
  /** User clicked Stop — batch skips new work; polling aborts between ticks. */
  const operationCancelRequestedRef = useRef(false);
  const bulkRunningRef = useRef(false);
  useEffect(() => {
    bulkRunningRef.current = bulkRunning;
  }, [bulkRunning]);
  const {
    isFullscreen: isPreviewFullscreen,
    toggle: togglePreviewFullscreen,
    enter: enterPreviewFullscreen,
  } = useFullscreen(previewFsRef, {
    matchDescendants: true,
  });
  const [workspaceBulkFsLayout, setWorkspaceBulkFsLayout] = useState<"grid" | "single">("grid");
  const [workspaceBulkFocusId, setWorkspaceBulkFocusId] = useState<string | null>(null);

  useEffect(() => {
    if (!isPreviewFullscreen) {
      setWorkspaceBulkFsLayout("grid");
      setWorkspaceBulkFocusId(null);
    }
  }, [isPreviewFullscreen]);

  const handleWorkspaceBulkPreviewToggle = useCallback(async () => {
    if (workspaceMode && displayQueue.length > 1 && !isPreviewFullscreen) {
      setWorkspaceBulkFsLayout("grid");
      setWorkspaceBulkFocusId(null);
    }
    await togglePreviewFullscreen();
  }, [workspaceMode, displayQueue.length, isPreviewFullscreen, togglePreviewFullscreen]);

  const handleWorkspaceBulkThumbActivate = useCallback(
    async (id: string) => {
      const st = useImageStore.getState();
      const img = st.sessionImages.find((i) => i.id === id) ?? displayQueue.find((i) => i.id === id);
      if (img) {
        stopPolling();
        st.setCurrentImage(img);
        st.setCurrentJob(null);
      }
      setWorkspaceBulkFocusId(id);
      setWorkspaceBulkFsLayout("single");
      if (!isPreviewFullscreen) {
        await enterPreviewFullscreen();
      }
    },
    [displayQueue, stopPolling, isPreviewFullscreen, enterPreviewFullscreen]
  );

  const handleWorkspaceBulkBackToGrid = useCallback(() => {
    setWorkspaceBulkFsLayout("grid");
    setWorkspaceBulkFocusId(null);
  }, []);

  const handleStopOperation = useCallback(() => {
    operationCancelRequestedRef.current = true;
    stopPolling();
    useImageStore.getState().setCurrentJob(null);
    if (!bulkRunningRef.current) {
      toast.message("Stopped", {
        description: "This tab is no longer watching the job. Cloud work may still finish in the background.",
        duration: 5500,
      });
    }
  }, [stopPolling]);

  const recordCalibrationSignal = useAdaptiveExperienceStore((s) => s.recordCalibrationSignal);
  const getShouldOfferUpgrade = useAdaptiveExperienceStore((s) => s.getShouldOfferUpgrade);
  const upgradePromptDismissed = useAdaptiveExperienceStore((s) => s.upgradePromptDismissed);
  const dismissUpgradePrompt = useAdaptiveExperienceStore((s) => s.dismissUpgradePrompt);

  useEffect(() => {
    const j = store.currentJob;
    if (j?.status !== "completed" || !j.id) return;
    if (!consumePipelineCompletionOnce(j.id)) return;
    const kind = resolveCalibrationProviderKind(store.provider);
    const w = calibrationIncrementForCompletion(j.job_type, kind);
    recordCalibrationSignal(w);
  }, [
    store.currentJob?.status,
    store.currentJob?.id,
    store.currentJob?.job_type,
    store.provider,
    recordCalibrationSignal,
  ]);

  // Load original image via authenticated endpoint
  const { blobUrl: originalImageUrl, loading: imageLoading } = useAuthenticatedImage(
    store.currentImage?.id || null
  );

  useEffect(() => {
    if (storageOnly) {
      setHasEnhanceKey(true);
      setHasReplicateKey(true);
      setAiNamingProviders([]);
      return;
    }

    let cancelled = false;
    const loadKeys = () => {
      listKeys()
        .then((keys) => {
          if (cancelled) return;
          const providers = new Set(keys.map((k) => k.provider));
          setHasEnhanceKey(providers.has("openai") || providers.has("gemini"));
          setHasReplicateKey(providers.has("replicate"));
          const naming = keys
            .map((k) => k.provider)
            .filter((p): p is "openai" | "gemini" => p === "openai" || p === "gemini");
          setAiNamingProviders([...new Set(naming)]);
        })
        .catch(() => {
          if (!cancelled) {
            setHasEnhanceKey(false);
            setHasReplicateKey(false);
            setAiNamingProviders([]);
          }
        });
    };

    loadKeys();
    const onVis = () => {
      if (document.visibilityState === "visible") loadKeys();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [storageOnly]);

  useEffect(() => {
    if (!localDev || storageOnly) {
      setDevSkipUpscale(false);
      return;
    }
    let cancelled = false;
    void getHealth()
      .then((h) => {
        if (!cancelled) setDevSkipUpscale(Boolean(h.local_dev_skip_upscale));
      })
      .catch(() => {
        if (!cancelled) setDevSkipUpscale(false);
      });
    return () => {
      cancelled = true;
    };
  }, [localDev, storageOnly]);

  useEffect(() => {
    if (!storageOnly) return;
    useImageStore.getState().setCostEstimate({
      enhancement_cost: 0,
      upscale_cost: 0,
      total_cost: 0,
      provider: "local",
      model: "browser",
      details: "Runs on this device — no cloud charges.",
    });
  }, [storageOnly]);

  // Estimate cost when settings change (API mode)
  useEffect(() => {
    if (storageOnly) return;
    const timer = setTimeout(async () => {
      if (!store.currentImage) return;
      if (store.provider === "improve") {
        store.setCostEstimate({
          enhancement_cost: 0,
          upscale_cost: 0,
          total_cost: 0,
          provider: "local",
          model: "browser",
          details:
            "Improve runs in your browser — no enhancement API charges. Add keys only if you use OpenAI / Gemini + Replicate.",
        });
        return;
      }
      try {
        const cost = await estimateCost(buildFullPipelineRequest(useImageStore.getState()));
        store.setCostEstimate(cost);
      } catch {
        // Ignore cost estimation errors
      }
    }, 320);
    return () => clearTimeout(timer);
  }, [
    store.currentImage?.id,
    store.provider,
    store.model,
    store.lighting,
    store.qualityPreset,
    store.perspective,
    store.roomType,
    store.customPrompt,
    store.quality,
    store.scaleFactor,
    store.targetResolution,
    store.outputFormat,
    storageOnly,
  ]);

  const handleProcess = async () => {
    if (!store.currentImage) return;

    if (!storageOnly && store.provider !== "improve") {
      if (!hasEnhanceKey || !replicateOk) {
        toast.error("Add an OpenAI or Gemini API key in Settings.", {
          description: devSkipUpscale
            ? "Replicate is optional while local dev skip-upscale is enabled."
            : "Add a Replicate token too for upscaling, or run npm run dev (skip-upscale enabled by default).",
          duration: 8000,
        });
        return;
      }
    }

    operationCancelRequestedRef.current = false;
    setProcessing(true);
    try {
      if (storageOnly) {
        const imageId = store.currentImage.id;
        const now = new Date().toISOString();
        const jobId = crypto.randomUUID();
        store.setCurrentJob({
          id: jobId,
          image_id: imageId,
          job_type: "full_pipeline",
          status: "processing",
          progress_pct: 0,
          error_message: null,
          result_version_id: null,
          started_at: now,
          completed_at: null,
          created_at: now,
        });
        const tick = (pct: number) => {
          store.setCurrentJob({
            id: jobId,
            image_id: imageId,
            job_type: "full_pipeline",
            status: "processing",
            progress_pct: pct,
            error_message: null,
            result_version_id: null,
            started_at: now,
            completed_at: null,
            created_at: now,
          });
        };
        const tuning = {
          lighting: store.lighting,
          qualityPreset: store.qualityPreset,
          perspective: store.perspective,
          roomType: store.roomType,
        };
        const updated = await runLocalEnhancePipeline(imageId, store.scaleFactor, tick, tuning);
        const finalVer = getLatestImageVersion(updated.versions);
        store.setCurrentImage(updated);
        store.upsertSessionImage(updated);
        store.setCurrentJob({
          id: jobId,
          image_id: imageId,
          job_type: "full_pipeline",
          status: "completed",
          progress_pct: 100,
          error_message: null,
          result_version_id: finalVer?.id ?? null,
          started_at: now,
          completed_at: new Date().toISOString(),
          created_at: now,
        });
        toast.success("Done — saved on this device.");
        return;
      }

      if (store.provider === "improve") {
        const imageId = store.currentImage.id;
        const now = new Date().toISOString();
        const jobId = crypto.randomUUID();
        store.setCurrentJob({
          id: jobId,
          image_id: imageId,
          job_type: "full_pipeline",
          status: "processing",
          progress_pct: 0,
          error_message: null,
          result_version_id: null,
          started_at: now,
          completed_at: null,
          created_at: now,
        });
        const tick = (pct: number) => {
          store.setCurrentJob({
            id: jobId,
            image_id: imageId,
            job_type: "full_pipeline",
            status: "processing",
            progress_pct: pct,
            error_message: null,
            result_version_id: null,
            started_at: now,
            completed_at: null,
            created_at: now,
          });
        };
        const tuning = {
          lighting: store.lighting,
          qualityPreset: store.qualityPreset,
          perspective: store.perspective,
          roomType: store.roomType,
        };
        const blob = await getCachedImageBlob(imageId, null);
        const finalBlob = await runLocalImproveOnBlob(blob, store.scaleFactor, tick, tuning);
        const updated = await postLocalImprove(imageId, finalBlob);
        let merged = updated;
        try {
          merged = await getImage(imageId);
        } catch {
          /* use POST body if GET fails */
        }
        const finalVer = getLatestImageVersion(merged.versions);
        store.setCurrentImage(merged);
        store.upsertSessionImage(merged);
        store.setCurrentJob({
          id: jobId,
          image_id: imageId,
          job_type: "full_pipeline",
          status: "completed",
          progress_pct: 100,
          error_message: null,
          result_version_id: finalVer?.id ?? null,
          started_at: now,
          completed_at: new Date().toISOString(),
          created_at: now,
        });
        toast.success("Done — improved in your browser and saved.");
        return;
      }

      const imageId = store.currentImage.id;
      const now = new Date().toISOString();
      const preJobId = crypto.randomUUID();
      const tuning = {
        lighting: store.lighting,
        qualityPreset: store.qualityPreset,
        perspective: store.perspective,
        roomType: store.roomType,
      };
      store.setCurrentJob({
        id: preJobId,
        image_id: imageId,
        job_type: "full_pipeline",
        status: "processing",
        progress_pct: 0,
        error_message: null,
        result_version_id: null,
        started_at: now,
        completed_at: null,
        created_at: now,
      });
      const tickPre = (pct: number) => {
        store.setCurrentJob({
          id: preJobId,
          image_id: imageId,
          job_type: "full_pipeline",
          status: "processing",
          progress_pct: Math.min(28, Math.round((pct / 100) * 28)),
          error_message: null,
          result_version_id: null,
          started_at: now,
          completed_at: null,
          created_at: now,
        });
      };
      const { image: merged, improveVersionId } = await commitBrowserImproveBeforeCloud(
        imageId,
        store.scaleFactor,
        tuning,
        tickPre
      );
      store.setCurrentImage(merged);
      store.upsertSessionImage(merged);

      const blob = await getCachedImageBlob(imageId, null);
      const params = await buildFullPipelineRequestWithBlob(useImageStore.getState(), blob);
      const job = await processImage(imageId, {
        ...params,
        improve_input_version_id: improveVersionId,
      });
      store.setCurrentJob(job);
      startPolling(job.id, imageId);
      toast.success("Processing started!", {
        description: "Browser Improve finished — cloud enhance + upscale are running.",
        duration: 4800,
      });
    } catch (err: unknown) {
      toastProcessingError(err, "Couldn't start processing");
    } finally {
      setProcessing(false);
    }
  };

  const handleRemoveAsset = (id: string) => {
    if (store.sessionImages.length === 0 && store.currentImage?.id === id) {
      stopPolling();
      store.reset();
      return;
    }
    store.removeSessionImage(id);
  };

  const toggleBatchSelect = useCallback((id: string) => {
    setBatchSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const onBatchSelectAll = useCallback(() => {
    setBatchSelectedIds(new Set(displayQueue.map((i) => i.id)));
  }, [displayQueue]);

  const onBatchSelectPendingOnly = useCallback(() => {
    setBatchSelectedIds(new Set(displayQueue.filter((i) => !i.versions?.length).map((i) => i.id)));
  }, [displayQueue]);

  const onBatchClearSelection = useCallback(() => {
    setBatchSelectedIds(new Set());
  }, []);

  /** Local / improve: sequential. Remote full pipeline: bounded concurrent API jobs. */
  const runBatchOnTargets = async (targets: ImageInfo[]) => {
    if (targets.length === 0) return;
    if (!storageOnly && store.provider !== "improve" && (!hasEnhanceKey || !replicateOk)) {
      toast.error("Add API keys in Settings before running batch jobs.", {
        description: devSkipUpscale ? "Replicate is optional in current local dev mode." : undefined,
      });
      return;
    }

    operationCancelRequestedRef.current = false;
    setBulkRunning(true);
    stopPolling();

    let batchPartialSuccessCount = 0;

    try {
      if (storageOnly || store.provider === "improve") {
        for (let i = 0; i < targets.length; i++) {
          if (operationCancelRequestedRef.current) {
            break;
          }
          const img = targets[i];
          setBatchProcessingIds(new Set([img.id]));
          setBatchProgress({ current: i + 1, total: targets.length, filename: img.original_filename });
          store.setCurrentImage(img);

          if (storageOnly) {
            const now = new Date().toISOString();
            const jobId = crypto.randomUUID();
            store.setCurrentJob({
              id: jobId,
              image_id: img.id,
              job_type: "full_pipeline",
              status: "processing",
              progress_pct: 0,
              error_message: null,
              result_version_id: null,
              started_at: now,
              completed_at: null,
              created_at: now,
            });
            const tick = (pct: number) => {
              store.setCurrentJob({
                id: jobId,
                image_id: img.id,
                job_type: "full_pipeline",
                status: "processing",
                progress_pct: pct,
                error_message: null,
                result_version_id: null,
                started_at: now,
                completed_at: null,
                created_at: now,
              });
            };
            const tuning = {
              lighting: store.lighting,
              qualityPreset: store.qualityPreset,
              perspective: store.perspective,
              roomType: store.roomType,
            };
            const updated = await runLocalEnhancePipeline(img.id, store.scaleFactor, tick, tuning);
            const finalVer = getLatestImageVersion(updated.versions);
            store.upsertSessionImage(updated);
            store.setCurrentImage(updated);
            store.setCurrentJob({
              id: jobId,
              image_id: img.id,
              job_type: "full_pipeline",
              status: "completed",
              progress_pct: 100,
              error_message: null,
              result_version_id: finalVer?.id ?? null,
              started_at: now,
              completed_at: new Date().toISOString(),
              created_at: now,
            });
          } else if (store.provider === "improve") {
            const now = new Date().toISOString();
            const jobId = crypto.randomUUID();
            store.setCurrentJob({
              id: jobId,
              image_id: img.id,
              job_type: "full_pipeline",
              status: "processing",
              progress_pct: 0,
              error_message: null,
              result_version_id: null,
              started_at: now,
              completed_at: null,
              created_at: now,
            });
            const tick = (pct: number) => {
              store.setCurrentJob({
                id: jobId,
                image_id: img.id,
                job_type: "full_pipeline",
                status: "processing",
                progress_pct: pct,
                error_message: null,
                result_version_id: null,
                started_at: now,
                completed_at: null,
                created_at: now,
              });
            };
            const tuning = {
              lighting: store.lighting,
              qualityPreset: store.qualityPreset,
              perspective: store.perspective,
              roomType: store.roomType,
            };
            const blob = await getCachedImageBlob(img.id, null);
            const finalBlob = await runLocalImproveOnBlob(blob, store.scaleFactor, tick, tuning);
            const updated = await postLocalImprove(img.id, finalBlob);
            let merged = updated;
            try {
              merged = await getImage(img.id);
            } catch {
              /* use POST body if GET fails */
            }
            const finalVer = getLatestImageVersion(merged.versions);
            store.upsertSessionImage(merged);
            store.setCurrentImage(merged);
            store.setCurrentJob({
              id: jobId,
              image_id: img.id,
              job_type: "full_pipeline",
              status: "completed",
              progress_pct: 100,
              error_message: null,
              result_version_id: finalVer?.id ?? null,
              started_at: now,
              completed_at: new Date().toISOString(),
              created_at: now,
            });
          }
          batchPartialSuccessCount += 1;
        }
        if (!operationCancelRequestedRef.current) {
          toast.success(`Batch finished · ${targets.length} asset(s).`);
        }
      } else {
        type ItemOk = { ok: true; updated: ImageInfo; job: JobInfo };
        type ItemFail = { ok: false; filename: string; error?: string | null; cancelled?: boolean };
        type ItemResult = ItemOk | ItemFail;

        setBatchProgress({ current: 0, total: targets.length, filename: "" });
        const concurrency = getBatchPipelineConcurrency();
        let done = 0;

        const itemResults = await mapPool(targets, concurrency, async (img): Promise<ItemResult> => {
          if (operationCancelRequestedRef.current) {
            return { ok: false, filename: img.original_filename, cancelled: true };
          }
          setBatchProcessingIds((prev) => new Set(prev).add(img.id));
          try {
            const tuning = {
              lighting: store.lighting,
              qualityPreset: store.qualityPreset,
              perspective: store.perspective,
              roomType: store.roomType,
            };
            const { image: merged, improveVersionId } = await commitBrowserImproveBeforeCloud(
              img.id,
              store.scaleFactor,
              tuning,
              () => {}
            );
            store.upsertSessionImage(merged);
            if (operationCancelRequestedRef.current) {
              return { ok: false, filename: img.original_filename, cancelled: true };
            }
            const blob = await getCachedImageBlob(img.id, null);
            const params = await buildFullPipelineRequestWithBlob(useImageStore.getState(), blob);
            const job = await processImage(img.id, {
              ...params,
              improve_input_version_id: improveVersionId,
            });
            if (operationCancelRequestedRef.current) {
              return { ok: false, filename: img.original_filename, cancelled: true };
            }
            const final = await pollJobUntilComplete(
              job.id,
              undefined,
              () => operationCancelRequestedRef.current
            );
            if (final.status === "failed") {
              toast.error(final.error_message || `Failed: ${img.original_filename}`);
              return { ok: false, filename: img.original_filename, error: final.error_message };
            }
            const updated = await getImage(img.id);
            store.upsertSessionImage(updated);
            done += 1;
            setBatchProgress({
              current: done,
              total: targets.length,
              filename: img.original_filename,
            });
            return { ok: true, updated, job: final };
          } catch (err: unknown) {
            if (err instanceof DOMException && err.name === "AbortError") {
              return { ok: false, filename: img.original_filename, cancelled: true };
            }
            toastProcessingError(err, `Batch: ${img.original_filename}`);
            return { ok: false, filename: img.original_filename };
          } finally {
            setBatchProcessingIds((prev) => {
              const next = new Set(prev);
              next.delete(img.id);
              return next;
            });
          }
        });

        let lastCompletedJob: JobInfo | null = null;
        let lastUpdatedImage: ImageInfo | null = null;
        for (const r of itemResults) {
          if (r.ok) {
            lastCompletedJob = r.job;
            lastUpdatedImage = r.updated;
          }
        }
        if (lastCompletedJob && lastUpdatedImage && !operationCancelRequestedRef.current) {
          store.setCurrentImage(lastUpdatedImage);
          store.setCurrentJob(lastCompletedJob);
        }

        const okN = itemResults.filter((r): r is ItemOk => r.ok).length;
        batchPartialSuccessCount = okN;
        const failN = itemResults.filter((r) => !r.ok && !r.cancelled).length;

        if (!operationCancelRequestedRef.current) {
          if (failN === 0) {
            toast.success(`Batch finished · ${okN} asset(s).`);
          } else if (okN === 0) {
            toast.error(`Batch finished · all ${failN} failed.`);
          } else {
            toast.message(`Batch finished · ${okN} ok, ${failN} failed`, { duration: 9000 });
          }
        }
      }
    } catch (err: unknown) {
      toastProcessingError(err, "Batch stopped");
    } finally {
      const stopped = operationCancelRequestedRef.current;
      operationCancelRequestedRef.current = false;
      setBatchProcessingIds(new Set());
      setBatchProgress(null);
      setBulkRunning(false);
      if (stopped) {
        toast.message("Batch stopped", {
          description:
            batchPartialSuccessCount > 0
              ? `${batchPartialSuccessCount} asset(s) finished; no more will start from this run. In-flight API jobs may still complete.`
              : "No further assets will run from this batch.",
          duration: 7000,
        });
      }
    }
  };

  const handleBatchProcessSelected = async () => {
    if (batchTargetsOrdered.length === 0) {
      toast.error("No assets selected for batch", {
        description: "Use the checkboxes in the queue, or Select pending / Select all.",
      });
      return;
    }
    await runBatchOnTargets(batchTargetsOrdered);
  };

  const handleBatchProcessAllPendingShortcut = async () => {
    const targets = displayQueue.filter((img) => !img.versions?.length);
    if (targets.length === 0) {
      toast.error("No pending assets in the queue.");
      return;
    }
    await runBatchOnTargets(targets);
  };

  const handleBatchProcessEntireQueueShortcut = async () => {
    if (displayQueue.length === 0) {
      toast.error("Queue is empty.");
      return;
    }
    await runBatchOnTargets([...displayQueue]);
  };

  const isJobActive =
    store.currentJob?.status === "pending" || store.currentJob?.status === "processing";
  const pipelineBusy = isJobActive || bulkRunning || processing;
  const isJobCompleted = store.currentJob?.status === "completed";
  const isJobFailed = store.currentJob?.status === "failed";

  const currentImage = store.currentImage;
  const job = store.currentJob;
  const versionsOnCurrent = currentImage?.versions ?? [];
  const latestOutputVersion = getLatestImageVersion(versionsOnCurrent);
  const jobBelongsToCurrentImage = !!(job && currentImage && job.image_id === currentImage.id);
  const processingThisImage = isJobActive && jobBelongsToCurrentImage;
  const versionFromJob =
    jobBelongsToCurrentImage && job?.result_version_id
      ? versionsOnCurrent.find((v) => v.id === job.result_version_id)
      : undefined;
  /** Compare slider: use job-linked version when it matches this asset; else latest output (workspace review). Hidden while this asset is actively processing. */
  const resultVersion = processingThisImage ? undefined : (versionFromJob ?? latestOutputVersion);
  const showDownloadForCurrent =
    !!store.currentImage &&
    (store.currentImage.versions?.length ?? 0) > 0 &&
    !isJobActive &&
    !bulkRunning &&
    !processing;

  useEffect(() => {
    if (!isJobActive || !store.currentJob?.id) {
      setPipelineElapsedSec(0);
      return;
    }
    const t0 = Date.now();
    setPipelineElapsedSec(0);
    const id = window.setInterval(() => {
      setPipelineElapsedSec(Math.floor((Date.now() - t0) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [isJobActive, store.currentJob?.id]);

  // Progress bar label
  const getProgressLabel = (pct: number) => {
    if (pct < 10) return "Starting pipeline…";
    if (pct < 40) {
      return storageOnly
        ? "Enhancing locally…"
        : "Enhancing with AI… (often 1–8 min — keep this tab open)";
    }
    if (pct < 50) return storageOnly ? "Enhancing locally…" : "Saving enhanced image…";
    if (pct < 85) return storageOnly ? "Upscaling in your browser…" : "Upscaling with Replicate…";
    if (pct < 100) return "Saving final image…";
    return "Done";
  };

  return (
    <div className="min-h-full min-w-0 bg-white">
      <div className="max-w-[1600px] mx-auto px-3 py-4 sm:px-6 sm:py-6 md:px-8 md:py-10 pb-16 sm:pb-20">
        <header className="mb-6 sm:mb-8 md:mb-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
            <div className="max-w-3xl min-w-0">
              <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500 mb-2">
                <Orbit className="w-3.5 h-3.5 text-black shrink-0" strokeWidth={2} />
                Operations console
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight text-black text-balance">
                Listing imagery at production scale
              </h1>
              <p className="mt-2 sm:mt-3 text-sm md:text-base text-neutral-600 leading-relaxed">
                {storageOnly ? (
                  <>
                    <span className="font-medium text-black">Air-gapped workspace.</span> Queue hundreds of
                    frames locally, run deterministic canvas processing, export without touching a network.
                  </>
                ) : (
                  <>
                    <span className="font-medium text-black">Enterprise-grade throughput.</span> Import a
                    property pack, tune one profile, then fan out the same pipeline across your queue with
                    auditable status per asset.
                  </>
                )}
              </p>
            </div>
            {store.currentImage && displayQueue.length > 0 && (
              <div className="flex flex-wrap gap-2 sm:justify-end sm:shrink-0">
                {workspaceMode ? (
                  <span
                    className="inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 font-data"
                    title="Workspace batch overview"
                  >
                    <span className="inline-flex items-center gap-1 shrink-0 text-black">
                      <Layers className="w-3.5 h-3.5" strokeWidth={2} />
                      {sessionCount || displayQueue.length} in workspace
                    </span>
                    {WORKSPACE_UI_SHOW_SLASH_TOTAL ? (
                      <>
                        <span className="text-neutral-300 hidden sm:inline" aria-hidden>
                          ·
                        </span>
                        <span
                          className="tabular-nums text-neutral-700 shrink-0"
                          title="Assets in queue / workspace maximum"
                        >
                          {workspaceQueueCountLabel(sessionCount || displayQueue.length)}
                        </span>
                      </>
                    ) : null}
                    <span className="text-neutral-300" aria-hidden>
                      ·
                    </span>
                    <span className="tabular-nums text-black shrink-0">{pendingCount} pending</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-800">
                    Standard · single photo
                  </span>
                )}
              </div>
            )}
          </div>
        </header>

        {getShouldOfferUpgrade() && !upgradePromptDismissed && (
          <div className="mb-6 rounded-2xl border border-neutral-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-black">Workspace calibration is complete</p>
              <p className="text-xs text-neutral-600 mt-1 leading-relaxed">
                Weighted calibration from your runs is full. Adopt tier 2 when you want smarter defaults—or keep
                classic pinned in Settings.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                to="/settings"
                className="px-4 py-2 rounded-xl bg-black text-white text-sm font-semibold hover:bg-neutral-800 transition-colors text-center"
              >
                Open Settings
              </Link>
              <button
                type="button"
                onClick={() => dismissUpgradePrompt()}
                className="px-4 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {!store.currentImage && <DropZone />}

        {store.currentImage && (
          <div
            className={
              workspaceMode && displayQueue.length > 1
                ? "lg:grid lg:grid-cols-[minmax(280px,360px)_1fr] lg:gap-8 xl:grid-cols-[minmax(300px,380px)_1fr]"
                : ""
            }
          >
            {workspaceMode && displayQueue.length > 1 && (
              <>
                <div className="order-2 mb-4 min-w-0 w-full lg:hidden">
                  <details className="group rounded-2xl border border-neutral-200/90 bg-white overflow-hidden">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-sm font-semibold text-black marker:hidden [&::-webkit-details-marker]:hidden">
                      <span className="inline-flex items-center gap-2 min-w-0">
                        <Layers className="h-4 w-4 shrink-0 text-neutral-600" strokeWidth={2} />
                        <span className="truncate">Asset queue</span>
                      </span>
                      <span className="shrink-0 text-xs font-medium font-data tabular-nums text-neutral-500">
                        {displayQueue.length}
                      </span>
                    </summary>
                    <div className="border-t border-neutral-100">
                      <SessionQueuePanel
                        assets={displayQueue}
                        selectedId={store.currentImage?.id ?? null}
                        processingAssetIds={batchProcessingIds}
                        jobActive={isJobActive}
                        jobImageId={store.currentJob?.image_id ?? null}
                        onSelect={(id) => {
                          const img = displayQueue.find((i) => i.id === id);
                          if (img) {
                            store.setCurrentImage(img);
                            store.setCurrentJob(null);
                          }
                        }}
                        onRemove={handleRemoveAsset}
                        disabled={pipelineBusy}
                        batchSelectedIds={batchSelectedIds}
                        onToggleBatchSelect={toggleBatchSelect}
                        onBatchSelectAll={onBatchSelectAll}
                        onBatchSelectPendingOnly={onBatchSelectPendingOnly}
                        onBatchClearSelection={onBatchClearSelection}
                        variant="embedded"
                      />
                    </div>
                  </details>
                </div>
                <aside className="mb-6 hidden lg:mb-0 lg:block lg:sticky lg:top-6 lg:self-start order-2 lg:order-1">
                  <SessionQueuePanel
                    assets={displayQueue}
                    selectedId={store.currentImage?.id ?? null}
                    processingAssetIds={batchProcessingIds}
                    jobActive={isJobActive}
                    jobImageId={store.currentJob?.image_id ?? null}
                    onSelect={(id) => {
                      const img = displayQueue.find((i) => i.id === id);
                      if (img) {
                        store.setCurrentImage(img);
                        store.setCurrentJob(null);
                      }
                    }}
                    onRemove={handleRemoveAsset}
                    disabled={pipelineBusy}
                    batchSelectedIds={batchSelectedIds}
                    onToggleBatchSelect={toggleBatchSelect}
                    onBatchSelectAll={onBatchSelectAll}
                    onBatchSelectPendingOnly={onBatchSelectPendingOnly}
                    onBatchClearSelection={onBatchClearSelection}
                  />
                </aside>
              </>
            )}

            <div
              className={`space-y-4 sm:space-y-5 min-w-0 ${workspaceMode && displayQueue.length > 1 ? "order-1 lg:order-2" : ""}`}
            >
          {storageOnly && (
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-5 py-4 text-sm text-neutral-900">
              <p className="font-semibold text-black">Local execution region</p>
              <p className="mt-2 text-neutral-700 leading-relaxed">
                Assets persist in <strong className="text-black">IndexedDB</strong> on this workstation. For
                managed cloud inference (OpenAI / Gemini / Replicate), run{" "}
                <code className="rounded-md bg-white px-1.5 py-0.5 text-xs font-data text-black border border-neutral-200">
                  npm run dev:full
                </code>
                .
              </p>
            </div>
          )}
          <div className="max-w-3xl mb-4">
            <WorkflowModePicker variant="compact" />
          </div>

          {!storageOnly && store.provider !== "improve" && !hasEnhanceKey && (
            <div className="rounded-2xl border border-neutral-300 bg-neutral-100 px-5 py-4 text-sm text-black">
              <p className="font-semibold text-black">Connect model endpoints</p>
              <p className="mt-2 text-neutral-800 leading-relaxed">
                Add <strong>OpenAI</strong> or <strong>Gemini</strong> for generative enhancement (rooms,
                lighting, style).{" "}
                <Link
                  to="/settings"
                  className="font-semibold text-black underline decoration-neutral-400 underline-offset-2 hover:decoration-black"
                >
                  Open Settings
                </Link>
              </p>
            </div>
          )}
          {!storageOnly && store.provider !== "improve" && hasEnhanceKey && !hasReplicateKey && !devSkipUpscale && (
            <div className="rounded-2xl border border-neutral-300 bg-neutral-100 px-5 py-4 text-sm text-black">
              <p className="font-semibold text-black">Add Replicate for upscaling</p>
              <p className="mt-2 text-neutral-800 leading-relaxed">
                Add a <strong>Replicate</strong> token for Real-ESRGAN upscaling, or use{" "}
                <code className="rounded bg-white px-1 font-data text-xs border border-neutral-200">
                  npm run dev
                </code>{" "}
                from the repo root (skips upscale in local dev so you only need OpenAI/Gemini).{" "}
                <Link
                  to="/settings"
                  className="font-semibold text-black underline decoration-neutral-400 underline-offset-2 hover:decoration-black"
                >
                  Open Settings
                </Link>
              </p>
            </div>
          )}
          {localDev && !storageOnly && store.provider !== "improve" && devSkipUpscale && hasEnhanceKey && (
            <div className="rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4 text-sm text-sky-950">
              <p className="font-semibold text-sky-950">Local dev: upscale skipped</p>
              <p className="mt-2 text-sky-900 leading-relaxed">
                The API is running with <span className="font-mono text-xs">LOCAL_DEV_SKIP_UPSCALE</span>. You
                get the <strong>enhanced</strong> image as the result (no Replicate billing). For full
                upscaling, set{" "}
                <code className="rounded bg-white px-1 font-data text-xs border border-sky-200">
                  LOCAL_DEV_SKIP_UPSCALE=false
                </code>{" "}
                on the backend and add Replicate credit.
              </p>
            </div>
          )}

          {workspaceMode && <WorkspaceBulkImportStrip disabled={pipelineBusy} />}

          <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
            <div className="flex flex-col gap-2.5 border-b border-neutral-200 bg-neutral-50 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3">
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-black text-sm truncate">
                  {store.currentImage.original_filename}
                </h3>
                <p className="text-[11px] text-neutral-500 font-data tabular-nums mt-0.5">
                  {workspaceMode && displayQueue.length > 1 ? (
                    <span className="text-neutral-600">{displayQueue.length} photos · grid below · </span>
                  ) : null}
                  {store.currentImage.width} × {store.currentImage.height}px
                  {store.currentImage.file_size_bytes &&
                    ` · ${(store.currentImage.file_size_bytes / 1024 / 1024).toFixed(1)} MB`}
                </p>
              </div>
              <div className="flex flex-wrap items-stretch gap-2 sm:shrink-0 sm:justify-end">
                <button
                  type="button"
                  onClick={() =>
                    workspaceMode && displayQueue.length > 1
                      ? void handleWorkspaceBulkPreviewToggle()
                      : void togglePreviewFullscreen()
                  }
                  className="flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-50 hover:text-black transition-colors sm:flex-initial sm:justify-center"
                  title={
                    isPreviewFullscreen
                      ? "Exit full screen"
                      : workspaceMode && displayQueue.length > 1
                        ? "Full screen · all photos in a grid"
                        : "Full screen preview"
                  }
                >
                  {isPreviewFullscreen ? (
                    <>
                      <Minimize2 className="w-3.5 h-3.5 shrink-0" />
                      <span className="hidden sm:inline">Exit full screen</span>
                      <span className="sm:hidden">Exit</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-3.5 h-3.5 shrink-0" />
                      {workspaceMode && displayQueue.length > 1 ? (
                        <>
                          <span className="hidden sm:inline">Full screen (all)</span>
                          <span className="sm:hidden">All photos</span>
                        </>
                      ) : (
                        "Full screen"
                      )}
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stopPolling();
                    store.reset();
                  }}
                  className="flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-neutral-500 hover:bg-neutral-100 hover:text-black transition-colors sm:flex-initial"
                >
                  <Upload className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{workspaceMode ? "Clear workspace" : "Start over"}</span>
                </button>
              </div>
            </div>

            {/* Image display */}
            <div
              ref={previewFsRef}
              className={`p-2 sm:p-4 ${isPreviewFullscreen ? "min-h-[100dvh] flex flex-col bg-black" : ""}`}
            >
              {workspaceMode && displayQueue.length > 1 ? (
                <WorkspaceBulkOriginalsPreview
                  images={displayQueue}
                  selectedId={store.currentImage?.id ?? ""}
                  isFullscreen={isPreviewFullscreen}
                  layout={workspaceBulkFsLayout}
                  focusImageId={workspaceBulkFocusId}
                  onThumbnailActivate={(id) => void handleWorkspaceBulkThumbActivate(id)}
                  onBackToFullscreenGrid={handleWorkspaceBulkBackToGrid}
                />
              ) : resultVersion ? (
                <BeforeAfterSlider
                  imageId={store.currentImage.id}
                  resultVersionId={resultVersion.id}
                  resultVersionType={resultVersion.version_type}
                  aiNamingProvider={
                    aiNamingProviders.includes("gemini")
                      ? "gemini"
                      : aiNamingProviders.includes("openai")
                        ? "openai"
                        : null
                  }
                  originalFilename={store.currentImage.original_filename}
                  originalMeta={{
                    width: store.currentImage.width,
                    height: store.currentImage.height,
                    fileSizeBytes: store.currentImage.file_size_bytes,
                  }}
                  resultMeta={{
                    width: resultVersion.width,
                    height: resultVersion.height,
                    fileSizeBytes: resultVersion.file_size_bytes,
                    scaleFactor: resultVersion.scale_factor,
                  }}
                  viewportMode={isPreviewFullscreen ? "fullscreen" : "default"}
                  defaultViewMode="sideBySide"
                />
              ) : (
                <div
                  className={`relative rounded-xl overflow-hidden flex items-center justify-center min-h-[200px] ${
                    isPreviewFullscreen ? "bg-neutral-900 flex-1" : "bg-neutral-100"
                  }`}
                >
                  {imageLoading ? (
                    <div className="flex flex-col items-center gap-3 py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-black" />
                      <p className="text-sm text-neutral-500">Loading asset…</p>
                    </div>
                  ) : originalImageUrl ? (
                    <FullscreenImageRegion
                      className={`w-full min-h-[200px] flex items-center justify-center ${
                        isPreviewFullscreen ? "min-h-[calc(100dvh-8rem)]" : ""
                      }`}
                    >
                      <OptimizedImage
                        priority
                        src={originalImageUrl}
                        alt={store.currentImage.original_filename}
                        className={`w-auto max-w-full object-contain rounded-lg ${
                          isPreviewFullscreen
                            ? "max-h-[calc(100dvh-6rem)]"
                            : "max-h-[min(450px,52dvh)] sm:max-h-[450px]"
                        }`}
                      />
                    </FullscreenImageRegion>
                  ) : (
                    <div className="flex flex-col items-center gap-3 py-12">
                      <ImageIcon className="w-12 h-12 text-neutral-300" />
                      <p className="text-sm text-neutral-500">Preview unavailable</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            {workspaceMode && displayQueue.length > 1 && bulkExportEligibleImages.length > 0 && (
              <WorkspaceBulkResultsPreview
                images={bulkExportEligibleImages}
                selectedId={store.currentImage?.id ?? ""}
                onSelect={(id) => {
                  const st = useImageStore.getState();
                  const img = st.sessionImages.find((i) => i.id === id);
                  if (!img) return;
                  stopPolling();
                  st.setCurrentImage(img);
                  st.setCurrentJob(null);
                }}
              />
            )}
            {workspaceMode && displayQueue.length > 1 && resultVersion && store.currentImage && (
              <div
                id={WORKSPACE_COMPARE_ANCHOR}
                className="scroll-mt-4 border-t border-neutral-200 bg-neutral-50/80 p-3 sm:p-4"
              >
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Compare · current selection
                </p>
                <p className="mb-3 text-xs text-neutral-600 leading-snug">
                  Default is <span className="font-medium text-black">side by side</span> (original | improved). Use{" "}
                  <span className="font-medium text-black">Slider</span> if you prefer a single draggable reveal.
                </p>
                <BeforeAfterSlider
                  imageId={store.currentImage.id}
                  resultVersionId={resultVersion.id}
                  resultVersionType={resultVersion.version_type}
                  aiNamingProvider={
                    aiNamingProviders.includes("gemini")
                      ? "gemini"
                      : aiNamingProviders.includes("openai")
                        ? "openai"
                        : null
                  }
                  originalFilename={store.currentImage.original_filename}
                  originalMeta={{
                    width: store.currentImage.width,
                    height: store.currentImage.height,
                    fileSizeBytes: store.currentImage.file_size_bytes,
                  }}
                  resultMeta={{
                    width: resultVersion.width,
                    height: resultVersion.height,
                    fileSizeBytes: resultVersion.file_size_bytes,
                    scaleFactor: resultVersion.scale_factor,
                  }}
                  viewportMode="default"
                  defaultViewMode="sideBySide"
                />
              </div>
            )}
          </div>

          {resultVersion && store.currentImage && (
            <GenerationRecipePanel version={resultVersion} onEditSettings={handleEditPipelineFromRecipe} />
          )}

          {/* Enhancement Controls */}
          {!isJobActive && !isJobCompleted && !bulkRunning && (
            <div id="pipeline-settings" className="grid grid-cols-1 lg:grid-cols-2 gap-6 scroll-mt-8">
              <EnhancePanel />
              <UpscalePanel />
            </div>
          )}

          {/* Cost Estimate + Process + batch */}
          {!isJobActive && !isJobCompleted && !bulkRunning && (
            <div className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-6">
              {store.costEstimate && (
                <div className="mb-5 p-4 rounded-xl border border-neutral-200 bg-neutral-50">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                        Estimated unit cost
                      </p>
                      <p className="text-2xl font-semibold text-black font-data tabular-nums mt-1">
                        ${store.costEstimate.total_cost.toFixed(4)}
                      </p>
                    </div>
                    {workspaceMode && displayQueue.length > 1 && !storageOnly && (
                      <div className="text-right min-w-0">
                        {selectedBatchCount > 0 && selectedPendingCount > 0 ? (
                          <>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                              Selection · {selectedPendingCount} pending (of {selectedBatchCount} selected)
                            </p>
                            <p className="text-lg font-semibold text-black font-data tabular-nums">
                              ~${(store.costEstimate.total_cost * selectedPendingCount).toFixed(2)}
                            </p>
                            <p className="text-[10px] text-neutral-500 mt-1 max-w-[14rem] ml-auto leading-snug">
                              Re-runs on completed rows use similar API usage; this line counts only never-processed
                              rows in your selection.
                            </p>
                          </>
                        ) : selectedBatchCount > 0 && selectedPendingCount === 0 ? (
                          <>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                              Selection · {selectedBatchCount} re-run(s), 0 new
                            </p>
                            <p className="text-lg font-semibold text-black font-data tabular-nums">
                              ~${(store.costEstimate.total_cost * selectedBatchCount).toFixed(2)}
                            </p>
                            <p className="text-[10px] text-neutral-500 mt-1 max-w-[14rem] ml-auto leading-snug">
                              Rough ceiling: unit cost × selected rows (all already have outputs).
                            </p>
                          </>
                        ) : pendingCount > 0 ? (
                          <>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                              All pending in queue ({pendingCount})
                            </p>
                            <p className="text-lg font-semibold text-black font-data tabular-nums">
                              ~${(store.costEstimate.total_cost * pendingCount).toFixed(2)}
                            </p>
                          </>
                        ) : null}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500 mt-2">{store.costEstimate.details}</p>
                </div>
              )}
              <div className="flex flex-col flex-wrap gap-3 lg:flex-row">
                <button
                  type="button"
                  onClick={handleProcess}
                  disabled={processing || bulkRunning}
                  className={`flex-1 min-h-[48px] py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${
                    workspaceMode && displayQueue.length > 1
                      ? "border border-neutral-300 bg-white text-black hover:bg-neutral-50"
                      : "bg-black text-white hover:bg-neutral-800"
                  }`}
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Starting…
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-5 h-5" />
                      Run pipeline · current asset
                    </>
                  )}
                </button>
                {workspaceMode && displayQueue.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleBatchProcessSelected()}
                      disabled={processing || bulkRunning || selectedBatchCount === 0}
                      className="flex-1 min-h-[48px] py-3.5 rounded-xl font-semibold text-sm bg-black text-white hover:bg-neutral-800 disabled:opacity-45 transition-colors flex items-center justify-center gap-2"
                    >
                      <Layers className="w-5 h-5 text-white" />
                      Run batch on selected ({selectedBatchCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleBatchProcessAllPendingShortcut()}
                      disabled={processing || bulkRunning || pendingCount === 0}
                      className="flex-1 min-h-[48px] py-3.5 rounded-xl font-semibold text-sm border border-neutral-300 bg-white text-black hover:bg-neutral-50 disabled:opacity-45 transition-colors flex items-center justify-center gap-2"
                    >
                      All pending ({pendingCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleBatchProcessEntireQueueShortcut()}
                      disabled={processing || bulkRunning}
                      className="py-3.5 px-3 rounded-xl text-xs font-semibold text-neutral-500 border border-dashed border-neutral-400 hover:border-black hover:text-black disabled:opacity-45 transition-colors sm:max-w-[11rem]"
                      title="Re-run pipeline on every asset in the workspace queue"
                    >
                      Entire queue ({displayQueue.length})
                    </button>
                  </>
                )}
              </div>
              {workspaceMode && displayQueue.length > 1 && (
                <p className="text-[11px] text-neutral-500 mt-3 leading-relaxed">
                  Check rows in the queue, then <strong className="text-neutral-700">Run batch on selected</strong>{" "}
                  to process only those assets in order
                  {WORKSPACE_UI_SHOW_SLASH_TOTAL ? ` (up to ${MAX_WORKSPACE_ASSETS} in a workspace)` : " (large queues supported)"}.{" "}
                  <strong className="text-neutral-700">All pending</strong> skips the checkboxes and runs every
                  not-yet-processed row.                   <strong className="text-neutral-700">Entire queue</strong> re-runs the pipeline
                  on every row (higher cost). Remote batch runs several API jobs in parallel (throttled).
                </p>
              )}
            </div>
          )}

          {/* Progress — single job */}
          {bulkRunning && batchProgress && !isJobActive && (
            <div className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-6">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="flex min-w-0 flex-1 gap-3 sm:items-center">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-100">
                    <Loader2 className="h-6 w-6 animate-spin text-black" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-black">Concurrent batch</p>
                    <p className="mt-0.5 text-sm text-neutral-600">
                      {batchProgress.current}/{batchProgress.total} complete
                      {batchProgress.filename ? (
                        <span className="text-neutral-500"> · last: {batchProgress.filename}</span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-[11px] text-neutral-500 leading-snug">
                      Up to {getBatchPipelineConcurrency()} pipelines in flight against the API. Keep this tab open.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleStopOperation}
                  className="inline-flex w-full shrink-0 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-800 hover:bg-red-50 transition-colors sm:w-auto sm:self-center"
                >
                  <Ban className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                  Stop
                </button>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-200">
                <div
                  className="h-full rounded-full bg-black transition-all duration-500 ease-out"
                  style={{
                    width: `${Math.min(100, (batchProgress.current / Math.max(1, batchProgress.total)) * 100)}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-[10px] text-neutral-500 leading-snug">
                Stop skips assets that have not started yet and stops polling for this batch. Jobs already running on the API may still complete.
              </p>
            </div>
          )}

          {isJobActive && store.currentJob && (
            <div className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-6">
              {batchProgress && (
                <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-600 mb-3 font-data break-words">
                  Batch {batchProgress.current}/{batchProgress.total} · {batchProgress.filename}
                </p>
              )}
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex items-center gap-4 sm:flex-1 sm:min-w-0">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-100">
                    <Loader2 className="h-6 w-6 animate-spin text-black" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-black">Pipeline active</p>
                    <p className="mt-0.5 text-sm text-neutral-500 sm:truncate">
                      {getProgressLabel(store.currentJob.progress_pct)}
                    </p>
                    {!storageOnly && pipelineElapsedSec > 0 ? (
                      <p className="mt-1 text-[11px] text-neutral-400 font-data tabular-nums leading-snug">
                        Elapsed {Math.floor(pipelineElapsedSec / 60)}m {pipelineElapsedSec % 60}s — the bar still
                        moves slowly while OpenAI / Replicate run
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end sm:gap-2">
                  <button
                    type="button"
                    onClick={handleStopOperation}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-800 hover:bg-red-50 transition-colors"
                  >
                    <Ban className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                    Stop
                  </button>
                  <span className="text-2xl font-bold text-black tabular-nums font-data sm:text-right">
                    {store.currentJob.progress_pct}%
                  </span>
                </div>
              </div>

              <div className="w-full bg-neutral-200 rounded-full h-2.5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out bg-black"
                  style={{
                    width: `${store.currentJob.progress_pct}%`,
                  }}
                />
              </div>

              <div className="flex justify-between mt-3 text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">
                {(() => {
                  const p = store.currentJob.progress_pct;
                  return (
                    <>
                      <span className={p < 10 ? "text-black" : ""}>Ingest</span>
                      <span className={p >= 10 && p < 50 ? "text-black" : ""}>Enhance</span>
                      <span className={p >= 50 && p < 85 ? "text-black" : ""}>Upscale</span>
                      <span className={p >= 85 ? "text-black" : ""}>Commit</span>
                    </>
                  );
                })()}
              </div>
              <p className="mt-2 text-[10px] text-neutral-500 leading-snug">
                Stop stops this tab from watching the job and cancels queued batch work. A run that already started on the server may still finish.
              </p>
            </div>
          )}

          {/* Completed */}
          {isJobCompleted && store.currentJob && !resultVersion && (
            <div className="bg-white border border-neutral-200 rounded-2xl p-6 flex items-center gap-4">
              <CheckCircle2 className="w-8 h-8 text-black" />
              <div>
                <p className="font-semibold text-black">Processing complete</p>
                <p className="text-sm text-neutral-600 mt-0.5">Your enhanced image is ready.</p>
              </div>
            </div>
          )}

          {isJobFailed && store.currentJob && (
            <div className="bg-neutral-50 border border-neutral-300 rounded-2xl p-5 flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-black flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-black">Processing failed</p>
                <p className="text-sm text-neutral-700 mt-1">{store.currentJob.error_message}</p>
              </div>
              <button
                type="button"
                onClick={() => store.setCurrentJob(null)}
                className="text-sm font-medium text-black px-3 py-1.5 rounded-lg border border-neutral-300 hover:bg-white transition-colors"
              >
                Try again
              </button>
            </div>
          )}

          {workspaceMode && bulkExportEligibleImages.length >= 1 && (
            <WorkspaceOutputPreviewStrip
              images={bulkExportEligibleImages}
              selectedId={store.currentImage?.id ?? null}
              onSelect={(id) => {
                const img = store.sessionImages.find((i) => i.id === id);
                if (!img) return;
                stopPolling();
                store.setCurrentImage(img);
                store.setCurrentJob(null);
              }}
            />
          )}

          {showBulkExport && (
            <BulkExportBar
              images={bulkExportEligibleImages}
              aiNamingProviders={storageOnly ? [] : aiNamingProviders}
            />
          )}

          {showDownloadForCurrent && store.currentImage && (
            <DownloadPanel
              imageId={store.currentImage.id}
              versions={store.currentImage.versions}
              originalFilename={store.currentImage.original_filename}
              aiNamingProviders={storageOnly ? [] : aiNamingProviders}
              onEditVersionSettings={() => handleEditPipelineFromRecipe()}
            />
          )}
            </div>
          </div>
        )}

        {workspaceMode && <WorkspaceArchivePanel />}
      </div>
    </div>
  );
}

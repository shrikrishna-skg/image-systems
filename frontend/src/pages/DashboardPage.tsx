import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Loader2,
  Wand2,
  AlertCircle,
  ImageIcon,
  CheckCircle2,
  Upload,
  Camera,
  SlidersHorizontal,
  Download,
  Layers,
  Orbit,
  Maximize2,
  Minimize2,
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
import GenerationRecipePanel from "../components/pipeline/GenerationRecipePanel";
import SessionQueuePanel from "../components/batch/SessionQueuePanel";
import WorkspaceArchivePanel from "../components/archive/WorkspaceArchivePanel";
import { useImageStore } from "../stores/imageStore";
import { useJobPolling } from "../hooks/useJobPolling";
import { useAuthenticatedImage } from "../hooks/useAuthenticatedImage";
import { processImage, estimateCost, getImage, postLocalImprove } from "../api/images";
import { getHealth } from "../api/health";
import { getCachedImageBlob } from "../lib/imageBlobCache";
import { runLocalEnhancePipeline, runLocalImproveOnBlob } from "../lib/localPipeline";
import { listKeys } from "../api/apiKeys";
import { isStorageOnlyMode } from "../lib/storageOnlyMode";
import { pollJobUntilComplete } from "../lib/pollJob";
import { buildFullPipelineRequest, buildFullPipelineRequestWithBlob } from "../lib/pipelineParams";
import { consumePipelineCompletionOnce } from "../lib/jobCompletionLedger";
import {
  calibrationIncrementForCompletion,
  resolveCalibrationProviderKind,
} from "../lib/adaptiveCalibration";
import { MAX_WORKSPACE_ASSETS } from "../lib/workspaceLimits";
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
  const [batchProcessingId, setBatchProcessingId] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
    filename: string;
  } | null>(null);
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

  const bulkExportEligibleImages = useMemo(() => {
    if (!store.workspaceMode) return [];
    return store.sessionImages.filter((img) => (img.versions?.length ?? 0) > 0);
  }, [store.workspaceMode, store.sessionImages]);
  const showBulkExport = bulkExportEligibleImages.length >= 2;

  const workspaceMode = store.workspaceMode;
  const sessionCount = store.sessionImages.length;

  const previewFsRef = useRef<HTMLDivElement>(null);
  const { isFullscreen: isPreviewFullscreen, toggle: togglePreviewFullscreen } = useFullscreen(previewFsRef, {
    matchDescendants: true,
  });
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
    if (!store.currentImage) {
      setHasEnhanceKey(false);
      setHasReplicateKey(false);
      setAiNamingProviders([]);
      return;
    }
    let cancelled = false;
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
    return () => {
      cancelled = true;
    };
  }, [store.currentImage?.id, storageOnly]);

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
        const finalVer = updated.versions[updated.versions.length - 1];
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
        const finalVer = updated.versions[updated.versions.length - 1];
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
        toast.success("Done — improved in your browser and saved.");
        return;
      }

      const blob = await getCachedImageBlob(store.currentImage.id, null);
      const params = await buildFullPipelineRequestWithBlob(useImageStore.getState(), blob);
      const job = await processImage(store.currentImage.id, params);
      store.setCurrentJob(job);
      startPolling(job.id, store.currentImage.id);
      toast.success("Processing started!", {
        description: "We’ll update this card when the pipeline finishes.",
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

  const handleBulkProcess = async (pendingOnly: boolean) => {
    const targets = pendingOnly
      ? displayQueue.filter((img) => !img.versions?.length)
      : [...displayQueue];
    if (targets.length === 0) {
      toast.error(pendingOnly ? "No pending assets in the queue." : "Queue is empty.");
      return;
    }
    if (!storageOnly && store.provider !== "improve" && (!hasEnhanceKey || !replicateOk)) {
      toast.error("Add API keys in Settings before running batch jobs.", {
        description: devSkipUpscale ? "Replicate is optional in current local dev mode." : undefined,
      });
      return;
    }

    setBulkRunning(true);
    stopPolling();
    let lastCompletedJob: JobInfo | null = null;
    let lastUpdatedImage: ImageInfo | null = null;

    try {
      for (let i = 0; i < targets.length; i++) {
        const img = targets[i];
        setBatchProcessingId(img.id);
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
          const finalVer = updated.versions[updated.versions.length - 1];
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
          const finalVer = updated.versions[updated.versions.length - 1];
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
        } else {
          const blob = await getCachedImageBlob(img.id, null);
          const params = await buildFullPipelineRequestWithBlob(useImageStore.getState(), blob);
          const job = await processImage(img.id, params);
          store.setCurrentJob(job);
          const final = await pollJobUntilComplete(job.id, (j) => store.setCurrentJob(j));
          if (final.status === "failed") {
            toast.error(final.error_message || `Failed: ${img.original_filename}`);
            continue;
          }
          const updated = await getImage(img.id);
          store.upsertSessionImage(updated);
          store.setCurrentImage(updated);
          lastCompletedJob = final;
          lastUpdatedImage = updated;
        }
      }
      if (!storageOnly && lastCompletedJob && lastUpdatedImage) {
        store.setCurrentImage(lastUpdatedImage);
        store.setCurrentJob(lastCompletedJob);
      }
      toast.success(`Batch finished · ${targets.length} asset(s).`);
    } catch (err: unknown) {
      toastProcessingError(err, "Batch stopped");
    } finally {
      setBatchProcessingId(null);
      setBatchProgress(null);
      setBulkRunning(false);
    }
  };

  const isJobActive =
    store.currentJob?.status === "pending" || store.currentJob?.status === "processing";
  const pipelineBusy = isJobActive || bulkRunning || processing;
  const isJobCompleted = store.currentJob?.status === "completed";
  const isJobFailed = store.currentJob?.status === "failed";

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

  // Get the result version for before/after
  const resultVersion = store.currentImage?.versions?.find(
    (v) => v.id === store.currentJob?.result_version_id
  );

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
    <div className="min-h-full bg-white">
      <div className="max-w-[1600px] mx-auto px-4 py-6 md:px-8 md:py-10 pb-20">
        <header className="mb-8 md:mb-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500 mb-2">
                <Orbit className="w-3.5 h-3.5 text-black" strokeWidth={2} />
                Operations console
              </div>
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-black">
                Listing imagery at production scale
              </h1>
              <p className="mt-3 text-sm md:text-base text-neutral-600 leading-relaxed">
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
              <div className="flex flex-wrap gap-2">
                {workspaceMode ? (
                  <>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-800 font-data">
                      <Layers className="w-3.5 h-3.5 text-black" />
                      {sessionCount || displayQueue.length} in workspace
                    </span>
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-800 font-data tabular-nums"
                      title="Maximum assets per workspace batch"
                    >
                      {sessionCount || displayQueue.length}/{MAX_WORKSPACE_ASSETS} batch cap
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 bg-neutral-100 px-3 py-1 text-xs font-medium text-black font-data">
                      {pendingCount} pending
                    </span>
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-800">
                    Standard · single photo
                  </span>
                )}
              </div>
            )}
          </div>
          {!store.currentImage && (
            <ol className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                {
                  step: "1",
                  title: "Choose flow",
                  body: "Standard: one photo. Workspace batch: queue many on the home screen before you import.",
                  icon: Camera,
                },
                {
                  step: "2",
                  title: "Tune",
                  body: "Pick lighting, provider, and upscale — one profile applies to your run (or whole batch).",
                  icon: SlidersHorizontal,
                },
                {
                  step: "3",
                  title: "Deliver",
                  body: "Compare before/after, download versions, or hand off to your DAM.",
                  icon: Download,
                },
              ].map(({ step, title, body, icon: Icon }) => (
                <li
                  key={step}
                  className="flex gap-3 rounded-2xl border border-neutral-200 bg-white p-4"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700 border border-neutral-200">
                    <Icon className="w-5 h-5" strokeWidth={1.75} />
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-neutral-500">Step {step}</p>
                    <p className="text-sm font-semibold text-black">{title}</p>
                    <p className="text-xs text-neutral-500 mt-1 leading-snug">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
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
              <aside className="mb-6 lg:mb-0 lg:sticky lg:top-6 lg:self-start order-2 lg:order-1">
                <SessionQueuePanel
                  assets={displayQueue}
                  selectedId={store.currentImage?.id ?? null}
                  processingAssetId={batchProcessingId}
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
                />
              </aside>
            )}

            <div
              className={`space-y-6 min-w-0 ${workspaceMode && displayQueue.length > 1 ? "order-1 lg:order-2" : ""}`}
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
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-200 bg-neutral-50">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-black flex items-center justify-center shrink-0">
                  <ImageIcon className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-medium text-black text-sm truncate">
                    {store.currentImage.original_filename}
                  </h3>
                  <p className="text-xs text-neutral-500 font-data tabular-nums">
                    {store.currentImage.width} × {store.currentImage.height}px
                    {store.currentImage.file_size_bytes &&
                      ` · ${(store.currentImage.file_size_bytes / 1024 / 1024).toFixed(1)} MB`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void togglePreviewFullscreen()}
                  className="flex items-center gap-1.5 text-xs font-medium text-neutral-600 hover:text-black transition-colors px-3 py-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-50"
                  title={isPreviewFullscreen ? "Exit full screen" : "Full screen preview"}
                >
                  {isPreviewFullscreen ? (
                    <>
                      <Minimize2 className="w-3.5 h-3.5" />
                      Exit full screen
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-3.5 h-3.5" />
                      Full screen
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stopPolling();
                    store.reset();
                  }}
                  className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-black transition-colors px-3 py-1.5 rounded-lg hover:bg-neutral-100"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {workspaceMode ? "Clear workspace" : "Start over"}
                </button>
              </div>
            </div>

            {/* Image display */}
            <div
              ref={previewFsRef}
              className={`p-4 ${isPreviewFullscreen ? "min-h-[100dvh] flex flex-col bg-black" : ""}`}
            >
              {isJobCompleted && resultVersion ? (
                <BeforeAfterSlider
                  imageId={store.currentImage.id}
                  resultVersionId={resultVersion.id}
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
                        className={`w-auto object-contain rounded-lg ${
                          isPreviewFullscreen ? "max-h-[calc(100dvh-6rem)] max-w-full" : "max-h-[450px]"
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
          </div>

          {isJobCompleted && resultVersion && store.currentImage && (
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
            <div className="rounded-2xl border border-neutral-200 bg-white p-6">
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
                    {workspaceMode && pendingCount > 1 && !storageOnly && (
                      <div className="text-right">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                          Batch ceiling ({pendingCount} pending)
                        </p>
                        <p className="text-lg font-semibold text-black font-data tabular-nums">
                          ~${(store.costEstimate.total_cost * pendingCount).toFixed(2)}
                        </p>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500 mt-2">{store.costEstimate.details}</p>
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handleProcess}
                  disabled={processing || bulkRunning}
                  className="flex-1 py-3.5 rounded-xl font-semibold text-sm bg-black text-white hover:bg-neutral-800 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Starting…
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-5 h-5" />
                      {storageOnly ? "Run pipeline · current asset" : "Run pipeline · current asset"}
                    </>
                  )}
                </button>
                {workspaceMode && displayQueue.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleBulkProcess(true)}
                      disabled={processing || bulkRunning || pendingCount === 0}
                      className="flex-1 py-3.5 rounded-xl font-semibold text-sm border border-neutral-300 bg-white text-black hover:bg-neutral-50 disabled:opacity-45 transition-colors flex items-center justify-center gap-2"
                    >
                      <Layers className="w-5 h-5 text-black" />
                      Process pending ({pendingCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleBulkProcess(false)}
                      disabled={processing || bulkRunning}
                      className="sm:max-w-[10rem] py-3.5 px-3 rounded-xl text-xs font-semibold text-neutral-500 border border-dashed border-neutral-400 hover:border-black hover:text-black disabled:opacity-45 transition-colors"
                      title="Re-run pipeline on every asset in the queue"
                    >
                      Re-run queue
                    </button>
                  </>
                )}
              </div>
              {workspaceMode && displayQueue.length > 1 && (
                <p className="text-[11px] text-neutral-500 mt-3 leading-relaxed">
                  Batch mode applies the same enhancement profile to each asset sequentially (up to{" "}
                  {MAX_WORKSPACE_ASSETS} assets per workspace). Pending skips files that already have an output;
                  Re-run queue processes every row again (higher cost).
                </p>
              )}
            </div>
          )}

          {/* Progress */}
          {isJobActive && store.currentJob && (
            <div className="rounded-2xl border border-neutral-200 bg-white p-6">
              {batchProgress && (
                <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-600 mb-3 font-data">
                  Batch {batchProgress.current}/{batchProgress.total} · {batchProgress.filename}
                </p>
              )}
              <div className="flex items-center gap-4 mb-5">
                <div className="w-12 h-12 rounded-xl bg-neutral-100 border border-neutral-200 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-black" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-black">Pipeline active</p>
                  <p className="text-sm text-neutral-500 mt-0.5 truncate">
                    {getProgressLabel(store.currentJob.progress_pct)}
                  </p>
                  {!storageOnly && pipelineElapsedSec > 0 ? (
                    <p className="text-[11px] text-neutral-400 mt-1 font-data tabular-nums">
                      Elapsed {Math.floor(pipelineElapsedSec / 60)}m {pipelineElapsedSec % 60}s — the bar still
                      moves slowly while OpenAI / Replicate run
                    </p>
                  ) : null}
                </div>
                <span className="text-2xl font-bold text-black tabular-nums font-data shrink-0">
                  {store.currentJob.progress_pct}%
                </span>
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

          {showBulkExport && (
            <BulkExportBar
              images={bulkExportEligibleImages}
              aiNamingProviders={storageOnly ? [] : aiNamingProviders}
            />
          )}

          {isJobCompleted && store.currentImage && (
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

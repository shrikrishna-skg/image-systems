import { Fragment, jsx, jsxs } from "react/jsx-runtime";
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
  Ban
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
  WORKSPACE_COMPARE_ANCHOR
} from "../components/workspace/WorkspaceBulkResultsPreview";
import { useShallow } from "zustand/react/shallow";
import { useImageStore } from "../stores/imageStore";
import { useJobPolling } from "../hooks/useJobPolling";
import { useAuthenticatedImage } from "../hooks/useAuthenticatedImage";
import { processImage, estimateCost, getImage, postLocalImprove } from "../api/images";
import { getLatestImageVersion, getLatestImproveVersion } from "../lib/imageVersions";
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
  resolveCalibrationProviderKind
} from "../lib/adaptiveCalibration";
import {
  MAX_WORKSPACE_ASSETS,
  WORKSPACE_UI_SHOW_SLASH_TOTAL,
  workspaceQueueCountLabel
} from "../lib/workspaceLimits";
import { useFullscreen } from "../hooks/useFullscreen";
import { useAdaptiveExperienceStore } from "../stores/adaptiveExperienceStore";
import { toast } from "sonner";
import {
  PIPELINE_CLOUD_STARTED_TOAST_ID,
  toastProcessingError
} from "../lib/processingToast";
import { useAuthStore } from "../stores/authStore";
import ApiKeyRequiredBanner from "../components/operations/ApiKeyRequiredBanner";
import WelcomeChecklistBanner from "../components/operations/WelcomeChecklistBanner";
import { HISTORY_SEEN_ARCHIVE_KEY } from "../lib/historyDeliverables";
const storageOnly = isStorageOnlyMode();
const localDev = import.meta.env.VITE_LOCAL_DEV_MODE === "true" || import.meta.env.VITE_LOCAL_DEV_MODE === true || storageOnly;
function improveOutputFormatFromStore(raw) {
  return raw === "jpeg" || raw === "webp" || raw === "png" ? raw : "png";
}
function DashboardPage() {
  const store = useImageStore(
    useShallow((s) => ({
      currentImage: s.currentImage,
      sessionImages: s.sessionImages,
      workspaceMode: s.workspaceMode,
      currentJob: s.currentJob,
      provider: s.provider,
      model: s.model,
      lighting: s.lighting,
      qualityPreset: s.qualityPreset,
      perspective: s.perspective,
      roomType: s.roomType,
      customPrompt: s.customPrompt,
      scaleFactor: s.scaleFactor,
      targetResolution: s.targetResolution,
      outputFormat: s.outputFormat,
      costEstimate: s.costEstimate
    }))
  );
  const { startPolling, stopPolling } = useJobPolling();
  const authUser = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.isLoading);
  const scrollToPipelineSettings = useCallback(() => {
    window.setTimeout(() => {
      document.getElementById("pipeline-settings")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }, 100);
  }, []);
  const handleEditPipelineFromRecipe = useCallback(() => {
    stopPolling();
    useImageStore.getState().setCurrentJob(null);
    scrollToPipelineSettings();
  }, [stopPolling, scrollToPipelineSettings]);
  const [processing, setProcessing] = useState(false);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [batchProcessingIds, setBatchProcessingIds] = useState(() => /* @__PURE__ */ new Set());
  const [batchProgress, setBatchProgress] = useState(null);
  const [batchSelectedIds, setBatchSelectedIds] = useState(() => /* @__PURE__ */ new Set());
  const [archiveSeenForChecklist, setArchiveSeenForChecklist] = useState(() => {
    try {
      return sessionStorage.getItem(HISTORY_SEEN_ARCHIVE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [hasEnhanceKey, setHasEnhanceKey] = useState(false);
  const [hasReplicateKey, setHasReplicateKey] = useState(false);
  const [aiNamingProviders, setAiNamingProviders] = useState([]);
  const [pipelineElapsedSec, setPipelineElapsedSec] = useState(0);
  const [devSkipUpscale, setDevSkipUpscale] = useState(
    () => !storageOnly && (import.meta.env.VITE_LOCAL_DEV_MODE === "true" || import.meta.env.VITE_LOCAL_DEV_MODE === true)
  );
  const replicateOk = hasReplicateKey || devSkipUpscale;
  useEffect(() => {
    const syncArchiveSeen = () => {
      try {
        setArchiveSeenForChecklist(sessionStorage.getItem(HISTORY_SEEN_ARCHIVE_KEY) === "1");
      } catch {
      }
    };
    window.addEventListener("focus", syncArchiveSeen);
    document.addEventListener("visibilitychange", syncArchiveSeen);
    return () => {
      window.removeEventListener("focus", syncArchiveSeen);
      document.removeEventListener("visibilitychange", syncArchiveSeen);
    };
  }, []);
  const isBrandNewCloudUser = !storageOnly && !authLoading && !!authUser && (authUser.images_processed ?? 0) === 0;
  const hasWorkspaceAsset = !!store.currentImage || store.sessionImages.length > 0;
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
    () => displayQueue.map((i) => i.id).sort().join("\n"),
    [displayQueue]
  );
  useEffect(() => {
    const valid = new Set(displayQueue.map((i) => i.id));
    setBatchSelectedIds((prev) => {
      const next = /* @__PURE__ */ new Set();
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
  const modKeyChar = useMemo(() => {
    if (typeof navigator === "undefined") return "Ctrl";
    const ua = navigator.userAgent;
    return ua.includes("Mac") || ua.includes("iPhone") ? "\u2318" : "Ctrl";
  }, []);
  const workspaceMode = store.workspaceMode;
  const sessionCount = store.sessionImages.length;
  const previewFsRef = useRef(null);
  const pipelineActionsRowRef = useRef(null);
  const [actionsDocked, setActionsDocked] = useState(false);
  const operationCancelRequestedRef = useRef(false);
  const bulkRunningRef = useRef(false);
  useEffect(() => {
    bulkRunningRef.current = bulkRunning;
  }, [bulkRunning]);
  const {
    isFullscreen: isPreviewFullscreen,
    toggle: togglePreviewFullscreen,
    enter: enterPreviewFullscreen
  } = useFullscreen(previewFsRef, {
    matchDescendants: true
  });
  const [workspaceBulkFsLayout, setWorkspaceBulkFsLayout] = useState("grid");
  const [workspaceBulkFocusId, setWorkspaceBulkFocusId] = useState(null);
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
    async (id) => {
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
        description: "This tab is no longer watching the job. Cloud work may still finish in the background."
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
    recordCalibrationSignal
  ]);
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
      listKeys().then((keys) => {
        if (cancelled) return;
        const providers = new Set(keys.map((k) => k.provider));
        setHasEnhanceKey(providers.has("openai") || providers.has("gemini"));
        setHasReplicateKey(providers.has("replicate"));
        const naming = keys.map((k) => k.provider).filter((p) => p === "openai" || p === "gemini");
        setAiNamingProviders([...new Set(naming)]);
      }).catch(() => {
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
    void getHealth().then((h) => {
      if (!cancelled) setDevSkipUpscale(Boolean(h.local_dev_skip_upscale));
    }).catch(() => {
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
      details: "Runs on this device \u2014 no cloud charges."
    });
  }, [storageOnly]);
  useEffect(() => {
    if (storageOnly) return;
    const timer = setTimeout(async () => {
      if (!store.currentImage) return;
      if (store.provider === "improve") {
        useImageStore.getState().setCostEstimate({
          enhancement_cost: 0,
          upscale_cost: 0,
          total_cost: 0,
          provider: "local",
          model: "browser",
          details: "Improve runs in your browser \u2014 no enhancement API charges. Add keys only if you use OpenAI / Gemini + Replicate."
        });
        return;
      }
      try {
        const cost = await estimateCost(buildFullPipelineRequest(useImageStore.getState()));
        useImageStore.getState().setCostEstimate(cost);
      } catch {
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
    store.scaleFactor,
    store.targetResolution,
    store.outputFormat,
    storageOnly
  ]);
  const handleProcess = async () => {
    if (!store.currentImage) return;
    if (!storageOnly && store.provider !== "improve") {
      if (!hasEnhanceKey || !replicateOk) {
        toast.error("Add an OpenAI or Gemini API key in Settings.", {
          description: devSkipUpscale ? "Replicate is optional while local dev skip-upscale is enabled." : "Add a Replicate token too for upscaling, or run npm run dev (skip-upscale enabled by default)."
        });
        return;
      }
    }
    operationCancelRequestedRef.current = false;
    setProcessing(true);
    try {
      if (storageOnly) {
        const imageId2 = store.currentImage.id;
        const now2 = (/* @__PURE__ */ new Date()).toISOString();
        const jobId = crypto.randomUUID();
        useImageStore.getState().setCurrentJob({
          id: jobId,
          image_id: imageId2,
          job_type: "full_pipeline",
          status: "processing",
          progress_pct: 0,
          error_message: null,
          result_version_id: null,
          started_at: now2,
          completed_at: null,
          created_at: now2
        });
        const tick = (pct) => {
          useImageStore.getState().setCurrentJob({
            id: jobId,
            image_id: imageId2,
            job_type: "full_pipeline",
            status: "processing",
            progress_pct: pct,
            error_message: null,
            result_version_id: null,
            started_at: now2,
            completed_at: null,
            created_at: now2
          });
        };
        const tuning2 = {
          lighting: store.lighting,
          qualityPreset: store.qualityPreset,
          perspective: store.perspective,
          roomType: store.roomType
        };
        const updated = await runLocalEnhancePipeline(
          imageId2,
          store.scaleFactor,
          tick,
          tuning2,
          improveOutputFormatFromStore(store.outputFormat),
          { targetResolution: store.targetResolution }
        );
        const finalVer = getLatestImageVersion(updated.versions);
        useImageStore.getState().setCurrentImage(updated);
        useImageStore.getState().upsertSessionImage(updated);
        useImageStore.getState().setCurrentJob({
          id: jobId,
          image_id: imageId2,
          job_type: "full_pipeline",
          status: "completed",
          progress_pct: 100,
          error_message: null,
          result_version_id: finalVer?.id ?? null,
          started_at: now2,
          completed_at: (/* @__PURE__ */ new Date()).toISOString(),
          created_at: now2
        });
        toast.success("Done \u2014 saved on this device.");
        return;
      }
      if (store.provider === "improve") {
        const imageId2 = store.currentImage.id;
        const now2 = (/* @__PURE__ */ new Date()).toISOString();
        const jobId = crypto.randomUUID();
        useImageStore.getState().setCurrentJob({
          id: jobId,
          image_id: imageId2,
          job_type: "full_pipeline",
          status: "processing",
          progress_pct: 0,
          error_message: null,
          result_version_id: null,
          started_at: now2,
          completed_at: null,
          created_at: now2
        });
        const tick = (pct) => {
          useImageStore.getState().setCurrentJob({
            id: jobId,
            image_id: imageId2,
            job_type: "full_pipeline",
            status: "processing",
            progress_pct: pct,
            error_message: null,
            result_version_id: null,
            started_at: now2,
            completed_at: null,
            created_at: now2
          });
        };
        const tuning2 = {
          lighting: store.lighting,
          qualityPreset: store.qualityPreset,
          perspective: store.perspective,
          roomType: store.roomType
        };
        const blob2 = await getCachedImageBlob(imageId2, null);
        const outFmt = improveOutputFormatFromStore(store.outputFormat);
        const finalBlob = await runLocalImproveOnBlob(blob2, store.scaleFactor, tick, tuning2, outFmt, {
          targetResolution: store.targetResolution
        });
        const updated = await postLocalImprove(imageId2, finalBlob, outFmt);
        let merged2 = updated;
        try {
          merged2 = await getImage(imageId2);
        } catch {
        }
        const finalVer = getLatestImproveVersion(merged2.versions);
        if (!finalVer?.id) {
          throw new Error("Improve saved but no new version was returned \u2014 check your connection and try again.");
        }
        useImageStore.getState().setCurrentImage(merged2);
        useImageStore.getState().upsertSessionImage(merged2);
        useImageStore.getState().setCurrentJob({
          id: jobId,
          image_id: imageId2,
          job_type: "full_pipeline",
          status: "completed",
          progress_pct: 100,
          error_message: null,
          result_version_id: finalVer.id,
          started_at: now2,
          completed_at: (/* @__PURE__ */ new Date()).toISOString(),
          created_at: now2
        });
        toast.success("Done \u2014 improved in your browser and saved.");
        return;
      }
      const imageId = store.currentImage.id;
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const preJobId = crypto.randomUUID();
      const tuning = {
        lighting: store.lighting,
        qualityPreset: store.qualityPreset,
        perspective: store.perspective,
        roomType: store.roomType
      };
      useImageStore.getState().setCurrentJob({
        id: preJobId,
        image_id: imageId,
        job_type: "full_pipeline",
        status: "processing",
        progress_pct: 0,
        error_message: null,
        result_version_id: null,
        started_at: now,
        completed_at: null,
        created_at: now
      });
      const tickPre = (pct) => {
        useImageStore.getState().setCurrentJob({
          id: preJobId,
          image_id: imageId,
          job_type: "full_pipeline",
          status: "processing",
          progress_pct: Math.min(28, Math.round(pct / 100 * 28)),
          error_message: null,
          result_version_id: null,
          started_at: now,
          completed_at: null,
          created_at: now
        });
      };
      const { image: merged, improveVersionId } = await commitBrowserImproveBeforeCloud(
        imageId,
        store.scaleFactor,
        tuning,
        tickPre
      );
      useImageStore.getState().setCurrentImage(merged);
      useImageStore.getState().upsertSessionImage(merged);
      const blob = await getCachedImageBlob(imageId, null);
      const params = await buildFullPipelineRequestWithBlob(useImageStore.getState(), blob);
      const job2 = await processImage(imageId, {
        ...params,
        improve_input_version_id: improveVersionId
      });
      useImageStore.getState().setCurrentJob(job2);
      startPolling(job2.id, imageId);
      toast.success("Processing started!", {
        id: PIPELINE_CLOUD_STARTED_TOAST_ID,
        description: "Browser Improve finished \u2014 cloud enhance + upscale are running.",
        duration: 3200
      });
    } catch (err) {
      toastProcessingError(err, "Couldn't start processing");
      useImageStore.getState().setCurrentJob(null);
    } finally {
      setProcessing(false);
    }
  };
  const handleRemoveAsset = useCallback(
    (id) => {
      const st = useImageStore.getState();
      if (st.sessionImages.length === 0 && st.currentImage?.id === id) {
        stopPolling();
        st.reset();
        return;
      }
      st.removeSessionImage(id);
    },
    [stopPolling]
  );
  const toggleBatchSelect = useCallback((id) => {
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
    setBatchSelectedIds(/* @__PURE__ */ new Set());
  }, []);
  const runBatchOnTargets = async (targets) => {
    if (targets.length === 0) return;
    if (!storageOnly && store.provider !== "improve" && (!hasEnhanceKey || !replicateOk)) {
      toast.error("Add API keys in Settings before running batch jobs.", {
        description: devSkipUpscale ? "Replicate is optional in current local dev mode." : void 0
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
          setBatchProcessingIds(/* @__PURE__ */ new Set([img.id]));
          setBatchProgress({ current: i + 1, total: targets.length, filename: img.original_filename });
          useImageStore.getState().setCurrentImage(img);
          if (storageOnly) {
            const now = (/* @__PURE__ */ new Date()).toISOString();
            const jobId = crypto.randomUUID();
            useImageStore.getState().setCurrentJob({
              id: jobId,
              image_id: img.id,
              job_type: "full_pipeline",
              status: "processing",
              progress_pct: 0,
              error_message: null,
              result_version_id: null,
              started_at: now,
              completed_at: null,
              created_at: now
            });
            const tick = (pct) => {
              useImageStore.getState().setCurrentJob({
                id: jobId,
                image_id: img.id,
                job_type: "full_pipeline",
                status: "processing",
                progress_pct: pct,
                error_message: null,
                result_version_id: null,
                started_at: now,
                completed_at: null,
                created_at: now
              });
            };
            const tuning = {
              lighting: store.lighting,
              qualityPreset: store.qualityPreset,
              perspective: store.perspective,
              roomType: store.roomType
            };
            const updated = await runLocalEnhancePipeline(
              img.id,
              store.scaleFactor,
              tick,
              tuning,
              improveOutputFormatFromStore(store.outputFormat),
              { targetResolution: store.targetResolution }
            );
            const finalVer = getLatestImageVersion(updated.versions);
            useImageStore.getState().upsertSessionImage(updated);
            useImageStore.getState().setCurrentImage(updated);
            useImageStore.getState().setCurrentJob({
              id: jobId,
              image_id: img.id,
              job_type: "full_pipeline",
              status: "completed",
              progress_pct: 100,
              error_message: null,
              result_version_id: finalVer?.id ?? null,
              started_at: now,
              completed_at: (/* @__PURE__ */ new Date()).toISOString(),
              created_at: now
            });
          } else if (store.provider === "improve") {
            const now = (/* @__PURE__ */ new Date()).toISOString();
            const jobId = crypto.randomUUID();
            useImageStore.getState().setCurrentJob({
              id: jobId,
              image_id: img.id,
              job_type: "full_pipeline",
              status: "processing",
              progress_pct: 0,
              error_message: null,
              result_version_id: null,
              started_at: now,
              completed_at: null,
              created_at: now
            });
            const tick = (pct) => {
              useImageStore.getState().setCurrentJob({
                id: jobId,
                image_id: img.id,
                job_type: "full_pipeline",
                status: "processing",
                progress_pct: pct,
                error_message: null,
                result_version_id: null,
                started_at: now,
                completed_at: null,
                created_at: now
              });
            };
            const tuning = {
              lighting: store.lighting,
              qualityPreset: store.qualityPreset,
              perspective: store.perspective,
              roomType: store.roomType
            };
            const blob = await getCachedImageBlob(img.id, null);
            const outFmt = improveOutputFormatFromStore(store.outputFormat);
            const finalBlob = await runLocalImproveOnBlob(blob, store.scaleFactor, tick, tuning, outFmt, {
              targetResolution: store.targetResolution
            });
            const updated = await postLocalImprove(img.id, finalBlob, outFmt);
            let merged = updated;
            try {
              merged = await getImage(img.id);
            } catch {
            }
            const finalVer = getLatestImproveVersion(merged.versions);
            if (!finalVer?.id) {
              throw new Error(
                `Improve saved but no new version for ${img.original_filename} \u2014 check your connection and try again.`
              );
            }
            useImageStore.getState().upsertSessionImage(merged);
            useImageStore.getState().setCurrentImage(merged);
            useImageStore.getState().setCurrentJob({
              id: jobId,
              image_id: img.id,
              job_type: "full_pipeline",
              status: "completed",
              progress_pct: 100,
              error_message: null,
              result_version_id: finalVer.id,
              started_at: now,
              completed_at: (/* @__PURE__ */ new Date()).toISOString(),
              created_at: now
            });
          }
          batchPartialSuccessCount += 1;
        }
        if (!operationCancelRequestedRef.current) {
          toast.success(`Batch finished \xB7 ${targets.length} asset(s).`);
        }
      } else {
        setBatchProgress({ current: 0, total: targets.length, filename: "" });
        const concurrency = getBatchPipelineConcurrency();
        let done = 0;
        const itemResults = await mapPool(targets, concurrency, async (img) => {
          if (operationCancelRequestedRef.current) {
            return { ok: false, filename: img.original_filename, cancelled: true };
          }
          setBatchProcessingIds((prev) => new Set(prev).add(img.id));
          try {
            const tuning = {
              lighting: store.lighting,
              qualityPreset: store.qualityPreset,
              perspective: store.perspective,
              roomType: store.roomType
            };
            const { image: merged, improveVersionId } = await commitBrowserImproveBeforeCloud(
              img.id,
              store.scaleFactor,
              tuning,
              () => {
              }
            );
            useImageStore.getState().upsertSessionImage(merged);
            if (operationCancelRequestedRef.current) {
              return { ok: false, filename: img.original_filename, cancelled: true };
            }
            const blob = await getCachedImageBlob(img.id, null);
            const params = await buildFullPipelineRequestWithBlob(useImageStore.getState(), blob);
            const job2 = await processImage(img.id, {
              ...params,
              improve_input_version_id: improveVersionId
            });
            if (operationCancelRequestedRef.current) {
              return { ok: false, filename: img.original_filename, cancelled: true };
            }
            const final = await pollJobUntilComplete(
              job2.id,
              void 0,
              () => operationCancelRequestedRef.current
            );
            if (final.status === "failed") {
              toast.error(final.error_message || `Failed: ${img.original_filename}`);
              return { ok: false, filename: img.original_filename, error: final.error_message };
            }
            const updated = await getImage(img.id);
            useImageStore.getState().upsertSessionImage(updated);
            done += 1;
            setBatchProgress({
              current: done,
              total: targets.length,
              filename: img.original_filename
            });
            return { ok: true, updated, job: final };
          } catch (err) {
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
        let lastCompletedJob = null;
        let lastUpdatedImage = null;
        for (const r of itemResults) {
          if (r.ok) {
            lastCompletedJob = r.job;
            lastUpdatedImage = r.updated;
          }
        }
        if (lastCompletedJob && lastUpdatedImage && !operationCancelRequestedRef.current) {
          useImageStore.getState().setCurrentImage(lastUpdatedImage);
          useImageStore.getState().setCurrentJob(lastCompletedJob);
        }
        const okN = itemResults.filter((r) => r.ok).length;
        batchPartialSuccessCount = okN;
        const failN = itemResults.filter((r) => !r.ok && !r.cancelled).length;
        if (!operationCancelRequestedRef.current) {
          if (failN === 0) {
            toast.success(`Batch finished \xB7 ${okN} asset(s).`);
          } else if (okN === 0) {
            toast.error(`Batch finished \xB7 all ${failN} failed.`);
          } else {
            toast.message(`Batch finished \xB7 ${okN} ok, ${failN} failed`);
          }
        }
      }
    } catch (err) {
      toastProcessingError(err, "Batch stopped");
    } finally {
      const stopped = operationCancelRequestedRef.current;
      operationCancelRequestedRef.current = false;
      setBatchProcessingIds(/* @__PURE__ */ new Set());
      setBatchProgress(null);
      setBulkRunning(false);
      if (stopped) {
        toast.message("Batch stopped", {
          description: batchPartialSuccessCount > 0 ? `${batchPartialSuccessCount} asset(s) finished; no more will start from this run. In-flight API jobs may still complete.` : "No further assets will run from this batch."
        });
      }
    }
  };
  const handleBatchProcessSelected = async () => {
    if (batchTargetsOrdered.length === 0) {
      toast.error("No assets selected for batch", {
        description: "Use the checkboxes in the queue, or Select pending / Select all."
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
  const handlersRef = useRef({
    handleProcess,
    handleBatchProcessSelected
  });
  handlersRef.current = { handleProcess, handleBatchProcessSelected };
  const selectAdjacentQueueAsset = useCallback(
    (delta) => {
      if (displayQueue.length < 2) return;
      const st = useImageStore.getState();
      const cur = st.currentImage;
      if (!cur) return;
      const i = displayQueue.findIndex((img) => img.id === cur.id);
      if (i < 0) return;
      const j = i + delta;
      if (j < 0 || j >= displayQueue.length) return;
      stopPolling();
      st.setCurrentImage(displayQueue[j]);
      st.setCurrentJob(null);
    },
    [displayQueue, stopPolling]
  );
  const isJobActive = store.currentJob?.status === "pending" || store.currentJob?.status === "processing";
  const pipelineBusy = isJobActive || bulkRunning || processing;
  const isJobCompleted = store.currentJob?.status === "completed";
  const isJobFailed = store.currentJob?.status === "failed";
  const currentImage = store.currentImage;
  const job = store.currentJob;
  const versionsOnCurrent = currentImage?.versions ?? [];
  const latestOutputVersion = getLatestImageVersion(versionsOnCurrent);
  const jobBelongsToCurrentImage = !!(job && currentImage && job.image_id === currentImage.id);
  const processingThisImage = isJobActive && jobBelongsToCurrentImage;
  const versionFromJob = jobBelongsToCurrentImage && job?.result_version_id ? versionsOnCurrent.find((v) => v.id === job.result_version_id) : void 0;
  const resultVersion = processingThisImage ? void 0 : versionFromJob ?? latestOutputVersion;
  const showDownloadForCurrent = !!store.currentImage && (store.currentImage.versions?.length ?? 0) > 0 && !isJobActive && !bulkRunning && !processing;
  const showPipelineActionDock = !!store.currentImage && !isJobActive && !isJobCompleted && !bulkRunning;
  const scrollToOperationsDownload = () => {
    document.getElementById("operations-download")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  };
  const resultActionsBar = resultVersion && store.currentImage ? /* @__PURE__ */ jsxs("div", { className: "mt-3 flex flex-col gap-2 rounded-xl border border-neutral-200 bg-neutral-50/90 px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-2 text-xs", children: [
      /* @__PURE__ */ jsx("span", { className: "font-medium text-neutral-600 shrink-0", children: "Next:" }),
      !storageOnly ? /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(
          Link,
          {
            to: "/history",
            className: "font-semibold text-black underline decoration-neutral-300 underline-offset-2 hover:decoration-black",
            children: "Deliverables"
          }
        ),
        /* @__PURE__ */ jsx("span", { className: "text-neutral-300", "aria-hidden": true, children: "\xB7" })
      ] }) : null,
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          onClick: scrollToOperationsDownload,
          className: "font-semibold text-black underline decoration-neutral-300 underline-offset-2 hover:decoration-black text-left",
          children: "Export & download"
        }
      )
    ] }),
    !storageOnly && displayQueue.length > 1 ? /* @__PURE__ */ jsxs("p", { className: "text-[10px] text-neutral-500 font-data leading-snug", children: [
      /* @__PURE__ */ jsx("kbd", { className: "rounded border border-neutral-200 bg-white px-1 py-0.5 font-mono text-[10px]", children: "[" }),
      " ",
      /* @__PURE__ */ jsx("kbd", { className: "rounded border border-neutral-200 bg-white px-1 py-0.5 font-mono text-[10px]", children: "]" }),
      " ",
      "previous / next asset"
    ] }) : null
  ] }) : null;
  useEffect(() => {
    if (!showPipelineActionDock) {
      setActionsDocked(false);
      return;
    }
    const el = pipelineActionsRowRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        setActionsDocked(!entry.isIntersecting);
      },
      { threshold: 0.06, rootMargin: "0px 0px -64px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [showPipelineActionDock, queueIdFingerprint, store.currentImage?.id]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.repeat) return;
      const target = e.target;
      if (target instanceof Element && target.closest("input, textarea, select, [contenteditable='true']")) {
        return;
      }
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "Enter") {
        if (!store.currentImage || processing || bulkRunning || isJobActive || isJobCompleted) {
          return;
        }
        if (e.shiftKey) {
          if (workspaceMode && displayQueue.length > 1 && selectedBatchCount > 0 && !processing && !bulkRunning) {
            e.preventDefault();
            void handlersRef.current.handleBatchProcessSelected();
          }
          return;
        }
        e.preventDefault();
        void handlersRef.current.handleProcess();
        return;
      }
      if (e.key !== "[" && e.key !== "]") return;
      if (mod || e.altKey || e.shiftKey) return;
      if (displayQueue.length < 2 || pipelineBusy) return;
      e.preventDefault();
      selectAdjacentQueueAsset(e.key === "[" ? -1 : 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    bulkRunning,
    displayQueue.length,
    isJobActive,
    isJobCompleted,
    pipelineBusy,
    processing,
    selectedBatchCount,
    selectAdjacentQueueAsset,
    store.currentImage,
    workspaceMode
  ]);
  useEffect(() => {
    if (!isJobActive || !store.currentJob?.id) {
      setPipelineElapsedSec(0);
      return;
    }
    const t0 = Date.now();
    setPipelineElapsedSec(0);
    const id = window.setInterval(() => {
      setPipelineElapsedSec(Math.floor((Date.now() - t0) / 1e3));
    }, 1e3);
    return () => window.clearInterval(id);
  }, [isJobActive, store.currentJob?.id]);
  const getProgressLabel = (pct) => {
    if (pct < 10) return "Starting pipeline\u2026";
    if (pct < 40) {
      return storageOnly ? "Enhancing locally\u2026" : "Enhancing with AI\u2026 (often 1\u20138 min \u2014 keep this tab open)";
    }
    if (pct < 50) return storageOnly ? "Enhancing locally\u2026" : "Saving enhanced image\u2026";
    if (pct < 85) return storageOnly ? "Upscaling in your browser\u2026" : "Upscaling with Replicate\u2026";
    if (pct < 100) return "Saving final image\u2026";
    return "Done";
  };
  return /* @__PURE__ */ jsxs("div", { className: "min-h-full min-w-0 bg-white", children: [
    /* @__PURE__ */ jsxs(
      "div",
      {
        className: `max-w-[1600px] mx-auto page-safe pt-2 sm:pt-3 md:pt-4 ${showPipelineActionDock && actionsDocked ? "pb-28 sm:pb-32 md:pb-36" : "pb-4 sm:pb-6 md:pb-10 pb-16 sm:pb-20"}`,
        children: [
          !storageOnly && store.provider !== "improve" && !hasEnhanceKey && /* @__PURE__ */ jsx(ApiKeyRequiredBanner, {}),
          isBrandNewCloudUser && /* @__PURE__ */ jsx(
            WelcomeChecklistBanner,
            {
              hasEnhanceKey,
              hasWorkspaceAsset,
              archiveVisitedOrDownloaded: archiveSeenForChecklist
            }
          ),
          /* @__PURE__ */ jsx("header", { className: "mb-6 sm:mb-8 md:mb-10", children: /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between", children: [
            /* @__PURE__ */ jsxs("div", { className: "max-w-3xl min-w-0", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500 mb-2", children: [
                /* @__PURE__ */ jsx(Orbit, { className: "w-3.5 h-3.5 text-black shrink-0", strokeWidth: 2 }),
                "Operations console"
              ] }),
              /* @__PURE__ */ jsx("h1", { className: "text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight text-black text-balance", children: storageOnly ? "Local property photo workspace" : "Enhance and export your property photos" }),
              /* @__PURE__ */ jsx("p", { className: "mt-2 sm:mt-3 text-sm md:text-base text-neutral-600 leading-relaxed", children: storageOnly ? /* @__PURE__ */ jsxs(Fragment, { children: [
                /* @__PURE__ */ jsx("span", { className: "font-medium text-black", children: "Air-gapped workspace." }),
                " Queue hundreds of frames locally, run deterministic canvas processing, export without touching a network."
              ] }) : /* @__PURE__ */ jsx(Fragment, { children: "Upload one photo or a full shoot \u2014 we'll enhance, upscale, and deliver." }) }),
              !storageOnly && !store.currentImage ? /* @__PURE__ */ jsxs(
                "nav",
                {
                  className: "mt-4 flex flex-wrap items-center gap-x-1 gap-y-2 text-xs sm:text-sm text-neutral-600",
                  "aria-label": "Quick entry points",
                  children: [
                    /* @__PURE__ */ jsx("span", { className: "mr-1 text-neutral-500", children: "Also:" }),
                    /* @__PURE__ */ jsx(
                      Link,
                      {
                        to: "/import-url",
                        className: "rounded-md px-1.5 py-0.5 font-medium text-black underline decoration-neutral-300 underline-offset-2 hover:decoration-black",
                        children: "Import from URL"
                      }
                    ),
                    /* @__PURE__ */ jsx("span", { className: "text-neutral-300", "aria-hidden": true, children: "\xB7" }),
                    /* @__PURE__ */ jsx(
                      Link,
                      {
                        to: "/image-generation",
                        className: "rounded-md px-1.5 py-0.5 font-medium text-black underline decoration-neutral-300 underline-offset-2 hover:decoration-black",
                        children: "Generate with AI"
                      }
                    ),
                    /* @__PURE__ */ jsx("span", { className: "text-neutral-300", "aria-hidden": true, children: "\xB7" }),
                    /* @__PURE__ */ jsx(
                      Link,
                      {
                        to: "/history",
                        className: "rounded-md px-1.5 py-0.5 font-medium text-black underline decoration-neutral-300 underline-offset-2 hover:decoration-black",
                        children: "Deliverables"
                      }
                    ),
                    /* @__PURE__ */ jsx("span", { className: "text-neutral-300", "aria-hidden": true, children: "\xB7" }),
                    /* @__PURE__ */ jsx(
                      Link,
                      {
                        to: "/settings",
                        className: "rounded-md px-1.5 py-0.5 font-medium text-black underline decoration-neutral-300 underline-offset-2 hover:decoration-black",
                        children: "Integrations"
                      }
                    )
                  ]
                }
              ) : null
            ] }),
            store.currentImage && displayQueue.length > 0 && /* @__PURE__ */ jsx("div", { className: "flex flex-wrap gap-2 sm:justify-end sm:shrink-0", children: workspaceMode ? /* @__PURE__ */ jsxs(
              "span",
              {
                className: "inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 font-data",
                title: "Batch workspace \u2014 queue overview",
                children: [
                  /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-1 shrink-0 text-black", children: [
                    /* @__PURE__ */ jsx(Layers, { className: "w-3.5 h-3.5", strokeWidth: 2 }),
                    "Batch workspace \xB7 ",
                    sessionCount || displayQueue.length,
                    " in queue"
                  ] }),
                  WORKSPACE_UI_SHOW_SLASH_TOTAL ? /* @__PURE__ */ jsxs(Fragment, { children: [
                    /* @__PURE__ */ jsx("span", { className: "text-neutral-300 hidden sm:inline", "aria-hidden": true, children: "\xB7" }),
                    /* @__PURE__ */ jsx(
                      "span",
                      {
                        className: "tabular-nums text-neutral-700 shrink-0",
                        title: "Assets in queue / workspace maximum",
                        children: workspaceQueueCountLabel(sessionCount || displayQueue.length)
                      }
                    )
                  ] }) : null,
                  /* @__PURE__ */ jsx("span", { className: "text-neutral-300", "aria-hidden": true, children: "\xB7" }),
                  /* @__PURE__ */ jsxs("span", { className: "tabular-nums text-black shrink-0", children: [
                    pendingCount,
                    " pending"
                  ] })
                ]
              }
            ) : /* @__PURE__ */ jsx("span", { className: "inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-800", children: "Single photo" }) })
          ] }) }),
          getShouldOfferUpgrade() && !upgradePromptDismissed && /* @__PURE__ */ jsxs("div", { className: "mb-6 rounded-2xl border border-neutral-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-black", children: "Workspace calibration is complete" }),
              /* @__PURE__ */ jsx("p", { className: "text-xs text-neutral-600 mt-1 leading-relaxed", children: "Weighted calibration from your runs is full. Adopt tier 2 when you want smarter defaults\u2014or keep classic pinned in Settings." })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 shrink-0", children: [
              /* @__PURE__ */ jsx(
                Link,
                {
                  to: "/settings",
                  className: "px-4 py-2 rounded-xl bg-black text-white text-sm font-semibold hover:bg-neutral-800 transition-colors text-center",
                  children: "Open Settings"
                }
              ),
              /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: () => dismissUpgradePrompt(),
                  className: "px-4 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors",
                  children: "Dismiss"
                }
              )
            ] })
          ] }),
          !store.currentImage && /* @__PURE__ */ jsx(DropZone, {}),
          store.currentImage && /* @__PURE__ */ jsxs(
            "div",
            {
              className: workspaceMode && displayQueue.length > 1 ? "lg:grid lg:grid-cols-[minmax(280px,360px)_1fr] lg:gap-8 xl:grid-cols-[minmax(300px,380px)_1fr]" : "",
              children: [
                workspaceMode && displayQueue.length > 1 && /* @__PURE__ */ jsxs(Fragment, { children: [
                  /* @__PURE__ */ jsx("div", { className: "order-2 mb-4 min-w-0 w-full lg:hidden", children: /* @__PURE__ */ jsxs("details", { className: "group rounded-2xl border border-neutral-200/90 bg-white overflow-hidden", children: [
                    /* @__PURE__ */ jsxs("summary", { className: "flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-sm font-semibold text-black marker:hidden [&::-webkit-details-marker]:hidden", children: [
                      /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-2 min-w-0", children: [
                        /* @__PURE__ */ jsx(Layers, { className: "h-4 w-4 shrink-0 text-neutral-600", strokeWidth: 2 }),
                        /* @__PURE__ */ jsx("span", { className: "truncate", children: "Asset queue" })
                      ] }),
                      /* @__PURE__ */ jsx("span", { className: "shrink-0 text-xs font-medium font-data tabular-nums text-neutral-500", children: displayQueue.length })
                    ] }),
                    /* @__PURE__ */ jsx("div", { className: "border-t border-neutral-100", children: /* @__PURE__ */ jsx(
                      SessionQueuePanel,
                      {
                        assets: displayQueue,
                        selectedId: store.currentImage?.id ?? null,
                        processingAssetIds: batchProcessingIds,
                        jobActive: isJobActive,
                        jobImageId: store.currentJob?.image_id ?? null,
                        onSelect: (id) => {
                          const img = displayQueue.find((i) => i.id === id);
                          if (img) {
                            useImageStore.getState().setCurrentImage(img);
                            useImageStore.getState().setCurrentJob(null);
                          }
                        },
                        onRemove: handleRemoveAsset,
                        disabled: pipelineBusy,
                        batchSelectedIds,
                        onToggleBatchSelect: toggleBatchSelect,
                        onBatchSelectAll,
                        onBatchSelectPendingOnly,
                        onBatchClearSelection,
                        variant: "embedded"
                      }
                    ) })
                  ] }) }),
                  /* @__PURE__ */ jsx("aside", { className: "mb-6 hidden lg:mb-0 lg:block lg:sticky lg:top-6 lg:self-start order-2 lg:order-1", children: /* @__PURE__ */ jsx(
                    SessionQueuePanel,
                    {
                      assets: displayQueue,
                      selectedId: store.currentImage?.id ?? null,
                      processingAssetIds: batchProcessingIds,
                      jobActive: isJobActive,
                      jobImageId: store.currentJob?.image_id ?? null,
                      onSelect: (id) => {
                        const img = displayQueue.find((i) => i.id === id);
                        if (img) {
                          useImageStore.getState().setCurrentImage(img);
                          useImageStore.getState().setCurrentJob(null);
                        }
                      },
                      onRemove: handleRemoveAsset,
                      disabled: pipelineBusy,
                      batchSelectedIds,
                      onToggleBatchSelect: toggleBatchSelect,
                      onBatchSelectAll,
                      onBatchSelectPendingOnly,
                      onBatchClearSelection
                    }
                  ) })
                ] }),
                /* @__PURE__ */ jsxs(
                  "div",
                  {
                    className: `space-y-4 sm:space-y-5 min-w-0 ${workspaceMode && displayQueue.length > 1 ? "order-1 lg:order-2" : ""}`,
                    children: [
                      storageOnly && /* @__PURE__ */ jsxs("div", { className: "rounded-2xl border border-neutral-200 bg-neutral-50 px-5 py-4 text-sm text-neutral-900", children: [
                        /* @__PURE__ */ jsx("p", { className: "font-semibold text-black", children: "Local execution region" }),
                        /* @__PURE__ */ jsxs("p", { className: "mt-2 text-neutral-700 leading-relaxed", children: [
                          "Assets persist in ",
                          /* @__PURE__ */ jsx("strong", { className: "text-black", children: "IndexedDB" }),
                          " on this workstation. For managed cloud inference (OpenAI / Gemini / Replicate), run",
                          " ",
                          /* @__PURE__ */ jsx("code", { className: "rounded-md bg-white px-1.5 py-0.5 text-xs font-data text-black border border-neutral-200", children: "npm run dev:full" }),
                          "."
                        ] })
                      ] }),
                      /* @__PURE__ */ jsx("div", { className: "max-w-3xl mb-3", children: /* @__PURE__ */ jsx(WorkflowModePicker, { variant: "compact" }) }),
                      !storageOnly && store.provider !== "improve" && hasEnhanceKey && !hasReplicateKey && !devSkipUpscale && /* @__PURE__ */ jsxs("div", { className: "rounded-2xl border border-neutral-300 bg-neutral-100 px-5 py-4 text-sm text-black", children: [
                        /* @__PURE__ */ jsx("p", { className: "font-semibold text-black", children: "Add Replicate for upscaling" }),
                        /* @__PURE__ */ jsxs("p", { className: "mt-2 text-neutral-800 leading-relaxed", children: [
                          "Add a ",
                          /* @__PURE__ */ jsx("strong", { children: "Replicate" }),
                          " token for Real-ESRGAN upscaling, or use",
                          " ",
                          /* @__PURE__ */ jsx("code", { className: "rounded bg-white px-1 font-data text-xs border border-neutral-200", children: "npm run dev" }),
                          " ",
                          "from the repo root (skips upscale in local dev so you only need OpenAI/Gemini).",
                          " ",
                          /* @__PURE__ */ jsx(
                            Link,
                            {
                              to: "/settings",
                              className: "font-semibold text-black underline decoration-neutral-400 underline-offset-2 hover:decoration-black",
                              children: "Open Settings"
                            }
                          )
                        ] })
                      ] }),
                      localDev && !storageOnly && store.provider !== "improve" && devSkipUpscale && hasEnhanceKey && /* @__PURE__ */ jsxs("div", { className: "rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4 text-sm text-sky-950", children: [
                        /* @__PURE__ */ jsx("p", { className: "font-semibold text-sky-950", children: "Local dev: upscale skipped" }),
                        /* @__PURE__ */ jsxs("p", { className: "mt-2 text-sky-900 leading-relaxed", children: [
                          "The API is running with ",
                          /* @__PURE__ */ jsx("span", { className: "font-mono text-xs", children: "LOCAL_DEV_SKIP_UPSCALE" }),
                          ". You get the ",
                          /* @__PURE__ */ jsx("strong", { children: "enhanced" }),
                          " image as the result (no Replicate billing). For full upscaling, set",
                          " ",
                          /* @__PURE__ */ jsx("code", { className: "rounded bg-white px-1 font-data text-xs border border-sky-200", children: "LOCAL_DEV_SKIP_UPSCALE=false" }),
                          " ",
                          "on the backend and add Replicate credit."
                        ] })
                      ] }),
                      workspaceMode && /* @__PURE__ */ jsx(WorkspaceBulkImportStrip, { disabled: pipelineBusy }),
                      /* @__PURE__ */ jsxs("div", { className: "rounded-2xl border border-neutral-200 bg-white overflow-hidden", children: [
                        /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-2.5 border-b border-neutral-200 bg-neutral-50 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3", children: [
                          /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
                            /* @__PURE__ */ jsx("h3", { className: "font-medium text-black text-sm truncate", children: store.currentImage.original_filename }),
                            /* @__PURE__ */ jsxs("p", { className: "text-[11px] text-neutral-500 font-data tabular-nums mt-0.5", children: [
                              workspaceMode && displayQueue.length > 1 ? /* @__PURE__ */ jsxs("span", { className: "text-neutral-600", children: [
                                displayQueue.length,
                                " in workspace \xB7 compare + thumbnails \xB7",
                                " "
                              ] }) : null,
                              store.currentImage.width,
                              " \xD7 ",
                              store.currentImage.height,
                              "px",
                              store.currentImage.file_size_bytes && ` \xB7 ${(store.currentImage.file_size_bytes / 1024 / 1024).toFixed(1)} MB`
                            ] })
                          ] }),
                          /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-stretch gap-2 sm:shrink-0 sm:justify-end", children: [
                            /* @__PURE__ */ jsx(
                              "button",
                              {
                                type: "button",
                                onClick: () => workspaceMode && displayQueue.length > 1 ? void handleWorkspaceBulkPreviewToggle() : void togglePreviewFullscreen(),
                                className: "flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-50 hover:text-black transition-colors sm:flex-initial sm:justify-center",
                                title: isPreviewFullscreen ? "Exit full screen" : workspaceMode && displayQueue.length > 1 ? "Full screen \xB7 all photos in a grid" : "Full screen preview",
                                children: isPreviewFullscreen ? /* @__PURE__ */ jsxs(Fragment, { children: [
                                  /* @__PURE__ */ jsx(Minimize2, { className: "w-3.5 h-3.5 shrink-0" }),
                                  /* @__PURE__ */ jsx("span", { className: "hidden sm:inline", children: "Exit full screen" }),
                                  /* @__PURE__ */ jsx("span", { className: "sm:hidden", children: "Exit" })
                                ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
                                  /* @__PURE__ */ jsx(Maximize2, { className: "w-3.5 h-3.5 shrink-0" }),
                                  workspaceMode && displayQueue.length > 1 ? /* @__PURE__ */ jsxs(Fragment, { children: [
                                    /* @__PURE__ */ jsx("span", { className: "hidden sm:inline", children: "Full screen (all)" }),
                                    /* @__PURE__ */ jsx("span", { className: "sm:hidden", children: "All photos" })
                                  ] }) : "Full screen"
                                ] })
                              }
                            ),
                            /* @__PURE__ */ jsxs(
                              "button",
                              {
                                type: "button",
                                onClick: () => {
                                  stopPolling();
                                  useImageStore.getState().reset();
                                },
                                className: "flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-neutral-500 hover:bg-neutral-100 hover:text-black transition-colors sm:flex-initial",
                                children: [
                                  /* @__PURE__ */ jsx(Upload, { className: "w-3.5 h-3.5 shrink-0" }),
                                  /* @__PURE__ */ jsx("span", { className: "truncate", children: workspaceMode ? "Clear workspace" : "Start over" })
                                ]
                              }
                            )
                          ] })
                        ] }),
                        /* @__PURE__ */ jsx(
                          "div",
                          {
                            ref: previewFsRef,
                            className: `p-2 sm:p-4 ${isPreviewFullscreen ? "min-h-[100dvh] flex flex-col bg-black" : ""}`,
                            children: workspaceMode && displayQueue.length > 1 ? /* @__PURE__ */ jsxs(Fragment, { children: [
                              resultVersion && store.currentImage ? /* @__PURE__ */ jsxs("div", { id: WORKSPACE_COMPARE_ANCHOR, className: "scroll-mt-4 mb-4 sm:mb-5", children: [
                                /* @__PURE__ */ jsx(
                                  BeforeAfterSlider,
                                  {
                                    imageId: store.currentImage.id,
                                    resultVersionId: resultVersion.id,
                                    resultVersionType: resultVersion.version_type,
                                    aiNamingProvider: aiNamingProviders.includes("gemini") ? "gemini" : aiNamingProviders.includes("openai") ? "openai" : null,
                                    originalFilename: store.currentImage.original_filename,
                                    originalMeta: {
                                      width: store.currentImage.width,
                                      height: store.currentImage.height,
                                      fileSizeBytes: store.currentImage.file_size_bytes
                                    },
                                    resultMeta: {
                                      width: resultVersion.width,
                                      height: resultVersion.height,
                                      fileSizeBytes: resultVersion.file_size_bytes,
                                      scaleFactor: resultVersion.scale_factor
                                    },
                                    viewportMode: isPreviewFullscreen ? "fullscreen" : "default",
                                    defaultViewMode: "sideBySide"
                                  }
                                ),
                                resultActionsBar,
                                /* @__PURE__ */ jsxs("p", { className: "mt-3 text-[11px] text-neutral-500 leading-snug", children: [
                                  "Same compare tools as ",
                                  /* @__PURE__ */ jsx("span", { className: "font-medium text-neutral-700", children: "Single" }),
                                  " flow \u2014 pick another asset in the grids below to switch this view."
                                ] })
                              ] }) : null,
                              bulkExportEligibleImages.length > 0 ? /* @__PURE__ */ jsx(
                                WorkspaceBulkResultsPreview,
                                {
                                  images: bulkExportEligibleImages,
                                  selectedId: store.currentImage?.id ?? "",
                                  onSelect: (id) => {
                                    const st = useImageStore.getState();
                                    const img = st.sessionImages.find((i) => i.id === id);
                                    if (!img) return;
                                    stopPolling();
                                    st.setCurrentImage(img);
                                    st.setCurrentJob(null);
                                  }
                                }
                              ) : null,
                              /* @__PURE__ */ jsx(
                                WorkspaceBulkOriginalsPreview,
                                {
                                  images: displayQueue,
                                  selectedId: store.currentImage?.id ?? "",
                                  isFullscreen: isPreviewFullscreen,
                                  layout: workspaceBulkFsLayout,
                                  focusImageId: workspaceBulkFocusId,
                                  onThumbnailActivate: (id) => void handleWorkspaceBulkThumbActivate(id),
                                  onBackToFullscreenGrid: handleWorkspaceBulkBackToGrid,
                                  onRemoveFromWorkspace: handleRemoveAsset,
                                  removeDisabled: pipelineBusy
                                }
                              )
                            ] }) : resultVersion ? /* @__PURE__ */ jsxs(Fragment, { children: [
                              /* @__PURE__ */ jsx(
                                BeforeAfterSlider,
                                {
                                  imageId: store.currentImage.id,
                                  resultVersionId: resultVersion.id,
                                  resultVersionType: resultVersion.version_type,
                                  aiNamingProvider: aiNamingProviders.includes("gemini") ? "gemini" : aiNamingProviders.includes("openai") ? "openai" : null,
                                  originalFilename: store.currentImage.original_filename,
                                  originalMeta: {
                                    width: store.currentImage.width,
                                    height: store.currentImage.height,
                                    fileSizeBytes: store.currentImage.file_size_bytes
                                  },
                                  resultMeta: {
                                    width: resultVersion.width,
                                    height: resultVersion.height,
                                    fileSizeBytes: resultVersion.file_size_bytes,
                                    scaleFactor: resultVersion.scale_factor
                                  },
                                  viewportMode: isPreviewFullscreen ? "fullscreen" : "default",
                                  defaultViewMode: "sideBySide"
                                }
                              ),
                              resultActionsBar
                            ] }) : /* @__PURE__ */ jsx(
                              "div",
                              {
                                className: `relative rounded-xl overflow-hidden flex items-center justify-center min-h-[200px] ${isPreviewFullscreen ? "bg-neutral-900 flex-1" : "bg-neutral-100"}`,
                                children: imageLoading ? /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center gap-3 py-12", children: [
                                  /* @__PURE__ */ jsx(Loader2, { className: "w-8 h-8 animate-spin text-black" }),
                                  /* @__PURE__ */ jsx("p", { className: "text-sm text-neutral-500", children: "Loading asset\u2026" })
                                ] }) : originalImageUrl ? /* @__PURE__ */ jsx(
                                  FullscreenImageRegion,
                                  {
                                    className: `w-full min-h-[200px] flex items-center justify-center ${isPreviewFullscreen ? "min-h-[calc(100dvh-8rem)]" : ""}`,
                                    children: /* @__PURE__ */ jsx(
                                      OptimizedImage,
                                      {
                                        priority: true,
                                        src: originalImageUrl,
                                        alt: store.currentImage.original_filename,
                                        className: `w-auto max-w-full object-contain rounded-lg ${isPreviewFullscreen ? "max-h-[calc(100dvh-6rem)]" : "max-h-[min(450px,52dvh)] sm:max-h-[450px]"}`
                                      }
                                    )
                                  }
                                ) : /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center gap-3 py-12", children: [
                                  /* @__PURE__ */ jsx(ImageIcon, { className: "w-12 h-12 text-neutral-300" }),
                                  /* @__PURE__ */ jsx("p", { className: "text-sm text-neutral-500", children: "Preview unavailable" })
                                ] })
                              }
                            )
                          }
                        )
                      ] }),
                      resultVersion && store.currentImage && /* @__PURE__ */ jsx(GenerationRecipePanel, { version: resultVersion, onEditSettings: handleEditPipelineFromRecipe }),
                      !isJobActive && !isJobCompleted && !bulkRunning && /* @__PURE__ */ jsxs("div", { id: "pipeline-settings", className: "grid grid-cols-1 lg:grid-cols-2 gap-6 scroll-mt-8", children: [
                        /* @__PURE__ */ jsx(EnhancePanel, {}),
                        /* @__PURE__ */ jsx(UpscalePanel, {})
                      ] }),
                      !isJobActive && !isJobCompleted && !bulkRunning && /* @__PURE__ */ jsxs("div", { className: "rounded-2xl border border-neutral-200 bg-white p-4 sm:p-6", children: [
                        store.costEstimate && /* @__PURE__ */ jsxs("div", { className: "mb-5 p-4 rounded-xl border border-neutral-200 bg-neutral-50", children: [
                          /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-end justify-between gap-3", children: [
                            /* @__PURE__ */ jsxs("div", { children: [
                              /* @__PURE__ */ jsx("p", { className: "text-xs font-semibold uppercase tracking-wider text-neutral-500", children: "Estimated unit cost" }),
                              /* @__PURE__ */ jsxs("p", { className: "text-2xl font-semibold text-black font-data tabular-nums mt-1", children: [
                                "$",
                                store.costEstimate.total_cost.toFixed(4)
                              ] })
                            ] }),
                            workspaceMode && displayQueue.length > 1 && !storageOnly && /* @__PURE__ */ jsx("div", { className: "text-right min-w-0", children: selectedBatchCount > 0 && selectedPendingCount > 0 ? /* @__PURE__ */ jsxs(Fragment, { children: [
                              /* @__PURE__ */ jsxs("p", { className: "text-[10px] font-semibold uppercase tracking-wider text-neutral-500", children: [
                                "Selection \xB7 ",
                                selectedPendingCount,
                                " pending (of ",
                                selectedBatchCount,
                                " selected)"
                              ] }),
                              /* @__PURE__ */ jsxs("p", { className: "text-lg font-semibold text-black font-data tabular-nums", children: [
                                "~$",
                                (store.costEstimate.total_cost * selectedPendingCount).toFixed(2)
                              ] }),
                              /* @__PURE__ */ jsx("p", { className: "text-[10px] text-neutral-500 mt-1 max-w-[14rem] ml-auto leading-snug", children: "Re-runs on completed rows use similar API usage; this line counts only never-processed rows in your selection." })
                            ] }) : selectedBatchCount > 0 && selectedPendingCount === 0 ? /* @__PURE__ */ jsxs(Fragment, { children: [
                              /* @__PURE__ */ jsxs("p", { className: "text-[10px] font-semibold uppercase tracking-wider text-neutral-500", children: [
                                "Selection \xB7 ",
                                selectedBatchCount,
                                " re-run(s), 0 new"
                              ] }),
                              /* @__PURE__ */ jsxs("p", { className: "text-lg font-semibold text-black font-data tabular-nums", children: [
                                "~$",
                                (store.costEstimate.total_cost * selectedBatchCount).toFixed(2)
                              ] }),
                              /* @__PURE__ */ jsx("p", { className: "text-[10px] text-neutral-500 mt-1 max-w-[14rem] ml-auto leading-snug", children: "Rough ceiling: unit cost \xD7 selected rows (all already have outputs)." })
                            ] }) : pendingCount > 0 ? /* @__PURE__ */ jsxs(Fragment, { children: [
                              /* @__PURE__ */ jsxs("p", { className: "text-[10px] font-semibold uppercase tracking-wider text-neutral-500", children: [
                                "All pending in queue (",
                                pendingCount,
                                ")"
                              ] }),
                              /* @__PURE__ */ jsxs("p", { className: "text-lg font-semibold text-black font-data tabular-nums", children: [
                                "~$",
                                (store.costEstimate.total_cost * pendingCount).toFixed(2)
                              ] })
                            ] }) : null })
                          ] }),
                          /* @__PURE__ */ jsx("p", { className: "text-xs text-neutral-500 mt-2", children: store.costEstimate.details })
                        ] }),
                        /* @__PURE__ */ jsxs("div", { ref: pipelineActionsRowRef, className: "flex flex-col flex-wrap gap-3 lg:flex-row", children: [
                          /* @__PURE__ */ jsx(
                            "button",
                            {
                              type: "button",
                              onClick: handleProcess,
                              disabled: processing || bulkRunning,
                              className: "flex-1 min-h-[48px] py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 bg-black text-white hover:bg-neutral-800",
                              children: processing ? /* @__PURE__ */ jsxs(Fragment, { children: [
                                /* @__PURE__ */ jsx(Loader2, { className: "w-5 h-5 animate-spin" }),
                                "Starting\u2026"
                              ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
                                /* @__PURE__ */ jsx(Wand2, { className: "w-5 h-5" }),
                                "Run pipeline \xB7 current asset"
                              ] })
                            }
                          ),
                          workspaceMode && displayQueue.length > 1 && /* @__PURE__ */ jsxs(Fragment, { children: [
                            /* @__PURE__ */ jsxs(
                              "button",
                              {
                                type: "button",
                                onClick: () => void handleBatchProcessSelected(),
                                disabled: processing || bulkRunning || selectedBatchCount === 0,
                                className: "flex-1 min-h-[48px] py-3.5 rounded-xl font-semibold text-sm bg-black text-white hover:bg-neutral-800 disabled:opacity-45 transition-colors flex items-center justify-center gap-2",
                                children: [
                                  /* @__PURE__ */ jsx(Layers, { className: "w-5 h-5 text-white" }),
                                  "Run batch on selected (",
                                  selectedBatchCount,
                                  ")"
                                ]
                              }
                            ),
                            /* @__PURE__ */ jsxs(
                              "button",
                              {
                                type: "button",
                                onClick: () => void handleBatchProcessAllPendingShortcut(),
                                disabled: processing || bulkRunning || pendingCount === 0,
                                className: "flex-1 min-h-[48px] py-3.5 rounded-xl font-semibold text-sm border border-neutral-300 bg-white text-black hover:bg-neutral-50 disabled:opacity-45 transition-colors flex items-center justify-center gap-2",
                                children: [
                                  "All pending (",
                                  pendingCount,
                                  ")"
                                ]
                              }
                            ),
                            /* @__PURE__ */ jsxs(
                              "button",
                              {
                                type: "button",
                                onClick: () => void handleBatchProcessEntireQueueShortcut(),
                                disabled: processing || bulkRunning,
                                className: "py-3.5 px-3 rounded-xl text-xs font-semibold text-neutral-500 border border-dashed border-neutral-400 hover:border-black hover:text-black disabled:opacity-45 transition-colors sm:max-w-[11rem]",
                                title: "Re-run pipeline on every asset in the workspace queue",
                                children: [
                                  "Entire queue (",
                                  displayQueue.length,
                                  ")"
                                ]
                              }
                            )
                          ] })
                        ] }),
                        workspaceMode && displayQueue.length > 1 && /* @__PURE__ */ jsxs("p", { className: "text-[11px] text-neutral-500 mt-3 leading-relaxed", children: [
                          "Check rows in the queue, then ",
                          /* @__PURE__ */ jsx("strong", { className: "text-neutral-700", children: "Run batch on selected" }),
                          " ",
                          "to process only those assets in order",
                          WORKSPACE_UI_SHOW_SLASH_TOTAL ? ` (up to ${MAX_WORKSPACE_ASSETS} in a workspace)` : " (large queues supported)",
                          ".",
                          " ",
                          /* @__PURE__ */ jsx("strong", { className: "text-neutral-700", children: "All pending" }),
                          " skips the checkboxes and runs every not-yet-processed row.                   ",
                          /* @__PURE__ */ jsx("strong", { className: "text-neutral-700", children: "Entire queue" }),
                          " re-runs the pipeline on every row (higher cost). Remote batch runs several API jobs in parallel (throttled)."
                        ] }),
                        /* @__PURE__ */ jsxs("p", { className: "text-[10px] text-neutral-400 mt-3 leading-snug font-data", children: [
                          "Shortcuts:",
                          " ",
                          /* @__PURE__ */ jsx("kbd", { className: "rounded border border-neutral-200 bg-white px-1 py-0.5 font-mono text-[10px]", children: modKeyChar }),
                          /* @__PURE__ */ jsx("kbd", { className: "ml-0.5 rounded border border-neutral-200 bg-white px-1 py-0.5 font-mono text-[10px]", children: "Enter" }),
                          " ",
                          "run current",
                          workspaceMode && displayQueue.length > 1 && selectedBatchCount > 0 ? /* @__PURE__ */ jsxs(Fragment, { children: [
                            " \xB7 ",
                            /* @__PURE__ */ jsx("kbd", { className: "rounded border border-neutral-200 bg-white px-1 py-0.5 font-mono text-[10px]", children: modKeyChar }),
                            /* @__PURE__ */ jsx("kbd", { className: "ml-0.5 rounded border border-neutral-200 bg-white px-1 py-0.5 font-mono text-[10px]", children: "Shift" }),
                            /* @__PURE__ */ jsx("kbd", { className: "ml-0.5 rounded border border-neutral-200 bg-white px-1 py-0.5 font-mono text-[10px]", children: "Enter" }),
                            " ",
                            "batch (",
                            selectedBatchCount,
                            " selected)"
                          ] }) : null,
                          displayQueue.length > 1 ? /* @__PURE__ */ jsxs(Fragment, { children: [
                            " \xB7 ",
                            /* @__PURE__ */ jsx("kbd", { className: "rounded border border-neutral-200 bg-white px-1 py-0.5 font-mono text-[10px]", children: "[" }),
                            /* @__PURE__ */ jsx("kbd", { className: "ml-0.5 rounded border border-neutral-200 bg-white px-1 py-0.5 font-mono text-[10px]", children: "]" }),
                            " ",
                            "prev / next asset"
                          ] }) : null
                        ] })
                      ] }),
                      bulkRunning && batchProgress && !isJobActive && /* @__PURE__ */ jsxs("div", { className: "rounded-2xl border border-neutral-200 bg-white p-4 sm:p-6", children: [
                        /* @__PURE__ */ jsxs("div", { className: "mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4", children: [
                          /* @__PURE__ */ jsxs("div", { className: "flex min-w-0 flex-1 gap-3 sm:items-center", children: [
                            /* @__PURE__ */ jsx("div", { className: "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-100", children: /* @__PURE__ */ jsx(Loader2, { className: "h-6 w-6 animate-spin text-black" }) }),
                            /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
                              /* @__PURE__ */ jsx("p", { className: "font-semibold text-black", children: "Concurrent batch" }),
                              /* @__PURE__ */ jsxs("p", { className: "mt-0.5 text-sm text-neutral-600", children: [
                                batchProgress.current,
                                "/",
                                batchProgress.total,
                                " complete",
                                batchProgress.filename ? /* @__PURE__ */ jsxs("span", { className: "text-neutral-500", children: [
                                  " \xB7 last: ",
                                  batchProgress.filename
                                ] }) : null
                              ] }),
                              /* @__PURE__ */ jsxs("p", { className: "mt-1 text-[11px] text-neutral-500 leading-snug", children: [
                                "Up to ",
                                getBatchPipelineConcurrency(),
                                " pipelines in flight against the API. Keep this tab open."
                              ] })
                            ] })
                          ] }),
                          /* @__PURE__ */ jsxs(
                            "button",
                            {
                              type: "button",
                              onClick: handleStopOperation,
                              className: "inline-flex w-full shrink-0 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-800 hover:bg-red-50 transition-colors sm:w-auto sm:self-center",
                              children: [
                                /* @__PURE__ */ jsx(Ban, { className: "h-3.5 w-3.5 shrink-0", strokeWidth: 2 }),
                                "Stop"
                              ]
                            }
                          )
                        ] }),
                        /* @__PURE__ */ jsx("div", { className: "h-2.5 w-full overflow-hidden rounded-full bg-neutral-200", children: /* @__PURE__ */ jsx(
                          "div",
                          {
                            className: "h-full rounded-full bg-black transition-all duration-500 ease-out",
                            style: {
                              width: `${Math.min(100, batchProgress.current / Math.max(1, batchProgress.total) * 100)}%`
                            }
                          }
                        ) }),
                        /* @__PURE__ */ jsx("p", { className: "mt-2 text-[10px] text-neutral-500 leading-snug", children: "Stop skips assets that have not started yet and stops polling for this batch. Jobs already running on the API may still complete." })
                      ] }),
                      isJobActive && store.currentJob && /* @__PURE__ */ jsxs("div", { className: "rounded-2xl border border-neutral-200 bg-white p-4 sm:p-6", children: [
                        batchProgress && /* @__PURE__ */ jsxs("p", { className: "text-[11px] font-semibold uppercase tracking-wider text-neutral-600 mb-3 font-data break-words", children: [
                          "Batch ",
                          batchProgress.current,
                          "/",
                          batchProgress.total,
                          " \xB7 ",
                          batchProgress.filename
                        ] }),
                        /* @__PURE__ */ jsxs("div", { className: "mb-4 flex items-center gap-4 sm:min-w-0", children: [
                          /* @__PURE__ */ jsx("div", { className: "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-100", children: /* @__PURE__ */ jsx(Loader2, { className: "h-6 w-6 animate-spin text-black" }) }),
                          /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
                            /* @__PURE__ */ jsx("p", { className: "font-semibold text-black", children: "Pipeline active" }),
                            /* @__PURE__ */ jsx("p", { className: "mt-0.5 text-sm text-neutral-500 sm:truncate", children: getProgressLabel(store.currentJob.progress_pct) }),
                            !storageOnly && pipelineElapsedSec > 0 ? /* @__PURE__ */ jsxs("p", { className: "mt-1 text-[11px] text-neutral-400 font-data tabular-nums leading-snug", children: [
                              "Elapsed ",
                              Math.floor(pipelineElapsedSec / 60),
                              "m ",
                              pipelineElapsedSec % 60,
                              "s \u2014 the bar still moves slowly while OpenAI / Replicate run"
                            ] }) : null
                          ] })
                        ] }),
                        /* @__PURE__ */ jsx("div", { className: "w-full bg-neutral-200 rounded-full h-2.5 overflow-hidden", children: /* @__PURE__ */ jsx(
                          "div",
                          {
                            className: "h-full rounded-full transition-all duration-700 ease-out bg-black",
                            style: {
                              width: `${store.currentJob.progress_pct}%`
                            }
                          }
                        ) }),
                        /* @__PURE__ */ jsx("div", { className: "flex justify-between mt-3 text-[10px] uppercase tracking-wider text-neutral-400 font-semibold", children: (() => {
                          const p = store.currentJob.progress_pct;
                          return /* @__PURE__ */ jsxs(Fragment, { children: [
                            /* @__PURE__ */ jsx("span", { className: p < 10 ? "text-black" : "", children: "Ingest" }),
                            /* @__PURE__ */ jsx("span", { className: p >= 10 && p < 50 ? "text-black" : "", children: "Enhance" }),
                            /* @__PURE__ */ jsx("span", { className: p >= 50 && p < 85 ? "text-black" : "", children: "Upscale" }),
                            /* @__PURE__ */ jsx("span", { className: p >= 85 ? "text-black" : "", children: "Commit" })
                          ] });
                        })() }),
                        /* @__PURE__ */ jsxs("div", { className: "mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-neutral-200/90 pt-4", children: [
                          /* @__PURE__ */ jsxs(
                            "button",
                            {
                              type: "button",
                              onClick: handleStopOperation,
                              className: "inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-800 hover:bg-red-50 transition-colors",
                              children: [
                                /* @__PURE__ */ jsx(Ban, { className: "h-3.5 w-3.5 shrink-0", strokeWidth: 2 }),
                                "Stop"
                              ]
                            }
                          ),
                          /* @__PURE__ */ jsxs("span", { className: "text-2xl font-bold text-black tabular-nums font-data", children: [
                            store.currentJob.progress_pct,
                            "%"
                          ] })
                        ] }),
                        /* @__PURE__ */ jsx("p", { className: "mt-2 text-[10px] text-neutral-500 leading-snug", children: "Stop stops this tab from watching the job and cancels queued batch work. A run that already started on the server may still finish." })
                      ] }),
                      isJobCompleted && store.currentJob && !resultVersion && /* @__PURE__ */ jsxs("div", { className: "bg-white border border-neutral-200 rounded-2xl p-6 flex items-center gap-4", children: [
                        /* @__PURE__ */ jsx(CheckCircle2, { className: "w-8 h-8 text-black" }),
                        /* @__PURE__ */ jsxs("div", { children: [
                          /* @__PURE__ */ jsx("p", { className: "font-semibold text-black", children: "Processing complete" }),
                          /* @__PURE__ */ jsx("p", { className: "text-sm text-neutral-600 mt-0.5", children: "Your enhanced image is ready." })
                        ] })
                      ] }),
                      isJobFailed && store.currentJob && /* @__PURE__ */ jsxs("div", { className: "bg-neutral-50 border border-neutral-300 rounded-2xl p-5 flex items-start gap-4", children: [
                        /* @__PURE__ */ jsx(AlertCircle, { className: "w-6 h-6 text-black flex-shrink-0 mt-0.5" }),
                        /* @__PURE__ */ jsxs("div", { className: "flex-1", children: [
                          /* @__PURE__ */ jsx("p", { className: "font-semibold text-black", children: "Processing failed" }),
                          /* @__PURE__ */ jsx("p", { className: "text-sm text-neutral-700 mt-1", children: store.currentJob.error_message })
                        ] }),
                        /* @__PURE__ */ jsx(
                          "button",
                          {
                            type: "button",
                            onClick: () => useImageStore.getState().setCurrentJob(null),
                            className: "text-sm font-medium text-black px-3 py-1.5 rounded-lg border border-neutral-300 hover:bg-white transition-colors",
                            children: "Try again"
                          }
                        )
                      ] }),
                      workspaceMode && bulkExportEligibleImages.length >= 1 && /* @__PURE__ */ jsx(
                        WorkspaceOutputPreviewStrip,
                        {
                          images: bulkExportEligibleImages,
                          selectedId: store.currentImage?.id ?? null,
                          onSelect: (id) => {
                            const img = store.sessionImages.find((i) => i.id === id);
                            if (!img) return;
                            stopPolling();
                            useImageStore.getState().setCurrentImage(img);
                            useImageStore.getState().setCurrentJob(null);
                          }
                        }
                      ),
                      showBulkExport && /* @__PURE__ */ jsx(
                        BulkExportBar,
                        {
                          images: bulkExportEligibleImages,
                          aiNamingProviders: storageOnly ? [] : aiNamingProviders
                        }
                      ),
                      showDownloadForCurrent && store.currentImage && /* @__PURE__ */ jsx("div", { id: "operations-download", className: "scroll-mt-28 lg:scroll-mt-32", children: /* @__PURE__ */ jsx(
                        DownloadPanel,
                        {
                          imageId: store.currentImage.id,
                          versions: store.currentImage.versions,
                          originalFilename: store.currentImage.original_filename,
                          aiNamingProviders: storageOnly ? [] : aiNamingProviders,
                          onEditVersionSettings: () => handleEditPipelineFromRecipe()
                        }
                      ) })
                    ]
                  }
                )
              ]
            }
          ),
          workspaceMode && /* @__PURE__ */ jsx(WorkspaceArchivePanel, {})
        ]
      }
    ),
    showPipelineActionDock && actionsDocked ? /* @__PURE__ */ jsx(
      "div",
      {
        className: "fixed bottom-0 left-0 right-0 z-50 border-t border-neutral-200 bg-white/95 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_32px_rgba(0,0,0,0.07)] backdrop-blur-md supports-[backdrop-filter]:bg-white/88 lg:left-[17rem]",
        role: "region",
        "aria-label": "Quick pipeline actions",
        children: /* @__PURE__ */ jsxs("div", { className: "mx-auto flex max-w-[1600px] flex-col gap-2 page-safe sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3", children: [
          store.costEstimate ? /* @__PURE__ */ jsxs("p", { className: "order-2 text-center text-[11px] text-neutral-500 sm:order-1 sm:min-w-0 sm:flex-1 sm:text-left", children: [
            /* @__PURE__ */ jsxs("span", { className: "font-data font-semibold text-neutral-900", children: [
              "$",
              store.costEstimate.total_cost.toFixed(4)
            ] }),
            /* @__PURE__ */ jsx("span", { className: "hidden sm:inline", children: " \xB7 unit estimate" })
          ] }) : /* @__PURE__ */ jsx("span", { className: "order-2 hidden sm:order-1 sm:block sm:min-w-0 sm:flex-1" }),
          /* @__PURE__ */ jsxs("div", { className: "order-1 flex w-full min-w-0 flex-wrap justify-stretch gap-2 sm:order-2 sm:w-auto sm:max-w-[70%] sm:justify-end", children: [
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: () => void handlersRef.current.handleProcess(),
                disabled: processing || bulkRunning,
                className: "min-h-[48px] min-w-0 flex-1 rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 disabled:opacity-50 sm:min-w-[12rem] sm:flex-initial",
                children: processing ? /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center justify-center gap-2", children: [
                  /* @__PURE__ */ jsx(Loader2, { className: "h-5 w-5 animate-spin shrink-0" }),
                  "Starting\u2026"
                ] }) : /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center justify-center gap-2", children: [
                  /* @__PURE__ */ jsx(Wand2, { className: "h-5 w-5 shrink-0" }),
                  "Run pipeline"
                ] })
              }
            ),
            workspaceMode && displayQueue.length > 1 && selectedBatchCount > 0 ? /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: () => void handlersRef.current.handleBatchProcessSelected(),
                disabled: processing || bulkRunning,
                className: "min-h-[48px] min-w-0 flex-1 rounded-xl border border-neutral-300 bg-white px-3 py-3 text-sm font-semibold text-black transition-colors hover:bg-neutral-50 disabled:opacity-45 sm:flex-initial",
                children: /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center justify-center gap-2", children: [
                  /* @__PURE__ */ jsx(Layers, { className: "h-5 w-5 shrink-0" }),
                  "Batch (",
                  selectedBatchCount,
                  ")"
                ] })
              }
            ) : null
          ] })
        ] })
      }
    ) : null
  ] });
}
export {
  DashboardPage as default
};

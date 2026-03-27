import { Download, FileImage, Loader2, SlidersHorizontal, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import type { ImageVersion } from "../../types";
import client from "../../api/client";
import { suggestFilename } from "../../api/images";
import { getLocalBlob } from "../../lib/localImageStore";
import {
  DOWNLOAD_FORMAT_OPTIONS,
  DOWNLOAD_SIZE_OPTIONS,
  EXPORT_NAMING_PRESET_OPTIONS,
  appendSizeToFilename,
  buildExportStem,
  downloadFilenameStem,
  exportDownloadBlob,
  type DownloadFormatId,
  type DownloadMaxEdgeId,
  type ExportNamingPresetId,
} from "../../lib/downloadExport";
import { isStorageOnlyMode } from "../../lib/storageOnlyMode";
import { toast } from "sonner";
import { toastProcessingError } from "../../lib/processingToast";
import VersionRecipeInline from "../pipeline/VersionRecipeInline";

interface Props {
  imageId: string;
  versions: ImageVersion[];
  originalFilename: string;
  aiNamingProviders?: ("openai" | "gemini")[];
  /** Per-version: jump to pipeline settings (params applied in the recipe block). */
  onEditVersionSettings?: (version: ImageVersion) => void;
}

const VERSION_LABELS: Record<string, string> = {
  enhanced: "AI Enhanced",
  upscaled: "Upscaled",
  final: "Final (Enhanced + Upscaled)",
};

type QuickTarget = "latest" | "original";

export default function DownloadPanel({
  imageId,
  versions,
  originalFilename,
  aiNamingProviders = [],
  onEditVersionSettings,
}: Props) {
  const storageOnly = isStorageOnlyMode();
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<DownloadFormatId>("webp_near_lossless");
  const [maxEdge, setMaxEdge] = useState<DownloadMaxEdgeId>("full");
  const [quickTarget, setQuickTarget] = useState<QuickTarget>("latest");
  const [namingPreset, setNamingPreset] = useState<ExportNamingPresetId>("pipeline");
  const [customBase, setCustomBase] = useState("");
  const [aiBaseStem, setAiBaseStem] = useState<string | null>(null);
  const [aiProvider, setAiProvider] = useState<"openai" | "gemini">(
    aiNamingProviders.includes("openai") ? "openai" : "gemini"
  );
  const [aiLoading, setAiLoading] = useState(false);

  const latestVersion = versions[versions.length - 1];
  const canAi = !storageOnly && aiNamingProviders.length > 0;

  useEffect(() => {
    if (maxEdge !== "full") {
      setExportFormat((f) => (f === "as_stored" ? "webp_near_lossless" : f));
    }
  }, [maxEdge]);

  useEffect(() => {
    if (!aiNamingProviders.includes(aiProvider) && aiNamingProviders.length) {
      setAiProvider(aiNamingProviders.includes("openai") ? "openai" : "gemini");
    }
  }, [aiNamingProviders, aiProvider]);

  if (!versions?.length) return null;

  const rowKey = (suffix: string) => `${suffix}::${exportFormat}::${maxEdge}`;

  const stemForRow = (
    kind: "original" | "version",
    v?: ImageVersion
  ): string => {
    if (aiBaseStem) {
      return buildExportStem({
        preset: namingPreset,
        customBase,
        aiBase: aiBaseStem,
        originalFilename,
        kind,
        versionType: v?.version_type,
        width: v?.width,
        height: v?.height,
      });
    }
    return buildExportStem({
      preset: namingPreset,
      customBase,
      aiBase: null,
      originalFilename,
      kind,
      versionType: v?.version_type,
      width: v?.width,
      height: v?.height,
    });
  };

  /** Preview stem when pipeline preset would apply (no AI). */
  const defaultStemHint = (kind: "original" | "version", v?: ImageVersion) =>
    downloadFilenameStem(
      kind,
      v?.version_type,
      v?.width ?? undefined,
      v?.height ?? undefined
    );

  const handleDownload = async (
    versionId: string | undefined,
    stem: string,
    logicalId: string
  ) => {
    const key = rowKey(logicalId);
    setDownloadingKey(key);
    try {
      let blob: Blob;
      if (storageOnly) {
        const b = await getLocalBlob(imageId, versionId);
        if (!b) throw new Error("Not found");
        blob = b;
      } else {
        let url = `/images/${imageId}/download`;
        if (versionId) url += `?version=${versionId}`;
        const res = await client.get(url, { responseType: "blob" });
        blob = res.data;
      }

      const { blob: out, extension } = await exportDownloadBlob(blob, exportFormat, maxEdge);
      const filename = appendSizeToFilename(stem, maxEdge, extension);

      const blobUrl = URL.createObjectURL(out);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);

      const mb = (out.size / (1024 * 1024)).toFixed(1);
      toast.success("Download started", {
        description: `${filename} · about ${mb} MB`,
        duration: 4000,
      });
    } catch {
      toast.error("Failed to prepare download", {
        description: "Try another format, a smaller max size, or PNG if WebP isn’t supported.",
        duration: 6500,
      });
    } finally {
      setDownloadingKey(null);
    }
  };

  const runAiSuggest = async () => {
    if (!canAi || !latestVersion) return;
    setAiLoading(true);
    try {
      const basename = await suggestFilename(imageId, {
        version: latestVersion.id,
        provider: aiProvider,
      });
      setAiBaseStem(basename);
      toast.success("AI filename ready", {
        description: `Base: ${basename} (suffix added per row).`,
        duration: 4000,
      });
    } catch (err: unknown) {
      toastProcessingError(err, "AI suggest failed");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-neutral-200/90 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Download className="w-5 h-5 text-black" />
        Download results
      </h3>

      <div className="mb-5 rounded-xl border border-neutral-200 bg-neutral-50/80 p-4">
        <div className="flex items-start gap-2 mb-3">
          <SlidersHorizontal className="w-4 h-4 text-neutral-600 mt-0.5 shrink-0" strokeWidth={2} />
          <div>
            <p className="text-sm font-semibold text-black">Export quality & size</p>
            <p className="text-xs text-neutral-600 mt-1 leading-relaxed">
              Default <strong className="text-black">WebP near-lossless</strong> keeps excellent detail with much
              smaller files than PNG. Use <strong className="text-black">as stored</strong> only for a byte-identical
              copy at full resolution. Shorter long edge = lower MB.
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              File format
            </span>
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as DownloadFormatId)}
              className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-neutral-300"
            >
              {DOWNLOAD_FORMAT_OPTIONS.map((o) => (
                <option key={o.id} value={o.id} disabled={o.id === "as_stored" && maxEdge !== "full"}>
                  {o.label}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[11px] text-neutral-500 leading-snug">
              {DOWNLOAD_FORMAT_OPTIONS.find((x) => x.id === exportFormat)?.hint}
            </span>
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Max long edge
            </span>
            <select
              value={maxEdge}
              onChange={(e) => setMaxEdge(e.target.value as DownloadMaxEdgeId)}
              className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-neutral-300"
            >
              {DOWNLOAD_SIZE_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[11px] text-neutral-500 leading-snug">
              {DOWNLOAD_SIZE_OPTIONS.find((x) => x.id === maxEdge)?.hint}
            </span>
          </label>
        </div>

        <div className="mt-4 pt-4 border-t border-neutral-200/90 space-y-3">
          <p className="text-sm font-semibold text-black">File names</p>
          <p className="text-xs text-neutral-600 leading-relaxed">
            Choose an <strong className="text-black">auto template</strong> or add an{" "}
            <strong className="text-black">AI-suggested</strong> base; each row still gets a short suffix so
            originals and versions do not overwrite each other.
          </p>
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Auto rename template
            </span>
            <select
              value={namingPreset}
              onChange={(e) => {
                setNamingPreset(e.target.value as ExportNamingPresetId);
                setAiBaseStem(null);
              }}
              className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-neutral-300"
            >
              {EXPORT_NAMING_PRESET_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[11px] text-neutral-500 leading-snug">
              {EXPORT_NAMING_PRESET_OPTIONS.find((x) => x.id === namingPreset)?.hint}
            </span>
          </label>
          {namingPreset === "custom" && (
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                Custom base stem
              </span>
              <input
                type="text"
                value={customBase}
                onChange={(e) => {
                  setCustomBase(e.target.value);
                  setAiBaseStem(null);
                }}
                placeholder="e.g. oceanfront-suite"
                className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-neutral-300 font-data"
              />
            </label>
          )}
          {aiBaseStem && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-700">
              <span>
                AI base: <span className="font-data font-medium text-black">{aiBaseStem}</span>
              </span>
              <button
                type="button"
                onClick={() => setAiBaseStem(null)}
                className="text-black underline decoration-neutral-400 underline-offset-2 hover:decoration-black"
              >
                Clear AI name
              </button>
            </div>
          )}
          {canAi ? (
            <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
              <label className="block flex-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  AI provider
                </span>
                <select
                  value={aiProvider}
                  onChange={(e) => setAiProvider(e.target.value as "openai" | "gemini")}
                  className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-neutral-300"
                >
                  {aiNamingProviders.includes("openai") && <option value="openai">OpenAI</option>}
                  {aiNamingProviders.includes("gemini") && <option value="gemini">Gemini</option>}
                </select>
              </label>
              <button
                type="button"
                onClick={() => void runAiSuggest()}
                disabled={aiLoading}
                className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-black hover:bg-neutral-50 disabled:opacity-50"
              >
                {aiLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                AI suggest name
              </button>
            </div>
          ) : (
            <p className="text-[11px] text-neutral-500 leading-relaxed">
              AI rename needs the backend and a saved OpenAI or Gemini key in Settings. In local-only mode, use
              templates above; pipeline default is{" "}
              <span className="font-data text-black">{defaultStemHint("version", latestVersion)}</span> for the latest
              result.
            </p>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-neutral-200/90">
          <label className="block mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              What to download
            </span>
            <select
              value={quickTarget}
              onChange={(e) => setQuickTarget(e.target.value as QuickTarget)}
              className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-neutral-300 sm:max-w-md"
            >
              <option value="latest">
                Latest result — {VERSION_LABELS[latestVersion.version_type] || latestVersion.version_type}
                {latestVersion.width && latestVersion.height
                  ? ` (${latestVersion.width}×${latestVersion.height})`
                  : ""}
              </option>
              <option value="original">Original upload (unmodified)</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              if (quickTarget === "latest") {
                const stem = stemForRow("version", latestVersion);
                void handleDownload(latestVersion.id, stem, "quick-latest");
              } else {
                void handleDownload(undefined, stemForRow("original"), "quick-original");
              }
            }}
            disabled={
              downloadingKey === rowKey("quick-latest") || downloadingKey === rowKey("quick-original")
            }
            className="w-full sm:w-auto min-w-[200px] flex items-center justify-center gap-2 rounded-xl bg-black px-6 py-3.5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50 transition-colors"
          >
            {downloadingKey === rowKey("quick-latest") || downloadingKey === rowKey("quick-original") ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Preparing…
              </>
            ) : (
              <>
                <Download className="h-5 w-5" strokeWidth={2} />
                Download
              </>
            )}
          </button>
          <p className="text-[11px] text-neutral-500 mt-2 leading-relaxed">
            Uses the file format and max long edge you chose above. You can still use the list below for other
            versions.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={() => void handleDownload(undefined, stemForRow("original"), "original")}
          disabled={downloadingKey === rowKey("original")}
          className="w-full flex items-center justify-between p-3.5 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors text-left"
        >
          <div className="flex items-center gap-3 min-w-0">
            <FileImage className="w-5 h-5 text-gray-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-700">Original</p>
              <p className="text-xs text-gray-500 font-data truncate">{stemForRow("original")}</p>
              <p className="text-[11px] text-gray-400 mt-1">Uploaded file — no processing recipe.</p>
            </div>
          </div>
          {downloadingKey === rowKey("original") ? (
            <Loader2 className="w-4 h-4 text-gray-400 animate-spin shrink-0" />
          ) : (
            <Download className="w-4 h-4 text-gray-400 shrink-0" />
          )}
        </button>

        {versions.map((v) => {
          const stem = stemForRow("version", v);
          const id = `v-${v.id}`;
          return (
            <div
              key={v.id}
              className="w-full flex flex-col gap-3 p-3.5 bg-neutral-100 rounded-xl border border-neutral-200 sm:flex-row sm:items-stretch sm:gap-4"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <div className="flex items-start gap-3">
                  <FileImage className="w-5 h-5 text-black shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-black">
                      {VERSION_LABELS[v.version_type] || v.version_type}
                    </p>
                    <p className="text-xs text-neutral-500 font-data truncate">{stem}</p>
                    <p className="text-xs text-neutral-500">
                      {v.width && v.height ? `${v.width}×${v.height}` : ""}
                      {v.scale_factor ? ` · ${v.scale_factor}x upscaled` : ""}
                      {v.file_size_bytes
                        ? ` · source ~${(v.file_size_bytes / 1024 / 1024).toFixed(1)} MB`
                        : ""}
                      {v.processing_cost_usd ? ` · $${v.processing_cost_usd.toFixed(4)}` : ""}
                    </p>
                  </div>
                </div>
                <VersionRecipeInline
                  version={v}
                  onEditSettings={onEditVersionSettings ? () => onEditVersionSettings(v) : undefined}
                />
              </div>
              <div className="flex shrink-0 flex-row items-center justify-end gap-2 sm:flex-col sm:justify-center sm:border-l sm:border-neutral-200/80 sm:pl-4">
                <button
                  type="button"
                  onClick={() => void handleDownload(v.id, stem, id)}
                  disabled={downloadingKey === rowKey(id)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50 sm:min-w-[8.5rem]"
                >
                  {downloadingKey === rowKey(id) ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" strokeWidth={2} />
                  )}
                  Download
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

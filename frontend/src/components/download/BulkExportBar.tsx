import { Download, Loader2, Package } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import client from "../../api/client";
import { suggestFilename } from "../../api/images";
import { getLocalBlob } from "../../lib/localImageStore";
import {
  DOWNLOAD_FORMAT_OPTIONS,
  DOWNLOAD_SIZE_OPTIONS,
  EXPORT_NAMING_PRESET_OPTIONS,
  appendSizeToFilename,
  buildBulkSeriesStem,
  buildExportStem,
  exportDownloadBlob,
  type DownloadFormatId,
  type DownloadMaxEdgeId,
  type ExportNamingPresetId,
} from "../../lib/downloadExport";
import { isStorageOnlyMode } from "../../lib/storageOnlyMode";
import type { ImageInfo, ImageVersion } from "../../types";
import { toast } from "sonner";

type BulkStemMode = "rules" | "series";

interface Props {
  images: ImageInfo[];
  aiNamingProviders?: ("openai" | "gemini")[];
}

function latestVersion(versions: ImageVersion[] | undefined): ImageVersion | null {
  if (!versions?.length) return null;
  return versions[versions.length - 1];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function BulkExportBar({ images, aiNamingProviders = [] }: Props) {
  const storageOnly = isStorageOnlyMode();
  const targets = useMemo(
    () => images.filter((img) => latestVersion(img.versions)),
    [images]
  );

  const [exportFormat, setExportFormat] = useState<DownloadFormatId>("webp_near_lossless");
  const [maxEdge, setMaxEdge] = useState<DownloadMaxEdgeId>("full");
  const [stemMode, setStemMode] = useState<BulkStemMode>("rules");
  const [namingPreset, setNamingPreset] = useState<ExportNamingPresetId>("pipeline");
  const [customBase, setCustomBase] = useState("");
  const [seriesPrefix, setSeriesPrefix] = useState("listing-set");
  const [perImageAi, setPerImageAi] = useState<Record<string, string>>({});
  const [aiProvider, setAiProvider] = useState<"openai" | "gemini">(
    aiNamingProviders.includes("openai") ? "openai" : "gemini"
  );
  const [busy, setBusy] = useState(false);
  const [aiAllBusy, setAiAllBusy] = useState(false);

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

  if (targets.length < 2) return null;

  const downloadOne = async (imageId: string, versionId: string, stem: string) => {
    let blob: Blob;
    if (storageOnly) {
      const b = await getLocalBlob(imageId, versionId);
      if (!b) throw new Error("Not found");
      blob = b;
    } else {
      const res = await client.get(`/images/${imageId}/download?version=${versionId}`, {
        responseType: "blob",
      });
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
  };

  const stemForIndex = (img: ImageInfo, index1: number): string => {
    const v = latestVersion(img.versions)!;
    if (stemMode === "series") {
      return buildBulkSeriesStem(seriesPrefix, index1);
    }
    const aiBase = perImageAi[img.id] ?? null;
    return buildExportStem({
      preset: namingPreset,
      customBase,
      aiBase,
      originalFilename: img.original_filename,
      kind: "version",
      versionType: v.version_type,
      width: v.width,
      height: v.height,
    });
  };

  const handleDownloadAll = async () => {
    setBusy(true);
    try {
      for (let i = 0; i < targets.length; i++) {
        const img = targets[i];
        const v = latestVersion(img.versions)!;
        const stem = stemForIndex(img, i + 1);
        await downloadOne(img.id, v.id, stem);
        await sleep(400);
      }
      toast.success("Bulk download started", {
        description: `${targets.length} files · check your downloads folder.`,
        duration: 5000,
      });
    } catch {
      toast.error("Bulk download failed", {
        description: "Try another format or download assets individually.",
        duration: 6000,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleAiNameAll = async () => {
    if (!canAi) return;
    setAiAllBusy(true);
    const next: Record<string, string> = { ...perImageAi };
    try {
      for (const img of targets) {
        const v = latestVersion(img.versions)!;
        try {
          const basename = await suggestFilename(img.id, { version: v.id, provider: aiProvider });
          next[img.id] = basename;
          setPerImageAi({ ...next });
        } catch {
          toast.error("AI name failed", { description: img.original_filename, duration: 4000 });
        }
        await sleep(200);
      }
      toast.success("AI names applied", {
        description: "Each file uses its suggested base plus size/type suffix.",
        duration: 4000,
      });
    } finally {
      setAiAllBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-neutral-200/90 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Package className="w-5 h-5 text-black" />
        Bulk export ({targets.length} assets)
      </h3>
      <p className="text-xs text-neutral-600 mb-4 leading-relaxed">
        Downloads the <strong className="text-black">latest result</strong> for each workspace image using the
        format and max edge below. Spacing between saves helps the browser keep every file.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 mb-4">
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
        </label>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-neutral-50/80 p-4 mb-4 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Bulk naming</p>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="bulkStem"
              checked={stemMode === "rules"}
              onChange={() => setStemMode("rules")}
              className="rounded-full border-neutral-300"
            />
            <span className="text-black">Per asset (preset / AI)</span>
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="bulkStem"
              checked={stemMode === "series"}
              onChange={() => setStemMode("series")}
              className="rounded-full border-neutral-300"
            />
            <span className="text-black">Series numbers</span>
          </label>
        </div>

        {stemMode === "series" ? (
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Series prefix
            </span>
            <input
              type="text"
              value={seriesPrefix}
              onChange={(e) => setSeriesPrefix(e.target.value)}
              placeholder="listing-set"
              className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-neutral-300 font-data"
            />
            <span className="mt-1 block text-[11px] text-neutral-500">
              Files: prefix-001, prefix-002, …
            </span>
          </label>
        ) : (
          <>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                Auto template
              </span>
              <select
                value={namingPreset}
                onChange={(e) => setNamingPreset(e.target.value as ExportNamingPresetId)}
                className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-neutral-300"
              >
                {EXPORT_NAMING_PRESET_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            {namingPreset === "custom" && (
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Custom base
                </span>
                <input
                  type="text"
                  value={customBase}
                  onChange={(e) => setCustomBase(e.target.value)}
                  placeholder="property-west-wing"
                  className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-neutral-300 font-data"
                />
              </label>
            )}
            {canAi && (
              <div className="flex flex-col sm:flex-row gap-2 sm:items-end pt-1">
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
                  onClick={() => void handleAiNameAll()}
                  disabled={aiAllBusy}
                  className="shrink-0 rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-black hover:bg-neutral-50 disabled:opacity-50"
                >
                  {aiAllBusy ? "Naming…" : "AI name each"}
                </button>
              </div>
            )}
            {!canAi && (
              <p className="text-[11px] text-neutral-500">
                AI naming needs a saved OpenAI or Gemini key (Settings). In local-only mode, use templates or
                series numbers.
              </p>
            )}
          </>
        )}
      </div>

      <button
        type="button"
        onClick={() => void handleDownloadAll()}
        disabled={busy}
        className="w-full sm:w-auto min-w-[220px] flex items-center justify-center gap-2 rounded-xl bg-black px-6 py-3.5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50 transition-colors"
      >
        {busy ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Preparing…
          </>
        ) : (
          <>
            <Download className="h-5 w-5" strokeWidth={2} />
            Download all ({targets.length})
          </>
        )}
      </button>
    </div>
  );
}

import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { Download, FileImage, Loader2, SlidersHorizontal, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
  exportDownloadBlob
} from "../../lib/downloadExport";
import { getLatestImageVersion } from "../../lib/imageVersions";
import { isStorageOnlyMode } from "../../lib/storageOnlyMode";
import { toast } from "sonner";
import { toastProcessingError } from "../../lib/processingToast";
import VersionRecipeInline from "../pipeline/VersionRecipeInline";
const VERSION_LABELS = {
  enhanced: "AI Enhanced",
  upscaled: "Upscaled",
  final: "Final (Enhanced + Upscaled)"
};
function DownloadPanel({
  imageId,
  versions,
  originalFilename,
  aiNamingProviders = [],
  onEditVersionSettings
}) {
  const storageOnly = isStorageOnlyMode();
  const [downloadingKey, setDownloadingKey] = useState(null);
  const [exportFormat, setExportFormat] = useState("png_lossless");
  const [maxEdge, setMaxEdge] = useState("full");
  const [quickTarget, setQuickTarget] = useState("latest");
  const [namingPreset, setNamingPreset] = useState("pipeline");
  const [customBase, setCustomBase] = useState("");
  const [exportBaseStem, setExportBaseStem] = useState("");
  const [aiProvider, setAiProvider] = useState(
    aiNamingProviders.includes("gemini") ? "gemini" : "openai"
  );
  const [aiLoading, setAiLoading] = useState(false);
  const [lastSuggestMeta, setLastSuggestMeta] = useState(null);
  const canAi = !storageOnly && aiNamingProviders.length > 0;
  useEffect(() => {
    if (maxEdge !== "full") {
      setExportFormat((f) => f === "as_stored" ? "png_lossless" : f);
    }
  }, [maxEdge]);
  useEffect(() => {
    if (!aiNamingProviders.includes(aiProvider) && aiNamingProviders.length) {
      setAiProvider(aiNamingProviders.includes("gemini") ? "gemini" : "openai");
    }
  }, [aiNamingProviders, aiProvider]);
  const latestVersion = useMemo(() => {
    if (!versions?.length) return null;
    return getLatestImageVersion(versions) ?? null;
  }, [versions]);
  useEffect(() => {
    if (!canAi || !imageId || !latestVersion) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await suggestFilename(imageId, {
          version: latestVersion.id,
          provider: aiProvider
        });
        if (!cancelled) {
          setExportBaseStem(data.basename);
          setLastSuggestMeta(data);
        }
      } catch {
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canAi, imageId, latestVersion?.id, aiProvider]);
  if (!versions?.length || !latestVersion) return null;
  const rowKey = (suffix) => `${suffix}::${exportFormat}::${maxEdge}`;
  const stemForRow = (kind, v) => {
    const aiBase = exportBaseStem.trim() || null;
    return buildExportStem({
      preset: namingPreset,
      customBase,
      aiBase,
      originalFilename,
      kind,
      versionType: v?.version_type,
      width: v?.width,
      height: v?.height
    });
  };
  const defaultStemHint = (kind, v) => downloadFilenameStem(
    kind,
    v?.version_type,
    v?.width ?? void 0,
    v?.height ?? void 0
  );
  const handleDownload = async (versionId, stem, logicalId) => {
    const key = rowKey(logicalId);
    setDownloadingKey(key);
    try {
      let blob;
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
        description: `${filename} \xB7 about ${mb} MB`
      });
    } catch {
      toast.error("Failed to prepare download", {
        description: "Try another format, a smaller max size, or PNG if WebP isn\u2019t supported."
      });
    } finally {
      setDownloadingKey(null);
    }
  };
  const runAiSuggest = async () => {
    if (!canAi || !latestVersion) return;
    setAiLoading(true);
    try {
      const data = await suggestFilename(imageId, {
        version: latestVersion.id,
        provider: aiProvider
      });
      setExportBaseStem(data.basename);
      setLastSuggestMeta(data);
      const costBit = data.estimated_cost_usd != null ? `~$${data.estimated_cost_usd.toFixed(6)} USD est.` : "Cost estimate unavailable";
      const modelBit = data.model ? ` \xB7 ${data.model}` : "";
      toast.success("AI filename refreshed", {
        description: `${costBit}${modelBit}. Edit the base below if you like.`
      });
    } catch (err) {
      toastProcessingError(err, "AI suggest failed");
    } finally {
      setAiLoading(false);
    }
  };
  return /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-2xl border border-neutral-200/90 p-6", children: [
    /* @__PURE__ */ jsxs("h3", { className: "text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2", children: [
      /* @__PURE__ */ jsx(Download, { className: "w-5 h-5 text-black" }),
      "Download results"
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "mb-5 rounded-xl border border-neutral-200 bg-neutral-50/80 p-4", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-2 mb-3", children: [
        /* @__PURE__ */ jsx(SlidersHorizontal, { className: "w-4 h-4 text-neutral-600 mt-0.5 shrink-0", strokeWidth: 2 }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("p", { className: "text-sm font-semibold text-black", children: "Export quality & size" }),
          /* @__PURE__ */ jsxs("p", { className: "text-xs text-neutral-600 mt-1 leading-relaxed", children: [
            "Default ",
            /* @__PURE__ */ jsx("strong", { className: "text-black", children: "PNG lossless" }),
            " keeps maximum fidelity; WebP/JPEG are available for smaller files. Use ",
            /* @__PURE__ */ jsx("strong", { className: "text-black", children: "as stored" }),
            " only for a byte-identical copy at full resolution. Shorter long edge = lower MB."
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [
        /* @__PURE__ */ jsxs("label", { className: "block", children: [
          /* @__PURE__ */ jsx("span", { className: "text-[11px] font-semibold uppercase tracking-wider text-neutral-500", children: "File format" }),
          /* @__PURE__ */ jsx(
            "select",
            {
              value: exportFormat,
              onChange: (e) => setExportFormat(e.target.value),
              className: "mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-neutral-300",
              children: DOWNLOAD_FORMAT_OPTIONS.map((o) => /* @__PURE__ */ jsx("option", { value: o.id, disabled: o.id === "as_stored" && maxEdge !== "full", children: o.label }, o.id))
            }
          ),
          /* @__PURE__ */ jsx("span", { className: "mt-1 block text-[11px] text-neutral-500 leading-snug", children: DOWNLOAD_FORMAT_OPTIONS.find((x) => x.id === exportFormat)?.hint })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "block", children: [
          /* @__PURE__ */ jsx("span", { className: "text-[11px] font-semibold uppercase tracking-wider text-neutral-500", children: "Max long edge" }),
          /* @__PURE__ */ jsx(
            "select",
            {
              value: maxEdge,
              onChange: (e) => setMaxEdge(e.target.value),
              className: "mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-neutral-300",
              children: DOWNLOAD_SIZE_OPTIONS.map((o) => /* @__PURE__ */ jsx("option", { value: o.id, children: o.label }, o.id))
            }
          ),
          /* @__PURE__ */ jsx("span", { className: "mt-1 block text-[11px] text-neutral-500 leading-snug", children: DOWNLOAD_SIZE_OPTIONS.find((x) => x.id === maxEdge)?.hint })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "mt-4 pt-4 border-t border-neutral-200/90 space-y-3", children: [
        /* @__PURE__ */ jsx("p", { className: "text-sm font-semibold text-black", children: "File names" }),
        /* @__PURE__ */ jsxs("p", { className: "text-xs text-neutral-600 leading-relaxed", children: [
          "With API keys configured, an ",
          /* @__PURE__ */ jsx("strong", { className: "text-black", children: "AI-suggested base" }),
          " fills in automatically when the latest result updates; edit or clear anytime. Otherwise use an",
          " ",
          /* @__PURE__ */ jsx("strong", { className: "text-black", children: "auto template" }),
          ". Each row still gets a suffix so files stay unique."
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "block", children: [
          /* @__PURE__ */ jsx("span", { className: "text-[11px] font-semibold uppercase tracking-wider text-neutral-500", children: "Auto rename template" }),
          /* @__PURE__ */ jsx(
            "select",
            {
              value: namingPreset,
              onChange: (e) => setNamingPreset(e.target.value),
              className: "mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-neutral-300",
              children: EXPORT_NAMING_PRESET_OPTIONS.map((o) => /* @__PURE__ */ jsx("option", { value: o.id, children: o.label }, o.id))
            }
          ),
          /* @__PURE__ */ jsx("span", { className: "mt-1 block text-[11px] text-neutral-500 leading-snug", children: EXPORT_NAMING_PRESET_OPTIONS.find((x) => x.id === namingPreset)?.hint })
        ] }),
        namingPreset === "custom" && /* @__PURE__ */ jsxs("label", { className: "block", children: [
          /* @__PURE__ */ jsx("span", { className: "text-[11px] font-semibold uppercase tracking-wider text-neutral-500", children: "Custom base stem" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "text",
              value: customBase,
              onChange: (e) => setCustomBase(e.target.value),
              placeholder: "e.g. oceanfront-suite",
              className: "mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-neutral-300 font-data"
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "block", children: [
          /* @__PURE__ */ jsx("span", { className: "text-[11px] font-semibold uppercase tracking-wider text-neutral-500", children: "Rename / export base (optional)" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "text",
              value: exportBaseStem,
              onChange: (e) => setExportBaseStem(e.target.value),
              placeholder: canAi ? "Type a base or use AI suggest \u2014 row suffix is added automatically" : "Type a custom base \u2014 row suffix is added automatically",
              className: "mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-neutral-300 font-data"
            }
          ),
          /* @__PURE__ */ jsx("span", { className: "mt-1 block text-[11px] text-neutral-500 leading-snug", children: 'When filled, this prefix is used for every row below (each row still gets a unique suffix). Overrides the auto template including "Custom base" when both are set.' })
        ] }),
        exportBaseStem.trim() && /* @__PURE__ */ jsx("div", { className: "flex flex-wrap items-center gap-2", children: /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: () => setExportBaseStem(""),
            className: "text-xs font-semibold text-black underline decoration-neutral-400 underline-offset-2 hover:decoration-black",
            children: "Clear export base"
          }
        ) }),
        canAi ? /* @__PURE__ */ jsxs("div", { className: "flex flex-col sm:flex-row gap-2 sm:items-end", children: [
          /* @__PURE__ */ jsxs("label", { className: "block flex-1", children: [
            /* @__PURE__ */ jsx("span", { className: "text-[11px] font-semibold uppercase tracking-wider text-neutral-500", children: "AI provider" }),
            /* @__PURE__ */ jsxs(
              "select",
              {
                value: aiProvider,
                onChange: (e) => setAiProvider(e.target.value),
                className: "mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-neutral-300",
                children: [
                  aiNamingProviders.includes("openai") && /* @__PURE__ */ jsx("option", { value: "openai", children: "OpenAI" }),
                  aiNamingProviders.includes("gemini") && /* @__PURE__ */ jsx("option", { value: "gemini", children: "Gemini" })
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              onClick: () => void runAiSuggest(),
              disabled: aiLoading || !latestVersion,
              className: "shrink-0 inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-black hover:bg-neutral-50 disabled:opacity-50",
              children: [
                aiLoading ? /* @__PURE__ */ jsx(Loader2, { className: "h-4 w-4 animate-spin" }) : /* @__PURE__ */ jsx(Sparkles, { className: "h-4 w-4" }),
                "Refresh AI name"
              ]
            }
          )
        ] }) : null,
        canAi && lastSuggestMeta?.estimated_cost_usd != null ? /* @__PURE__ */ jsxs("div", { className: "rounded-lg border border-neutral-200/80 bg-neutral-50/90 px-3 py-2 space-y-1", children: [
          /* @__PURE__ */ jsx("p", { className: "text-[11px] font-semibold text-black", children: "Estimated cost (this rename call)" }),
          /* @__PURE__ */ jsxs("p", { className: "text-xs font-data text-neutral-800", children: [
            "~$",
            lastSuggestMeta.estimated_cost_usd.toFixed(6),
            " USD",
            lastSuggestMeta.model ? /* @__PURE__ */ jsxs("span", { className: "text-neutral-600", children: [
              " \xB7 ",
              lastSuggestMeta.model
            ] }) : null,
            lastSuggestMeta.prompt_tokens != null && lastSuggestMeta.output_tokens != null ? /* @__PURE__ */ jsxs("span", { className: "block text-[10px] font-normal text-neutral-500 mt-0.5", children: [
              lastSuggestMeta.prompt_tokens,
              " in + ",
              lastSuggestMeta.output_tokens,
              " out tokens (when reported by the API)"
            ] }) : null
          ] }),
          lastSuggestMeta.cost_note ? /* @__PURE__ */ jsx("p", { className: "text-[10px] text-neutral-600 leading-snug", title: lastSuggestMeta.cost_note, children: lastSuggestMeta.cost_note.length > 220 ? `${lastSuggestMeta.cost_note.slice(0, 217)}\u2026` : lastSuggestMeta.cost_note }) : null
        ] }) : null,
        !canAi ? /* @__PURE__ */ jsxs("p", { className: "text-[11px] text-neutral-500 leading-relaxed", children: [
          "AI suggest needs the backend reachable and a saved OpenAI or Gemini key in Settings. You can still type a base above. In local-only mode, pipeline default is",
          " ",
          /* @__PURE__ */ jsx("span", { className: "font-data text-black", children: defaultStemHint("version", latestVersion) }),
          " for the latest result."
        ] }) : null,
        /* @__PURE__ */ jsxs("div", { className: "rounded-lg border border-dashed border-neutral-200 bg-white/80 px-3 py-2.5", children: [
          /* @__PURE__ */ jsx("p", { className: "text-[10px] font-semibold uppercase tracking-wider text-neutral-500", children: "Live preview" }),
          /* @__PURE__ */ jsxs("dl", { className: "mt-2 space-y-1.5 text-xs", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-0.5 sm:flex-row sm:gap-2", children: [
              /* @__PURE__ */ jsx("dt", { className: "shrink-0 text-neutral-500 w-28", children: "Latest result" }),
              /* @__PURE__ */ jsx("dd", { className: "font-data text-black break-all min-w-0", children: stemForRow("version", latestVersion) })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-0.5 sm:flex-row sm:gap-2", children: [
              /* @__PURE__ */ jsx("dt", { className: "shrink-0 text-neutral-500 w-28", children: "Original row" }),
              /* @__PURE__ */ jsx("dd", { className: "font-data text-black break-all min-w-0", children: stemForRow("original") })
            ] })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "mt-4 pt-4 border-t border-neutral-200/90", children: [
        /* @__PURE__ */ jsxs("label", { className: "block mb-3", children: [
          /* @__PURE__ */ jsx("span", { className: "text-[11px] font-semibold uppercase tracking-wider text-neutral-500", children: "What to download" }),
          /* @__PURE__ */ jsxs(
            "select",
            {
              value: quickTarget,
              onChange: (e) => setQuickTarget(e.target.value),
              className: "mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-neutral-300 sm:max-w-md",
              children: [
                /* @__PURE__ */ jsxs("option", { value: "latest", children: [
                  "Latest result \u2014 ",
                  VERSION_LABELS[latestVersion.version_type] || latestVersion.version_type,
                  latestVersion.width && latestVersion.height ? ` (${latestVersion.width}\xD7${latestVersion.height})` : ""
                ] }),
                /* @__PURE__ */ jsx("option", { value: "original", children: "Original upload (unmodified)" })
              ]
            }
          )
        ] }),
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: () => {
              if (quickTarget === "latest") {
                const stem = stemForRow("version", latestVersion);
                void handleDownload(latestVersion.id, stem, "quick-latest");
              } else {
                void handleDownload(void 0, stemForRow("original"), "quick-original");
              }
            },
            disabled: downloadingKey === rowKey("quick-latest") || downloadingKey === rowKey("quick-original"),
            className: "w-full sm:w-auto min-w-[200px] flex items-center justify-center gap-2 rounded-xl bg-black px-6 py-3.5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50 transition-colors",
            children: downloadingKey === rowKey("quick-latest") || downloadingKey === rowKey("quick-original") ? /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsx(Loader2, { className: "h-5 w-5 animate-spin" }),
              "Preparing\u2026"
            ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsx(Download, { className: "h-5 w-5", strokeWidth: 2 }),
              "Download"
            ] })
          }
        ),
        /* @__PURE__ */ jsx("p", { className: "text-[11px] text-neutral-500 mt-2 leading-relaxed", children: "Uses the file format and max long edge you chose above. You can still use the list below for other versions." })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
      /* @__PURE__ */ jsxs(
        "button",
        {
          type: "button",
          onClick: () => void handleDownload(void 0, stemForRow("original"), "original"),
          disabled: downloadingKey === rowKey("original"),
          className: "w-full flex items-center justify-between p-3.5 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors text-left",
          children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 min-w-0", children: [
              /* @__PURE__ */ jsx(FileImage, { className: "w-5 h-5 text-gray-400 shrink-0" }),
              /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
                /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-gray-700", children: "Original" }),
                /* @__PURE__ */ jsx("p", { className: "text-xs text-gray-500 font-data truncate", children: stemForRow("original") }),
                /* @__PURE__ */ jsx("p", { className: "text-[11px] text-gray-400 mt-1", children: "Uploaded file \u2014 no processing recipe." })
              ] })
            ] }),
            downloadingKey === rowKey("original") ? /* @__PURE__ */ jsx(Loader2, { className: "w-4 h-4 text-gray-400 animate-spin shrink-0" }) : /* @__PURE__ */ jsx(Download, { className: "w-4 h-4 text-gray-400 shrink-0" })
          ]
        }
      ),
      versions.map((v) => {
        const stem = stemForRow("version", v);
        const id = `v-${v.id}`;
        return /* @__PURE__ */ jsxs(
          "div",
          {
            className: "w-full flex flex-col gap-3 p-3.5 bg-neutral-100 rounded-xl border border-neutral-200 sm:flex-row sm:items-stretch sm:gap-4",
            children: [
              /* @__PURE__ */ jsxs("div", { className: "flex min-w-0 flex-1 flex-col gap-3", children: [
                /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3", children: [
                  /* @__PURE__ */ jsx(FileImage, { className: "w-5 h-5 text-black shrink-0 mt-0.5" }),
                  /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
                    /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-black", children: VERSION_LABELS[v.version_type] || v.version_type }),
                    /* @__PURE__ */ jsx("p", { className: "text-xs text-neutral-500 font-data truncate", children: stem }),
                    /* @__PURE__ */ jsxs("p", { className: "text-xs text-neutral-500", children: [
                      v.width && v.height ? `${v.width}\xD7${v.height}` : "",
                      v.scale_factor ? ` \xB7 ${v.scale_factor}x upscaled` : "",
                      v.file_size_bytes ? ` \xB7 source ~${(v.file_size_bytes / 1024 / 1024).toFixed(1)} MB` : "",
                      v.processing_cost_usd ? ` \xB7 $${v.processing_cost_usd.toFixed(4)}` : ""
                    ] })
                  ] })
                ] }),
                /* @__PURE__ */ jsx(
                  VersionRecipeInline,
                  {
                    version: v,
                    onEditSettings: onEditVersionSettings ? () => onEditVersionSettings(v) : void 0
                  }
                )
              ] }),
              /* @__PURE__ */ jsx("div", { className: "flex shrink-0 flex-row items-center justify-end gap-2 sm:flex-col sm:justify-center sm:border-l sm:border-neutral-200/80 sm:pl-4", children: /* @__PURE__ */ jsxs(
                "button",
                {
                  type: "button",
                  onClick: () => void handleDownload(v.id, stem, id),
                  disabled: downloadingKey === rowKey(id),
                  className: "inline-flex items-center justify-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50 sm:min-w-[8.5rem]",
                  children: [
                    downloadingKey === rowKey(id) ? /* @__PURE__ */ jsx(Loader2, { className: "w-4 h-4 animate-spin" }) : /* @__PURE__ */ jsx(Download, { className: "w-4 h-4", strokeWidth: 2 }),
                    "Download"
                  ]
                }
              ) })
            ]
          },
          v.id
        );
      })
    ] })
  ] });
}
export {
  DownloadPanel as default
};

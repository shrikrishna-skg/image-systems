import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { Loader2, Package, FileArchive } from "lucide-react";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import JSZip from "jszip";
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
  defaultBulkZipArchiveStem,
  exportDownloadBlob,
  makeUniqueZipEntryName,
  sanitizeZipArchiveBasename
} from "../../lib/downloadExport";
import { getLatestImageVersion } from "../../lib/imageVersions";
import { isStorageOnlyMode } from "../../lib/storageOnlyMode";
import { toast } from "sonner";
function latestVersion(versions) {
  return getLatestImageVersion(versions) ?? null;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function BulkExportBar({ images, aiNamingProviders = [] }) {
  const storageOnly = isStorageOnlyMode();
  const targets = useMemo(
    () => images.filter((img) => latestVersion(img.versions)),
    [images]
  );
  const [exportFormat, setExportFormat] = useState("png_lossless");
  const [maxEdge, setMaxEdge] = useState("full");
  const [stemMode, setStemMode] = useState("rules");
  const [namingPreset, setNamingPreset] = useState("pipeline");
  const [customBase, setCustomBase] = useState("");
  const [seriesPrefix, setSeriesPrefix] = useState("listing-set");
  const [perImageAi, setPerImageAi] = useState({});
  const [aiProvider, setAiProvider] = useState(
    aiNamingProviders.includes("gemini") ? "gemini" : "openai"
  );
  const [busy, setBusy] = useState(false);
  const [aiAllBusy, setAiAllBusy] = useState(false);
  const [zipArchiveStem, setZipArchiveStem] = useState("");
  const [autoAiNamesBeforeZip, setAutoAiNamesBeforeZip] = useState(true);
  const [aiZipNameBusy, setAiZipNameBusy] = useState(false);
  const autoAiFetchedVersionRef = useRef({});
  const canAi = !storageOnly && aiNamingProviders.length > 0;
  const bulkAiSyncKey = useMemo(
    () => targets.map((t) => {
      const v = latestVersion(t.versions);
      return `${t.id}:${v?.id ?? ""}`;
    }).join("|"),
    [targets]
  );
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
  useEffect(() => {
    autoAiFetchedVersionRef.current = {};
  }, [aiProvider]);
  useEffect(() => {
    if (!canAi || stemMode !== "rules" || targets.length === 0) return;
    let cancelled = false;
    void (async () => {
      for (const img of targets) {
        if (cancelled) return;
        const v = latestVersion(img.versions);
        if (!v) continue;
        if (autoAiFetchedVersionRef.current[img.id] === v.id) continue;
        try {
          const data = await suggestFilename(img.id, { version: v.id, provider: aiProvider });
          if (cancelled) return;
          autoAiFetchedVersionRef.current = { ...autoAiFetchedVersionRef.current, [img.id]: v.id };
          setPerImageAi((prev) => {
            if (prev[img.id]) return prev;
            return { ...prev, [img.id]: data.basename };
          });
        } catch {
          if (!cancelled) {
            autoAiFetchedVersionRef.current = { ...autoAiFetchedVersionRef.current, [img.id]: v.id };
          }
        }
        await sleep(120);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canAi, stemMode, aiProvider, bulkAiSyncKey, targets]);
  const stemForIndexWithMap = useCallback(
    (img, index1, aiMap) => {
      const v = latestVersion(img.versions);
      if (stemMode === "series") {
        return buildBulkSeriesStem(seriesPrefix, index1);
      }
      const raw = aiMap[img.id];
      const aiBase = raw?.trim() ? raw.trim() : null;
      return buildExportStem({
        preset: namingPreset,
        customBase,
        aiBase,
        originalFilename: img.original_filename,
        kind: "version",
        versionType: v.version_type,
        width: v.width,
        height: v.height
      });
    },
    [stemMode, seriesPrefix, namingPreset, customBase]
  );
  if (targets.length < 2) return null;
  const triggerBrowserDownload = (blob, filename) => {
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  };
  const prepareExportFile = async (imageId, versionId, stem) => {
    let blob;
    if (storageOnly) {
      const b = await getLocalBlob(imageId, versionId);
      if (!b) throw new Error("Not found");
      blob = b;
    } else {
      const res = await client.get(`/images/${imageId}/download?version=${versionId}`, {
        responseType: "blob"
      });
      blob = res.data;
    }
    const { blob: out, extension } = await exportDownloadBlob(blob, exportFormat, maxEdge);
    const filename = appendSizeToFilename(stem, maxEdge, extension);
    return { blob: out, filename };
  };
  const stemForIndex = (img, index1) => stemForIndexWithMap(img, index1, perImageAi);
  const handleDownloadAll = async () => {
    setBusy(true);
    try {
      let aiMap = { ...perImageAi };
      let renameCostSum = 0;
      if (autoAiNamesBeforeZip && canAi) {
        for (const img of targets) {
          const v = latestVersion(img.versions);
          try {
            const data = await suggestFilename(img.id, { version: v.id, provider: aiProvider });
            aiMap = { ...aiMap, [img.id]: data.basename };
            if (data.estimated_cost_usd != null) renameCostSum += data.estimated_cost_usd;
          } catch {
            toast.error("AI name skipped", { description: img.original_filename });
          }
          await sleep(120);
        }
        setPerImageAi(aiMap);
      }
      const entries = [];
      for (let i = 0; i < targets.length; i++) {
        const img = targets[i];
        const v = latestVersion(img.versions);
        const stem = stemForIndexWithMap(img, i + 1, aiMap);
        const prep = await prepareExportFile(img.id, v.id, stem);
        entries.push(prep);
      }
      const zip = new JSZip();
      const used = /* @__PURE__ */ new Set();
      for (const e of entries) {
        const name = makeUniqueZipEntryName(used, e.filename);
        zip.file(name, e.blob);
      }
      const zipBlob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
      const archiveBase = sanitizeZipArchiveBasename(zipArchiveStem.trim() || defaultBulkZipArchiveStem());
      const zipFileName = `${archiveBase}.zip`;
      triggerBrowserDownload(zipBlob, zipFileName);
      toast.success("ZIP download started", {
        description: `${entries.length} images in ${zipFileName}${autoAiNamesBeforeZip && renameCostSum > 0 ? ` \xB7 ~$${renameCostSum.toFixed(5)} USD est. total for AI renames (Google list rates; not a bill)` : ""}`
      });
    } catch {
      toast.error("Bulk download failed", {
        description: "Try another format, fewer images, or download individually from each row."
      });
    } finally {
      setBusy(false);
    }
  };
  const handleAiNameAll = async () => {
    if (!canAi) return;
    setAiAllBusy(true);
    const next = { ...perImageAi };
    try {
      for (const img of targets) {
        const v = latestVersion(img.versions);
        try {
          const data = await suggestFilename(img.id, { version: v.id, provider: aiProvider });
          next[img.id] = data.basename;
          autoAiFetchedVersionRef.current = { ...autoAiFetchedVersionRef.current, [img.id]: v.id };
          setPerImageAi({ ...next });
        } catch {
          toast.error("AI name failed", { description: img.original_filename });
        }
        await sleep(200);
      }
      toast.success("AI names applied", {
        description: "Review or edit each base below, then Download ZIP."
      });
    } finally {
      setAiAllBusy(false);
    }
  };
  const handleAiZipArchiveName = async () => {
    if (!canAi || targets.length === 0) return;
    setAiZipNameBusy(true);
    try {
      const img = targets[0];
      const v = latestVersion(img.versions);
      const data = await suggestFilename(img.id, { version: v.id, provider: aiProvider });
      setZipArchiveStem(`${data.basename}-bulk`);
      toast.success("ZIP archive name suggested", {
        description: "Uses the first asset in the list; edit the field before downloading."
      });
    } catch {
      toast.error("Could not suggest ZIP name", {
        description: "Set the archive name manually or check your API key."
      });
    } finally {
      setAiZipNameBusy(false);
    }
  };
  return /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-2xl border border-neutral-200/90 p-6", children: [
    /* @__PURE__ */ jsxs("h3", { className: "text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2", children: [
      /* @__PURE__ */ jsx(Package, { className: "w-5 h-5 text-black" }),
      "Bulk export (",
      targets.length,
      " assets)"
    ] }),
    /* @__PURE__ */ jsxs("p", { className: "text-xs text-neutral-600 mb-4 leading-relaxed", children: [
      "Downloads the ",
      /* @__PURE__ */ jsx("strong", { className: "text-black", children: "latest result" }),
      " for each workspace image. Bulk export always produces ",
      /* @__PURE__ */ jsx("strong", { className: "text-black", children: "one .zip" }),
      " for two or more assets (never multiple separate file downloads). AI rename defaults to",
      " ",
      /* @__PURE__ */ jsx("strong", { className: "text-black", children: "Gemini 2.5 Flash-Lite" }),
      " (cheap multimodal) and uses image + metadata; the app shows a ",
      /* @__PURE__ */ jsx("strong", { className: "text-black", children: "per-call cost estimate" }),
      " (list pricing, not an invoice)."
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-4 mb-4 space-y-3", children: [
      /* @__PURE__ */ jsxs("p", { className: "text-[11px] font-semibold uppercase tracking-wider text-emerald-900 flex items-center gap-2", children: [
        /* @__PURE__ */ jsx(FileArchive, { className: "h-4 w-4", "aria-hidden": true }),
        "ZIP archive (",
        targets.length,
        " files)"
      ] }),
      /* @__PURE__ */ jsxs("label", { className: "block", children: [
        /* @__PURE__ */ jsx("span", { className: "text-[11px] font-semibold uppercase tracking-wider text-neutral-600", children: "Archive name (no .zip)" }),
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "text",
            value: zipArchiveStem,
            onChange: (e) => setZipArchiveStem(e.target.value),
            placeholder: defaultBulkZipArchiveStem(),
            className: "mt-1.5 w-full rounded-lg border border-emerald-200/90 bg-white px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-emerald-300 font-data"
          }
        ),
        /* @__PURE__ */ jsxs("span", { className: "mt-1 block text-[11px] text-neutral-600", children: [
          "Saved as ",
          /* @__PURE__ */ jsxs("span", { className: "font-mono", children: [
            sanitizeZipArchiveBasename(zipArchiveStem.trim() || defaultBulkZipArchiveStem()),
            ".zip"
          ] })
        ] })
      ] }),
      canAi && /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          onClick: () => void handleAiZipArchiveName(),
          disabled: aiZipNameBusy,
          className: "rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-50 disabled:opacity-50",
          children: aiZipNameBusy ? "Suggesting\u2026" : "Suggest ZIP name (AI, from first asset)"
        }
      ),
      canAi && /* @__PURE__ */ jsxs("label", { className: "flex cursor-pointer items-start gap-2 text-sm text-neutral-800", children: [
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "checkbox",
            checked: autoAiNamesBeforeZip,
            onChange: (e) => setAutoAiNamesBeforeZip(e.target.checked),
            className: "mt-1 h-4 w-4 rounded border-neutral-300"
          }
        ),
        /* @__PURE__ */ jsxs("span", { children: [
          /* @__PURE__ */ jsx("strong", { className: "text-black", children: "Auto AI-name every file" }),
          " before building the ZIP (on by default; uses the provider above \u2014 one API call per image). Turn off to use templates only and save time."
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "grid gap-3 sm:grid-cols-2 mb-4", children: [
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
        )
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
        )
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-neutral-200 bg-neutral-50/80 p-4 mb-4 space-y-3", children: [
      /* @__PURE__ */ jsx("p", { className: "text-[11px] font-semibold uppercase tracking-wider text-neutral-500", children: "Bulk naming" }),
      /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap gap-4 text-sm", children: [
        /* @__PURE__ */ jsxs("label", { className: "inline-flex items-center gap-2 cursor-pointer", children: [
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "radio",
              name: "bulkStem",
              checked: stemMode === "rules",
              onChange: () => setStemMode("rules"),
              className: "rounded-full border-neutral-300"
            }
          ),
          /* @__PURE__ */ jsx("span", { className: "text-black", children: "Per asset (preset / AI)" })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "inline-flex items-center gap-2 cursor-pointer", children: [
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "radio",
              name: "bulkStem",
              checked: stemMode === "series",
              onChange: () => setStemMode("series"),
              className: "rounded-full border-neutral-300"
            }
          ),
          /* @__PURE__ */ jsx("span", { className: "text-black", children: "Series numbers" })
        ] })
      ] }),
      stemMode === "series" ? /* @__PURE__ */ jsxs("label", { className: "block", children: [
        /* @__PURE__ */ jsx("span", { className: "text-[11px] font-semibold uppercase tracking-wider text-neutral-500", children: "Series prefix" }),
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "text",
            value: seriesPrefix,
            onChange: (e) => setSeriesPrefix(e.target.value),
            placeholder: "listing-set",
            className: "mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-neutral-300 font-data"
          }
        ),
        /* @__PURE__ */ jsx("span", { className: "mt-1 block text-[11px] text-neutral-500", children: "Files: prefix-001, prefix-002, \u2026" })
      ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsxs("label", { className: "block", children: [
          /* @__PURE__ */ jsx("span", { className: "text-[11px] font-semibold uppercase tracking-wider text-neutral-500", children: "Auto template" }),
          /* @__PURE__ */ jsx(
            "select",
            {
              value: namingPreset,
              onChange: (e) => setNamingPreset(e.target.value),
              className: "mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-neutral-300",
              children: EXPORT_NAMING_PRESET_OPTIONS.map((o) => /* @__PURE__ */ jsx("option", { value: o.id, children: o.label }, o.id))
            }
          )
        ] }),
        namingPreset === "custom" && /* @__PURE__ */ jsxs("label", { className: "block", children: [
          /* @__PURE__ */ jsx("span", { className: "text-[11px] font-semibold uppercase tracking-wider text-neutral-500", children: "Custom base" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "text",
              value: customBase,
              onChange: (e) => setCustomBase(e.target.value),
              placeholder: "property-west-wing",
              className: "mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-neutral-300 font-data"
            }
          )
        ] }),
        canAi && /* @__PURE__ */ jsxs("div", { className: "flex flex-col sm:flex-row gap-2 sm:items-end pt-1", children: [
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
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: () => void handleAiNameAll(),
              disabled: aiAllBusy,
              className: "shrink-0 rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-black hover:bg-neutral-50 disabled:opacity-50",
              children: aiAllBusy ? "Naming\u2026" : "AI suggest each"
            }
          )
        ] }),
        !canAi && /* @__PURE__ */ jsx("p", { className: "text-[11px] text-neutral-500", children: "AI naming needs a saved OpenAI or Gemini key (Settings). In local-only mode, use templates or series numbers." })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "mt-3 rounded-lg border border-neutral-200 bg-white p-3 space-y-2", children: [
        /* @__PURE__ */ jsx("p", { className: "text-xs font-semibold text-black", children: "Per file \u2014 rename & preview" }),
        /* @__PURE__ */ jsxs("p", { className: "text-[11px] text-neutral-500 leading-relaxed", children: [
          "Each row shows the download filename stem (before format / max-size suffix). With",
          " ",
          /* @__PURE__ */ jsx("strong", { className: "text-black", children: "Per asset" }),
          ", AI bases fill in automatically when keys are configured; edit or use ",
          /* @__PURE__ */ jsx("strong", { className: "text-black", children: "AI suggest each" }),
          " to refresh. With",
          " ",
          /* @__PURE__ */ jsx("strong", { className: "text-black", children: "Series numbers" }),
          ", stems are prefix-001, \u2026"
        ] }),
        /* @__PURE__ */ jsx("ul", { className: "space-y-3 max-h-56 overflow-y-auto pr-1", children: targets.map((img, i) => {
          const idx = i + 1;
          const stem = stemForIndex(img, idx);
          return /* @__PURE__ */ jsxs(
            "li",
            {
              className: "rounded-lg border border-neutral-100 bg-neutral-50/80 p-2.5 space-y-1.5",
              children: [
                /* @__PURE__ */ jsx("p", { className: "text-[11px] text-neutral-600 truncate", title: img.original_filename, children: img.original_filename }),
                stemMode === "rules" ? /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "text",
                    value: perImageAi[img.id] ?? "",
                    onChange: (e) => setPerImageAi((prev) => ({
                      ...prev,
                      [img.id]: e.target.value
                    })),
                    placeholder: "Optional base (or use AI suggest each)",
                    className: "w-full rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-xs text-black font-data outline-none focus:ring-2 focus:ring-neutral-300"
                  }
                ) : null,
                /* @__PURE__ */ jsx("p", { className: "text-[10px] font-semibold uppercase tracking-wider text-neutral-500", children: "Download stem" }),
                /* @__PURE__ */ jsx("p", { className: "text-xs font-data text-black break-all", children: stem })
              ]
            },
            img.id
          );
        }) }),
        stemMode === "rules" && Object.keys(perImageAi).length > 0 && /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: () => {
              autoAiFetchedVersionRef.current = {};
              setPerImageAi({});
            },
            className: "text-xs font-semibold text-black underline decoration-neutral-400 underline-offset-2 hover:decoration-black",
            children: "Clear all per-file bases"
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        onClick: () => void handleDownloadAll(),
        disabled: busy,
        className: "w-full sm:w-auto min-w-[220px] flex items-center justify-center gap-2 rounded-xl bg-black px-6 py-3.5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50 transition-colors",
        children: busy ? /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx(Loader2, { className: "h-5 w-5 animate-spin" }),
          autoAiNamesBeforeZip ? "Naming & zipping\u2026" : "Zipping\u2026"
        ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx(FileArchive, { className: "h-5 w-5", strokeWidth: 2 }),
          "Download ZIP (",
          targets.length,
          " images)"
        ] })
      }
    )
  ] });
}
export {
  BulkExportBar as default
};

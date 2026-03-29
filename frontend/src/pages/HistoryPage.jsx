import { jsx, jsxs } from "react/jsx-runtime";
import { useState, useEffect, useMemo } from "react";
import { Loader2, Download, Trash2, Image as ImageIcon, Globe, Wand2, Upload, Search } from "lucide-react";
import { listImages, deleteImage, getDownloadUrl } from "../api/images";
import { listLocalImages, deleteLocalImage, getLocalBlob } from "../lib/localImageStore";
import { isStorageOnlyMode } from "../lib/storageOnlyMode";
import { useImageStore } from "../stores/imageStore";
import { Link, useNavigate } from "react-router-dom";
import { useAuthenticatedImage } from "../hooks/useAuthenticatedImage";
import FullscreenImageRegion from "../components/media/FullscreenImageRegion";
import OptimizedImage from "../components/media/OptimizedImage";
import { toast } from "sonner";
import {
  applyHistoryLibraryFilters,
  HISTORY_LIBRARY_LIST_LIMIT,
  HISTORY_LIBRARY_LIST_OFFSET,
  HISTORY_SEEN_ARCHIVE_KEY,
  historyLocalDownloadFilename,
  latestImageVersion,
  sumVersionProcessingCostUsd
} from "../lib/historyDeliverables";
const storageOnly = isStorageOnlyMode();
function HistoryThumb({ imageId, versionId }) {
  const { blobUrl, loading } = useAuthenticatedImage(imageId, versionId);
  if (loading && !blobUrl) {
    return /* @__PURE__ */ jsx(Loader2, { className: "w-8 h-8 animate-spin text-slate-400" });
  }
  if (!blobUrl) {
    return /* @__PURE__ */ jsx(ImageIcon, { className: "w-12 h-12 text-slate-300" });
  }
  return /* @__PURE__ */ jsx(OptimizedImage, { lazy: true, src: blobUrl, alt: "", className: "h-full w-full object-cover" });
}
function HistoryPage() {
  const [images, setImages] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [datePreset, setDatePreset] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");
  const [loading, setLoading] = useState(true);
  const replaceSessionWith = useImageStore((s) => s.replaceSessionWith);
  const navigate = useNavigate();
  useEffect(() => {
    void loadImages();
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(HISTORY_SEEN_ARCHIVE_KEY, "1");
    } catch {
    }
  }, []);
  const loadImages = async () => {
    try {
      const data = storageOnly ? await listLocalImages() : await listImages(HISTORY_LIBRARY_LIST_OFFSET, HISTORY_LIBRARY_LIST_LIMIT);
      setImages(data);
    } catch {
      toast.error("Failed to load images");
    } finally {
      setLoading(false);
    }
  };
  const handleDelete = async (id) => {
    try {
      if (storageOnly) {
        await deleteLocalImage(id);
      } else {
        await deleteImage(id);
      }
      setImages((prev) => prev.filter((img) => img.id !== id));
      toast.success("Image deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };
  const handleReuse = (img) => {
    replaceSessionWith([img]);
    navigate("/");
  };
  const filteredImages = useMemo(
    () => applyHistoryLibraryFilters(images, searchQuery, datePreset, sortOrder),
    [images, searchQuery, datePreset, sortOrder]
  );
  const hasNarrowingFilter = searchQuery.trim().length > 0 || datePreset !== "all";
  const downloadLocal = async (imageId, versionId) => {
    try {
      const blob = await getLocalBlob(imageId, versionId);
      if (!blob) throw new Error("missing");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = historyLocalDownloadFilename(versionId);
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Download failed");
    }
  };
  if (loading) {
    return /* @__PURE__ */ jsx("div", { className: "flex items-center justify-center h-full", children: /* @__PURE__ */ jsx(Loader2, { className: "w-8 h-8 animate-spin text-black" }) });
  }
  return /* @__PURE__ */ jsxs("div", { className: "mx-auto min-w-0 w-full max-w-[1600px] page-safe py-4 pb-16 sm:py-6 md:py-8", children: [
    /* @__PURE__ */ jsxs("header", { className: "mb-6 sm:mb-8", children: [
      /* @__PURE__ */ jsx("p", { className: "text-[11px] font-semibold uppercase tracking-[0.2em] text-black mb-2", children: "Library" }),
      /* @__PURE__ */ jsx("h1", { className: "text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 text-balance", children: "Deliverables" }),
      /* @__PURE__ */ jsx("p", { className: "mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 sm:mt-3 sm:text-base", children: storageOnly ? "Photos you\u2019ve processed in this browser live here \u2014 reopen any shot to keep editing or download." : "Every enhanced photo and export you save shows up here. Reopen a job to tweak settings or grab files for MLS, your site, or clients." })
    ] }),
    /* @__PURE__ */ jsxs(
      "div",
      {
        className: "mb-6 flex w-full min-w-0 flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:flex-wrap sm:items-center",
        role: "search",
        children: [
          /* @__PURE__ */ jsxs("div", { className: "relative min-h-[44px] min-w-0 w-full flex-1 sm:min-w-[12rem]", children: [
            /* @__PURE__ */ jsx(
              Search,
              {
                className: "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400",
                strokeWidth: 2,
                "aria-hidden": true
              }
            ),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "search",
                value: searchQuery,
                onChange: (e) => setSearchQuery(e.target.value),
                placeholder: "Search by filename",
                autoComplete: "off",
                className: "min-h-[44px] w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200",
                "aria-label": "Search deliverables by filename"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs(
            "select",
            {
              value: datePreset,
              onChange: (e) => setDatePreset(e.target.value),
              className: "min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 sm:w-auto sm:min-w-[10.5rem]",
              "aria-label": "Filter by upload date",
              children: [
                /* @__PURE__ */ jsx("option", { value: "all", children: "All dates" }),
                /* @__PURE__ */ jsx("option", { value: "today", children: "Today" }),
                /* @__PURE__ */ jsx("option", { value: "last_7_days", children: "Last 7 days" }),
                /* @__PURE__ */ jsx("option", { value: "last_30_days", children: "Last 30 days" })
              ]
            }
          ),
          /* @__PURE__ */ jsxs(
            "select",
            {
              value: sortOrder,
              onChange: (e) => setSortOrder(e.target.value),
              className: "min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 sm:w-auto sm:min-w-[10.5rem]",
              "aria-label": "Sort deliverables",
              children: [
                /* @__PURE__ */ jsx("option", { value: "newest", children: "Newest first" }),
                /* @__PURE__ */ jsx("option", { value: "oldest", children: "Oldest first" }),
                /* @__PURE__ */ jsx("option", { value: "name_asc", children: "Name (A\u2013Z)" }),
                /* @__PURE__ */ jsx("option", { value: "name_desc", children: "Name (Z\u2013A)" })
              ]
            }
          )
        ]
      }
    ),
    images.length > 0 && hasNarrowingFilter ? /* @__PURE__ */ jsxs("p", { className: "-mt-2 mb-4 w-full text-xs text-slate-500", "aria-live": "polite", children: [
      "Showing ",
      filteredImages.length,
      " of ",
      images.length,
      filteredImages.length === 0 ? " \u2014 try a different search or date range" : ""
    ] }) : null,
    images.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "rounded-2xl border border-dashed border-slate-200 bg-white/80 px-4 py-12 sm:px-8", children: [
      /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-lg text-center", children: [
        /* @__PURE__ */ jsx(ImageIcon, { className: "mx-auto mb-4 h-14 w-14 text-slate-300", strokeWidth: 1.25, "aria-hidden": true }),
        /* @__PURE__ */ jsx("p", { className: "text-lg font-semibold text-slate-800", children: "No deliverables yet" }),
        /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm text-slate-600 leading-relaxed", children: "When you enhance or export from Operations, your work is listed here. Pick a way to get started:" })
      ] }),
      /* @__PURE__ */ jsxs(
        "div",
        {
          className: `mx-auto mt-8 grid max-w-3xl gap-3 ${storageOnly ? "sm:max-w-md" : "sm:grid-cols-3"}`,
          children: [
            /* @__PURE__ */ jsxs(
              Link,
              {
                to: "/",
                className: "flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50",
                children: [
                  /* @__PURE__ */ jsx(Upload, { className: "h-5 w-5 text-slate-700", "aria-hidden": true }),
                  /* @__PURE__ */ jsx("span", { className: "text-sm font-semibold text-slate-900", children: "Upload photos" }),
                  /* @__PURE__ */ jsx("span", { className: "text-xs text-slate-600 leading-snug", children: "Drop files on Operations \u2014 single photo or batch." })
                ]
              }
            ),
            !storageOnly ? /* @__PURE__ */ jsxs(
              Link,
              {
                to: "/import-url",
                className: "flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50",
                children: [
                  /* @__PURE__ */ jsx(Globe, { className: "h-5 w-5 text-slate-700", "aria-hidden": true }),
                  /* @__PURE__ */ jsx("span", { className: "text-sm font-semibold text-slate-900", children: "Import from a URL" }),
                  /* @__PURE__ */ jsx("span", { className: "text-xs text-slate-600 leading-snug", children: "Scan a listing or gallery page for images." })
                ]
              }
            ) : null,
            !storageOnly ? /* @__PURE__ */ jsxs(
              Link,
              {
                to: "/image-generation",
                className: "flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50",
                children: [
                  /* @__PURE__ */ jsx(Wand2, { className: "h-5 w-5 text-slate-700", "aria-hidden": true }),
                  /* @__PURE__ */ jsx("span", { className: "text-sm font-semibold text-slate-900", children: "Generate with AI" }),
                  /* @__PURE__ */ jsx("span", { className: "text-xs text-slate-600 leading-snug", children: "Create a scene from a text prompt." })
                ]
              }
            ) : null
          ]
        }
      )
    ] }) : filteredImages.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "w-full min-w-0 rounded-2xl border border-dashed border-slate-200 bg-white/80 px-4 py-16 text-center sm:px-8 sm:py-20", children: [
      /* @__PURE__ */ jsx(Search, { className: "mx-auto mb-3 h-10 w-10 text-slate-300", strokeWidth: 1.5, "aria-hidden": true }),
      /* @__PURE__ */ jsx("p", { className: "text-base font-semibold text-slate-800", children: "No matches" }),
      /* @__PURE__ */ jsxs("p", { className: "mx-auto mt-2 max-w-xl text-sm text-slate-600", children: [
        "Nothing in your library matches",
        " ",
        /* @__PURE__ */ jsxs("span", { className: "font-medium text-slate-900", children: [
          "\u201C",
          searchQuery.trim(),
          "\u201D"
        ] }),
        "."
      ] }),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          onClick: () => setSearchQuery(""),
          className: "mt-5 inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50",
          children: "Clear search"
        }
      )
    ] }) : /* @__PURE__ */ jsx("div", { className: "grid w-full min-w-0 grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4", children: filteredImages.map((img) => {
      const latestVersion = latestImageVersion(img.versions);
      const totalCost = sumVersionProcessingCostUsd(img.versions);
      return /* @__PURE__ */ jsxs(
        "div",
        {
          className: "bg-white rounded-2xl border border-slate-200/80 overflow-hidden transition-colors hover:border-slate-300/90",
          children: [
            /* @__PURE__ */ jsx(
              "div",
              {
                className: "h-48 bg-slate-100 cursor-pointer group/thumb relative",
                onClick: () => handleReuse(img),
                children: /* @__PURE__ */ jsx(
                  FullscreenImageRegion,
                  {
                    className: "h-full w-full",
                    stopInteractionPropagation: true,
                    alwaysShowTrigger: true,
                    children: /* @__PURE__ */ jsx(HistoryThumb, { imageId: img.id, versionId: latestVersion?.id ?? null })
                  }
                )
              }
            ),
            /* @__PURE__ */ jsxs("div", { className: "p-4", children: [
              /* @__PURE__ */ jsx("p", { className: "font-medium text-slate-900 text-sm truncate", children: img.original_filename }),
              /* @__PURE__ */ jsxs("p", { className: "text-xs text-slate-500 mt-1", children: [
                img.width,
                "x",
                img.height,
                img.versions?.length > 0 && ` \xB7 ${img.versions.length} version(s)`,
                totalCost > 0 && ` \xB7 $${totalCost.toFixed(4)}`
              ] }),
              /* @__PURE__ */ jsx("p", { className: "text-xs text-slate-400 mt-1", children: new Date(img.created_at).toLocaleDateString() }),
              /* @__PURE__ */ jsxs("div", { className: "flex gap-2 mt-3", children: [
                latestVersion && /* @__PURE__ */ jsxs(
                  "button",
                  {
                    type: "button",
                    onClick: () => storageOnly ? void downloadLocal(img.id, latestVersion.id) : window.open(getDownloadUrl(img.id, latestVersion.id), "_blank"),
                    className: "flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium bg-neutral-100 text-black rounded-xl hover:bg-neutral-200 border border-neutral-200 transition-colors",
                    children: [
                      /* @__PURE__ */ jsx(Download, { className: "w-3.5 h-3.5" }),
                      "Download"
                    ]
                  }
                ),
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    onClick: () => handleDelete(img.id),
                    className: "p-2 text-neutral-400 hover:text-black hover:bg-neutral-100 rounded-xl transition-colors",
                    "aria-label": "Delete image",
                    children: /* @__PURE__ */ jsx(Trash2, { className: "w-4 h-4" })
                  }
                )
              ] })
            ] })
          ]
        },
        img.id
      );
    }) })
  ] });
}
export {
  HistoryPage as default
};

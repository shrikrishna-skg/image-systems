import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import {
  ArrowLeft,
  BookMarked,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  X
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchKnowledgeScenarioById,
  fetchKnowledgeScenarioFilters,
  fetchKnowledgeScenarios
} from "../api/knowledge";
import { isStorageOnlyMode } from "../lib/storageOnlyMode";
const storageOnly = isStorageOnlyMode();
const PAGE_SIZE = 24;
function Chip({ children }) {
  return /* @__PURE__ */ jsx("span", { className: "inline-flex max-w-full items-center rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] font-medium text-neutral-800 truncate", children });
}
function ScenarioDetailPanel({
  item,
  onClose,
  loading
}) {
  if (loading) {
    return /* @__PURE__ */ jsxs(
      "div",
      {
        className: "flex min-h-[12rem] flex-col items-center justify-center gap-3 rounded-2xl border border-neutral-200 bg-neutral-50/80 p-8",
        "aria-busy": "true",
        "aria-live": "polite",
        children: [
          /* @__PURE__ */ jsx(Loader2, { className: "h-8 w-8 animate-spin text-neutral-400", "aria-hidden": true }),
          /* @__PURE__ */ jsx("p", { className: "text-sm text-neutral-600", children: "Loading scenario\u2026" })
        ]
      }
    );
  }
  if (!item) {
    return /* @__PURE__ */ jsx("div", { className: "rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/50 p-8 text-center text-sm text-neutral-600", children: "Select a scenario from the list to view setup, rules, and expected model behavior." });
  }
  const ruleEntries = Object.entries(item.rule_summaries);
  return /* @__PURE__ */ jsxs("div", { className: "flex min-h-0 flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 pb-3", children: [
      /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
        /* @__PURE__ */ jsx("p", { className: "font-data text-[11px] font-semibold uppercase tracking-wide text-neutral-500", children: "Scenario" }),
        /* @__PURE__ */ jsx("h2", { className: "mt-1 text-lg font-semibold leading-snug text-black", children: item.title }),
        /* @__PURE__ */ jsx("p", { className: "mt-1 font-mono text-xs text-neutral-500 break-all", children: item.id })
      ] }),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          onClick: onClose,
          className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-neutral-200 text-neutral-600 hover:bg-neutral-50 hover:text-black",
          "aria-label": "Close detail",
          children: /* @__PURE__ */ jsx(X, { className: "h-4 w-4", strokeWidth: 2 })
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap gap-2", children: [
      /* @__PURE__ */ jsx(Chip, { children: item.vertical }),
      /* @__PURE__ */ jsx(Chip, { children: item.room_type_hint }),
      /* @__PURE__ */ jsxs(Chip, { children: [
        "depth ",
        item.depth_score
      ] }),
      item.risk_categories.map((c) => /* @__PURE__ */ jsx(Chip, { children: c }, c))
    ] }),
    /* @__PURE__ */ jsxs("section", { children: [
      /* @__PURE__ */ jsx("h3", { className: "text-xs font-semibold uppercase tracking-wide text-neutral-500", children: "Setup" }),
      /* @__PURE__ */ jsx("p", { className: "mt-2 whitespace-pre-wrap text-sm leading-relaxed text-neutral-800", children: item.setup })
    ] }),
    item.rule_refs.length > 0 ? /* @__PURE__ */ jsxs("section", { children: [
      /* @__PURE__ */ jsx("h3", { className: "text-xs font-semibold uppercase tracking-wide text-neutral-500", children: "Policy rules" }),
      /* @__PURE__ */ jsx("ul", { className: "mt-2 space-y-2", children: item.rule_refs.map((ref) => /* @__PURE__ */ jsxs("li", { className: "rounded-xl border border-neutral-100 bg-neutral-50/80 px-3 py-2 text-sm", children: [
        /* @__PURE__ */ jsx("span", { className: "font-mono text-xs font-semibold text-neutral-700", children: ref }),
        ruleEntries.length > 0 && item.rule_summaries[ref] ? /* @__PURE__ */ jsx("p", { className: "mt-1 text-neutral-700", children: item.rule_summaries[ref] }) : null
      ] }, ref)) })
    ] }) : null,
    item.allowed_model_behaviors.length > 0 ? /* @__PURE__ */ jsxs("section", { children: [
      /* @__PURE__ */ jsx("h3", { className: "text-xs font-semibold uppercase tracking-wide text-emerald-700", children: "Allowed behaviors" }),
      /* @__PURE__ */ jsx("ul", { className: "mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-800", children: item.allowed_model_behaviors.map((line) => /* @__PURE__ */ jsx("li", { children: line }, line)) })
    ] }) : null,
    item.forbidden_model_behaviors.length > 0 ? /* @__PURE__ */ jsxs("section", { children: [
      /* @__PURE__ */ jsx("h3", { className: "text-xs font-semibold uppercase tracking-wide text-amber-800", children: "Forbidden behaviors" }),
      /* @__PURE__ */ jsx("ul", { className: "mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-800", children: item.forbidden_model_behaviors.map((line) => /* @__PURE__ */ jsx("li", { children: line }, line)) })
    ] }) : null
  ] });
}
function KnowledgeCatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const scenarioId = searchParams.get("id")?.trim() || "";
  const [filters, setFilters] = useState(null);
  const [filtersLoading, setFiltersLoading] = useState(true);
  const [list, setList] = useState(null);
  const [listLoading, setListLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [vertical, setVertical] = useState("");
  const [roomType, setRoomType] = useState("");
  const [category, setCategory] = useState("");
  const [ruleRef, setRuleRef] = useState("");
  const [minDepth, setMinDepth] = useState("");
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const t = window.setTimeout(() => setQ(qInput.trim()), 320);
    return () => window.clearTimeout(t);
  }, [qInput]);
  useEffect(() => {
    setOffset(0);
  }, [vertical, roomType, category, ruleRef, minDepth, q]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setFiltersLoading(true);
      try {
        const data = await fetchKnowledgeScenarioFilters();
        if (!cancelled) setFilters(data);
      } catch {
        if (!cancelled) {
          toast.error("Could not load scenario filters");
          setFilters(null);
        }
      } finally {
        if (!cancelled) setFiltersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const minDepthNum = useMemo(() => {
    const n = parseInt(minDepth, 10);
    return Number.isFinite(n) && n >= 0 ? n : void 0;
  }, [minDepth]);
  const loadList = useCallback(async () => {
    setListLoading(true);
    try {
      const data = await fetchKnowledgeScenarios({
        vertical: vertical || void 0,
        room_type_hint: roomType || void 0,
        category: category || void 0,
        rule_ref: ruleRef || void 0,
        q: q || void 0,
        min_depth: minDepthNum,
        limit: PAGE_SIZE,
        offset
      });
      setList(data);
    } catch (e) {
      const msg = axios.isAxiosError(e) ? typeof e.response?.data?.detail === "string" ? e.response.data.detail : Array.isArray(e.response?.data?.detail) ? e.response.data.detail.map((d) => d.msg).filter(Boolean).join("; ") : null : null;
      toast.error(msg || "Could not load scenarios");
      setList(null);
    } finally {
      setListLoading(false);
    }
  }, [vertical, roomType, category, ruleRef, q, minDepthNum, offset]);
  useEffect(() => {
    void loadList();
  }, [loadList]);
  useEffect(() => {
    if (!scenarioId) {
      setDetail(null);
      setDetailLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setDetailLoading(true);
      try {
        const row = await fetchKnowledgeScenarioById(scenarioId);
        if (!cancelled) setDetail(row);
      } catch (e) {
        if (!cancelled) {
          setDetail(null);
          if (axios.isAxiosError(e) && e.response?.status === 404) {
            toast.error("Scenario not found");
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev);
              next.delete("id");
              return next;
            });
          } else {
            toast.error("Could not load scenario");
          }
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scenarioId, setSearchParams]);
  const clearFilters = () => {
    setVertical("");
    setRoomType("");
    setCategory("");
    setRuleRef("");
    setMinDepth("");
    setQInput("");
    setQ("");
  };
  const openScenario = (id) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("id", id);
      return next;
    });
  };
  const closeDetail = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("id");
      return next;
    });
  };
  const totalPages = list ? Math.max(1, Math.ceil(list.filtered / PAGE_SIZE)) : 1;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const canPrev = offset > 0;
  const canNext = list ? offset + PAGE_SIZE < list.filtered : false;
  if (storageOnly) {
    return /* @__PURE__ */ jsx(Navigate, { to: "/", replace: true });
  }
  return /* @__PURE__ */ jsxs("div", { className: "flex min-h-0 flex-1 flex-col bg-white", children: [
    /* @__PURE__ */ jsx("div", { className: "border-b border-neutral-200 bg-white px-4 py-4 sm:px-6 sm:py-5", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto flex max-w-6xl flex-col gap-3", children: [
      /* @__PURE__ */ jsxs(
        Link,
        {
          to: "/",
          className: "inline-flex w-fit items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-black",
          children: [
            /* @__PURE__ */ jsx(ArrowLeft, { className: "h-4 w-4", strokeWidth: 2, "aria-hidden": true }),
            "Operations"
          ]
        }
      ),
      /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [
        /* @__PURE__ */ jsx("div", { className: "flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-100 ring-1 ring-neutral-200", children: /* @__PURE__ */ jsx(BookMarked, { className: "h-5 w-5 text-neutral-800", strokeWidth: 2, "aria-hidden": true }) }),
        /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
          /* @__PURE__ */ jsx("h1", { className: "text-xl font-semibold tracking-tight text-black sm:text-2xl", children: "Scenario library" }),
          /* @__PURE__ */ jsx("p", { className: "mt-0.5 text-sm text-neutral-600", children: "Enhancement QA catalog \u2014 browse setups, policy rules, and expected model boundaries." })
        ] })
      ] }),
      list && !listLoading ? /* @__PURE__ */ jsxs("p", { className: "text-xs text-neutral-500 font-data", children: [
        "Catalog v",
        list.catalog_version,
        list.catalog_description ? ` \xB7 ${list.catalog_description}` : "",
        " \xB7 ",
        list.total,
        " scenarios total"
      ] }) : null
    ] }) }),
    /* @__PURE__ */ jsxs("div", { className: "mx-auto flex w-full max-w-6xl min-h-0 flex-1 flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6 lg:flex-row lg:gap-6", children: [
      /* @__PURE__ */ jsx("div", { className: "flex min-h-0 min-w-0 flex-1 flex-col gap-4 lg:max-w-[26rem]", children: /* @__PURE__ */ jsxs("div", { className: "rounded-2xl border border-neutral-200 bg-neutral-50/50 p-4 space-y-3", children: [
        /* @__PURE__ */ jsxs("label", { className: "block", children: [
          /* @__PURE__ */ jsx("span", { className: "text-xs font-semibold uppercase tracking-wide text-neutral-500", children: "Search" }),
          /* @__PURE__ */ jsxs("div", { className: "relative mt-1.5", children: [
            /* @__PURE__ */ jsx(
              Search,
              {
                className: "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400",
                "aria-hidden": true
              }
            ),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "search",
                value: qInput,
                onChange: (e) => setQInput(e.target.value),
                placeholder: "Id, title, vertical\u2026",
                className: "w-full rounded-xl border border-neutral-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none ring-black/5 transition-shadow focus:border-neutral-400 focus:ring-2",
                autoComplete: "off"
              }
            )
          ] })
        ] }),
        filtersLoading ? /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 py-2 text-sm text-neutral-500", children: [
          /* @__PURE__ */ jsx(Loader2, { className: "h-4 w-4 animate-spin", "aria-hidden": true }),
          "Loading filters\u2026"
        ] }) : filters ? /* @__PURE__ */ jsxs("div", { className: "grid gap-3 sm:grid-cols-2 lg:grid-cols-1", children: [
          /* @__PURE__ */ jsxs("label", { className: "block sm:col-span-2 lg:col-span-1", children: [
            /* @__PURE__ */ jsx("span", { className: "text-xs font-semibold uppercase tracking-wide text-neutral-500", children: "Vertical" }),
            /* @__PURE__ */ jsxs(
              "select",
              {
                value: vertical,
                onChange: (e) => setVertical(e.target.value),
                className: "mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400 focus:ring-2 focus:ring-black/5",
                children: [
                  /* @__PURE__ */ jsx("option", { value: "", children: "Any vertical" }),
                  filters.verticals.map((v) => /* @__PURE__ */ jsx("option", { value: v, children: v }, v))
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("label", { className: "block sm:col-span-2 lg:col-span-1", children: [
            /* @__PURE__ */ jsx("span", { className: "text-xs font-semibold uppercase tracking-wide text-neutral-500", children: "Room hint" }),
            /* @__PURE__ */ jsxs(
              "select",
              {
                value: roomType,
                onChange: (e) => setRoomType(e.target.value),
                className: "mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400 focus:ring-2 focus:ring-black/5",
                children: [
                  /* @__PURE__ */ jsx("option", { value: "", children: "Any room" }),
                  filters.room_type_hints.map((r) => /* @__PURE__ */ jsx("option", { value: r, children: r }, r))
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("label", { className: "block sm:col-span-2 lg:col-span-1", children: [
            /* @__PURE__ */ jsx("span", { className: "text-xs font-semibold uppercase tracking-wide text-neutral-500", children: "Risk category" }),
            /* @__PURE__ */ jsxs(
              "select",
              {
                value: category,
                onChange: (e) => setCategory(e.target.value),
                className: "mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400 focus:ring-2 focus:ring-black/5",
                children: [
                  /* @__PURE__ */ jsx("option", { value: "", children: "Any category" }),
                  filters.risk_categories.map((c) => /* @__PURE__ */ jsx("option", { value: c, children: c }, c))
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("label", { className: "block sm:col-span-2 lg:col-span-1", children: [
            /* @__PURE__ */ jsx("span", { className: "text-xs font-semibold uppercase tracking-wide text-neutral-500", children: "Rule ref" }),
            /* @__PURE__ */ jsxs(
              "select",
              {
                value: ruleRef,
                onChange: (e) => setRuleRef(e.target.value),
                className: "mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400 focus:ring-2 focus:ring-black/5",
                children: [
                  /* @__PURE__ */ jsx("option", { value: "", children: "Any rule" }),
                  filters.rule_refs.map((r) => /* @__PURE__ */ jsx("option", { value: r, children: r }, r))
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("label", { className: "block sm:col-span-2 lg:col-span-1", children: [
            /* @__PURE__ */ jsx("span", { className: "text-xs font-semibold uppercase tracking-wide text-neutral-500", children: "Min depth score" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "number",
                min: 0,
                max: 20,
                inputMode: "numeric",
                value: minDepth,
                onChange: (e) => setMinDepth(e.target.value),
                placeholder: "0\u201320",
                className: "mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400 focus:ring-2 focus:ring-black/5 font-data"
              }
            )
          ] })
        ] }) : /* @__PURE__ */ jsx("p", { className: "text-sm text-amber-800", children: "Filters unavailable. Check API connection." }),
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: clearFilters,
            className: "w-full rounded-xl border border-neutral-300 bg-white py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50",
            children: "Clear filters"
          }
        )
      ] }) }),
      /* @__PURE__ */ jsxs("div", { className: "flex min-h-0 min-w-0 flex-[1.4] flex-col gap-4", children: [
        scenarioId || detailLoading ? /* @__PURE__ */ jsx("div", { className: "shrink-0 lg:hidden", children: /* @__PURE__ */ jsx(ScenarioDetailPanel, { item: detail, loading: detailLoading, onClose: closeDetail }) }) : null,
        /* @__PURE__ */ jsxs("div", { className: "flex min-h-0 flex-1 flex-col rounded-2xl border border-neutral-200 bg-white shadow-sm", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-4 py-3", children: [
            /* @__PURE__ */ jsx("p", { className: "text-sm text-neutral-700", children: listLoading ? /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-2", children: [
              /* @__PURE__ */ jsx(Loader2, { className: "h-4 w-4 animate-spin text-neutral-400", "aria-hidden": true }),
              "Loading\u2026"
            ] }) : list ? /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsx("span", { className: "font-semibold text-black font-data tabular-nums", children: list.filtered }),
              " match",
              list.filtered !== list.total ? /* @__PURE__ */ jsxs(Fragment, { children: [
                " ",
                "of ",
                /* @__PURE__ */ jsx("span", { className: "font-data tabular-nums", children: list.total })
              ] }) : null
            ] }) : "No data" }),
            list && list.filtered > PAGE_SIZE ? /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
              /* @__PURE__ */ jsxs(
                "button",
                {
                  type: "button",
                  disabled: !canPrev || listLoading,
                  onClick: () => setOffset((o) => Math.max(0, o - PAGE_SIZE)),
                  className: "inline-flex h-9 items-center gap-1 rounded-xl border border-neutral-200 px-3 text-sm font-medium text-neutral-800 disabled:opacity-40 hover:bg-neutral-50",
                  children: [
                    /* @__PURE__ */ jsx(ChevronLeft, { className: "h-4 w-4", "aria-hidden": true }),
                    "Prev"
                  ]
                }
              ),
              /* @__PURE__ */ jsxs("span", { className: "text-xs text-neutral-600 font-data tabular-nums", children: [
                currentPage,
                " / ",
                totalPages
              ] }),
              /* @__PURE__ */ jsxs(
                "button",
                {
                  type: "button",
                  disabled: !canNext || listLoading,
                  onClick: () => setOffset((o) => o + PAGE_SIZE),
                  className: "inline-flex h-9 items-center gap-1 rounded-xl border border-neutral-200 px-3 text-sm font-medium text-neutral-800 disabled:opacity-40 hover:bg-neutral-50",
                  children: [
                    "Next",
                    /* @__PURE__ */ jsx(ChevronRight, { className: "h-4 w-4", "aria-hidden": true })
                  ]
                }
              )
            ] }) : null
          ] }),
          /* @__PURE__ */ jsx("div", { className: "min-h-0 flex-1 overflow-y-auto overscroll-contain", children: listLoading && !list ? /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center justify-center gap-3 py-16 text-neutral-500", children: [
            /* @__PURE__ */ jsx(Loader2, { className: "h-8 w-8 animate-spin", "aria-hidden": true }),
            /* @__PURE__ */ jsx("p", { className: "text-sm", children: "Loading scenarios\u2026" })
          ] }) : list && list.items.length === 0 ? /* @__PURE__ */ jsx("p", { className: "p-8 text-center text-sm text-neutral-600", children: "No scenarios match these filters." }) : list ? /* @__PURE__ */ jsx("ul", { className: "divide-y divide-neutral-100", role: "list", children: list.items.map((row) => {
            const active = scenarioId === row.id;
            return /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: () => openScenario(row.id),
                className: `flex w-full flex-col items-start gap-1 px-4 py-3 text-left transition-colors ${active ? "bg-neutral-100" : "hover:bg-neutral-50"}`,
                children: [
                  /* @__PURE__ */ jsx("span", { className: "text-sm font-semibold text-black", children: row.title }),
                  /* @__PURE__ */ jsx("span", { className: "font-mono text-[11px] text-neutral-500 break-all", children: row.id }),
                  /* @__PURE__ */ jsxs("span", { className: "text-xs text-neutral-600", children: [
                    row.vertical,
                    " \xB7 ",
                    row.room_type_hint,
                    " \xB7 depth ",
                    row.depth_score
                  ] }),
                  row.risk_categories.length > 0 ? /* @__PURE__ */ jsxs("span", { className: "mt-1 flex flex-wrap gap-1", children: [
                    row.risk_categories.slice(0, 4).map((c) => /* @__PURE__ */ jsx(Chip, { children: c }, c)),
                    row.risk_categories.length > 4 ? /* @__PURE__ */ jsxs(Chip, { children: [
                      "+",
                      row.risk_categories.length - 4
                    ] }) : null
                  ] }) : null
                ]
              }
            ) }, row.id);
          }) }) : null })
        ] })
      ] }),
      (scenarioId || detailLoading) && /* @__PURE__ */ jsx("div", { className: "hidden min-h-0 w-full max-w-xl shrink-0 lg:block", children: /* @__PURE__ */ jsx("div", { className: "sticky top-4 max-h-[calc(100dvh-6rem)] overflow-y-auto overscroll-contain", children: /* @__PURE__ */ jsx(ScenarioDetailPanel, { item: detail, loading: detailLoading, onClose: closeDetail }) }) })
    ] })
  ] });
}
export {
  KnowledgeCatalogPage as default
};

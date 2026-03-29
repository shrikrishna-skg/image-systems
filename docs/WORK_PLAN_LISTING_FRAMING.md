# Work plan: listing framing (side angle = end-of-room vantage)

## 0. Canonical mental model (user intent)

**Side angle** = **end-of-room vantage**: the viewer stands at **one narrow end** of a rectangular room (entrance end, foot-of-beds end, short wall by the door) and looks **lengthwise** into the space — **depth** toward the **far wall / window**, **verticals plumb**, calm **one-point** (or two-point) perspective.

**Reference archetype (double-queen hotel):** beds run along **one long side** (often **right** half of the frame), dresser/TV/desk along the **other** — both **fully readable**; **not** a thin bed strip on the outer edge.

**Not front angle:** not standing mid-long-wall shooting **straight into** that wall.

**Hero side:** **infer** from each photo — bed run may be **left or right** in the frame; do **not** assume left-only.

## 1. What we are trying to match (golden reference)

From the reference pair (original → target in red box):

| Dimension | Target behavior |
|-----------|-----------------|
| **Camera story** | **Narrow end**, **lengthwise** view — depth to **far** wall; **not** straight-on one wall. |
| **Verticals / roll** | **Plumb** — parallel to frame edges. |
| **Hero (bed run)** | **Strong band** in frame (~**40–58%** midline typical), **left or right** per room — **not** outer-edge sliver. |
| **Opposite wall** | Dresser / desk / sofa **readable** when in source. |
| **Depth** | Clear path / vanishing toward **back** of room. |

**Important learning:** This is **not** “average all furniture and center at 50%.” It is a **directed camera story** plus **asymmetric** framing.

---

## 2. Why repeated prompt + centroid tweaks under-shoot

1. **Single objective vs multi-objective**  
   Browser code optimizes **one horizontal centroid** (hero-weighted). The reference also implies a **second axis**: **crop / weight the right edge** differently from the left. That is not modeled today beyond whatever falls out of one global pan.

2. **Pan semantics**  
   In `localEnhance.ts`, `drawImage(src, shift, 0)` on a fixed canvas: **positive `shift`** introduces white on the **left** and **clips the right** of the bitmap — i.e. a **right-tightening** pan useful for “less bathroom.” **Negative `shift`** clips the **left** (bad if we need sofa).  
   **Centering** alone picks a sign from `w/2 - centroid`; it does **not** optimize “sofa visible + right tight + bed at 50%” jointly.

3. **Cloud step is under-constrained**  
   Even with strong text, generative models **drift** on composition. Browser prep should get as close as possible to a **measurable** layout so the model does less invention.

4. **No closed-loop measurement**  
   We do not **score** outputs (e.g. headboard x vs 0.5w, right-edge “void” ratio) on CI or on a **fixed golden image** — so regressions are subjective.

---

## 3. Learning loop (how we improve without guessing)

### A. Golden set & metrics (Phase 0 — **start here**)

- [ ] Check in **1–3 golden pairs** (raw + approved target) under `fixtures/listing_framing/` (or similar), **licensed** or internal-only.
- [ ] Define **automatable proxies** (even rough):
  - `headboard_x_rel` — horizontal position of strongest vertical-edge ridge in mid band /  manual label once.
  - `right_void_ratio` — % of right 15% strip that is near-white or low-detail (proxy for “too much doorway”).
  - `sofa_visible` — boolean / area of left 25% strip above threshold (heuristic).
- [ ] **Document** which metrics the team cares about first (prioritize 1–2).

### B. Browser pipeline experiments (Phase 1)

- [ ] **Side-angle profile v2**: explicit **two-step** plan in code comments + optional implementation:
  1. Pan to put **hero midpoint** at target `x` (e.g. 0.48–0.50 `w`).
  2. Optional **composition bias**: small **additional positive `shift`** (right clip) capped so sofa column still passes a minimum “visible” heuristic — *only for `change_angle_side`*.
- [ ] A/B on golden set: centroid-only vs centroid + bias.
- [ ] Log chosen `shift` per pass (dev-only flag) to compare runs.

### C. Prompt / cloud (Phase 2)

- [ ] Keep **inventory / no-symmetry** locks; add **one** line that encodes **asymmetric margins** for side angle: e.g. “preserve sofa on the left; do not expand empty doorway on the right.”
- [ ] Track **provider + model** in experiment notes (same prompt ≠ same geometry).

### D. Evaluation gate (Phase 3)

- [ ] **pytest**: keep prompt substring tests (already in repo).
- [ ] Optional **Node or Python script**: run centroid + shift on golden bitmap, assert metrics within tolerance (no GPU required).
- [ ] Human **two-alternative** check on internal dashboard before shipping framing changes.

### E. Longer-term (Phase 4 — only if Phases 0–3 plateau)

- [ ] Lightweight **detection** (headboard / bed bbox) to drive `x` target instead of heuristics only.
- [ ] **User override**: slider “Hero horizontal” / “Tighten right” for power users.

---

## 4. Roles & cadence

| Owner | Task |
|-------|------|
| Product / creative | Lock 1 reference + acceptable tolerance (“bed between 47–53% ok”). |
| Engineering | Implement Phase 0 fixtures + metrics script; ship Phase 1 bias behind flag if needed. |
| QA | Golden image regression when touching `localEnhance.ts` or `prompt_templates.py` listing blocks. |

**Cadence:** After each change, run **golden script** + **pytest** + one **manual** compare on the reference room.

---

## 5. Success criteria (definition of done for “left-side center” side angle)

On the golden image, **without** cloud hallucinations:

1. Bed / headboard midpoint **48–52%** of output width.  
2. **No** hard clip of sofa on the **left** edge (subjective threshold agreed with design).  
3. **Right** side **not** dominated by bathroom void vs reference (heuristic or human pass).  
4. Verticals **not worse** than current Improve roll stack baseline.

---

## 6. Related code (starting points)

- `frontend/src/lib/localEnhance.ts` — Sobel roll, tight crop, `listingHeroCentroidProfile`, `horizontallyRecenterListingCanvas`, `shiftCanvasHorizontally`.
- `backend-java/src/main/resources/prompts/` — enhancement prompt bundle (ported from former Python `prompt_templates`).

---

*Last updated: work plan for iterative learning; update this file when phases complete or metrics change.*

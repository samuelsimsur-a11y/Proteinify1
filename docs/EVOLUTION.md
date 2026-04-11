# Proteinify — evolution ledger & version IDs

This file is the **single source of truth** for *meaningful* product changes (UI, recipe generation, prompts—not every typo fix). Use it so any human or agent can see **what changed, in what order**, and **how to roll back** a line of work.

---

## Provenance (how this log is built)

- **No git history** was available in this workspace when the ledger was created — entries are **backfilled from Cursor agent transcripts** (`agent-transcripts/*.jsonl`) and **known conversation context**, not from `git log`.
- When you **initialize git** or use **GitHub**, start referencing **commit SHAs** in the “Revert hints” column for real reversibility.
- **DIL internals** (`src/lib/culinary/dil/`) are often created or updated by the same agent sessions as the app; they are listed here for **context** even if your team treats DIL as a separate subsystem.

---

## Version ID rules

We use **`N`** and **`N.M`** (like `3.2`, `4.1`). No third decimal unless you truly need sub-steps on the same day for the same micro-change.

| Bump | Meaning | Examples |
|------|---------|----------|
| **`N` (whole number)** | **New track** or a **different major aspect** of the app: recipe generation pipeline, version-card IA, API contract, DIL bootstrap, etc. | `3` → `4` when moving from “version card UI” work to “system prompt / generation” work. |
| **`N.M` (decimal)** | **Another iteration on the same track**—refinements, follow-up prompts, toggles, visual polish on the same feature idea. | `3.1` first pass on components → `3.2` tweak density → `3.3` accordion + legacy flag. |

**Optional tags** (in the ledger entry, not in the ID):

- **`[agent]`** — change driven from Cursor agent chat (multi-file edits).
- **`[prompt]`** — change driven from a one-off user paste into the prompt box (still log it here after).

**Revert discipline**

- Prefer **git**: each ledger entry should mention **branch/commit** when available.
- If not using git: note **exact files** and **flags** (e.g. `VERSION_CARD_LEGACY_LAYOUT` in `src/components/proteinify/versionCardLayout.ts`) so a future agent can undo without guessing.

---

## Current head

**`5.1`** — full agent-history backfill documented in this file.

Agents: when you finish a *notable* change, **bump the head**, **append a row** to the ledger (newest first), and mention the new ID in your summary.

---

## Ledger (newest first)

| ID | Date | Source | Summary | Primary areas / files | Revert hints |
|----|------|--------|---------|-------------------------|--------------|
| **5.1** | 2026-04-10 | [agent] | Expanded evolution ledger with **full backfill** of agent work from transcripts (no git) | `docs/EVOLUTION.md` | Remove redundant rows; restore shorter ledger |
| **5.0** | 2026-04-10 | [agent] | Introduced **EVOLUTION.md** + pointer in `.cursorrules` for cross-session tracking | `docs/EVOLUTION.md`, `.cursorrules` | Delete `docs/EVOLUTION.md` section from `.cursorrules` |
| **4.1** | 2026-04-10 | [prompt]+[agent] | Close Match: **bans whey/powders/supplements**; **+8g** min delta; **CREATIVE_SWAP_PALETTE**; **STRUCTURAL_DISH_RULES**; whey pairing / ≤2-of-3 tiers; swapSummary Close Match rule | `src/lib/culinary/systemPrompt.ts` | Restore prior `MODE_INSTRUCTIONS`, remove new constants from `buildSystemPrompt` |
| **4.0** | 2026-04-10 | [agent] | Recipe-generation track: **user-message** non-redundancy; **tone** (warm cook, not linter); **TIER_SUMMARY** / **transformationByComponent** vs pills; **QUALITY_BAR** tone | `src/app/api/generate/route.ts`, `src/lib/culinary/systemPrompt.ts`, `src/components/proteinify/humanizeIngredientDisplay.ts` | Revert edits in those files |
| **3.3** | 2026-04-10 | [agent] | Version card **v2**: header vs body hierarchy; **Full recipe** nested accordion; **swap pills hidden when expanded**; **gradient** component bubbles; **`VERSION_CARD_LEGACY_LAYOUT`**; main toggle “See transformation” | `VersionCard.tsx`, `versionCardLayout.ts` | `VERSION_CARD_LEGACY_LAYOUT = true` or restore file from backup |
| **3.2** | 2026-04-10 | [agent] | **Bubble cards** restored: large category title, small hint + bullets; **stronger** borders/shadows; collapsed **rounded-2xl** slot chips | `VersionCard.tsx` | Same as 3.x |
| **3.1** | 2026-04-10 | [agent] | **Lighter / flatter** experiment: swap-style pills, less chrome; **IngredientRow** simplified (no “Ingredient” header, tighter padding) — user asked to **reverse direction** next | `VersionCard.tsx`, `IngredientRow.tsx` | Git/restore; compare to 3.2 |
| **3.0** | 2026-04-10† | [agent] | **Component slots** in UI: `COMPONENT_SLOTS` + **transformationByComponent** on cards (`transformationUiConstants.ts`, `VersionCard` pills + “What changed”) | `transformationUiConstants.ts`, `VersionCard.tsx`, types/parser if any | Remove slot UI; strip `transformationByComponent` from display |
| **2.3** | 2026-04† | [agent] | **Hydration** / **400** fixes: `dish`+`mode` required, DIL dish lookup errors, client/server mismatch | `ProteinifyApp.tsx`, `clientGenerate.ts`, `route.ts`, `validateRequest` | See transcript-driven patches |
| **2.2** | 2026-04† | [agent] | **Server-side** generate **dedupe / short cache** to speed repeat requests | `src/app/api/generate/route.ts` | Remove cache map / TTL |
| **2.1** | 2026-04† | [agent] | User **Downloads** drop-in: replaced **`systemPrompt.ts`**, **`route.ts`**, **`proteinify_schema.json`** with supplied versions | Those paths under `src/` | Restore prior files |
| **2.0** | 2026-04† | [agent] | **Recipe wire upgrade**: `RecipeVersion` fields **`totalProteinG`**, **`swapSummary`**, **`mealPrepNote`**, **`proteinMathWarning`**; Results/InputLab/VersionCard wiring | `src/lib/proteinify/types.ts`, `parseResponse.ts`, UI components | Revert types + parser + UI |
| **1.4** | 2026-04† | [agent] | **API contract** hardening: backward-compatible **`/api/generate`** body (`dish`, `mode`, `transformationMode`, sliders) | `route.ts`, `validateRequest.ts`, `apiContract.ts`, `clientGenerate.ts` | Tighten validation only with migration |
| **1.3** | 2026-04† | [agent] | **DIL integrity** + **deps**: fix guard↔dish refs; **zod** peer; stable **`npm install`** | `loader.ts`, `swapGuards.json` / `dishDNA.json`, `package.json` | Restore JSON + package versions |
| **1.2** | 2026-04† | [agent] | **`install_dil.sh`** maintained in repo; **dev:auto** port picker; installer **idempotent** patches (rerun doesn’t break `join`) | `src/lib/proteinify/install_dil.sh`, `package.json` | Use older installer |
| **1.1** | 2026-04† | [agent] | Fix **malformed `parts.join("`** / broken newlines from **script paste** in generated TS | `route.ts`, `systemPrompt.ts`, `loader.ts` | Repair strings |
| **1.0** | 2026-04† | [user script]+[agent] | **Initial DIL + API scaffold**: `.cursorrules`, `schemas`, `loader`, `promptBuilder`, `validator`, `dishDNA.json`, `swapGuards.json`, `golden-regression`, **`/api/generate`** with DIL validation, `systemPrompt` modes | `src/lib/culinary/dil/**`, `src/app/api/generate/route.ts`, `src/lib/culinary/systemPrompt.ts` | Re-run from template / version control |

† Approximate month; exact day unknown without git.

---

## Chronological story (oldest → newest) — same IDs

1. **1.0** — Project bootstrap: DIL pack + generate route + biryani sample data.  
2. **1.1** — Hotfix broken string concatenations from installer paste.  
3. **1.2** — Installer script in tree; dev ergonomics.  
4. **1.3** — Data + dependency stability so `validateDILIntegrity()` passes.  
5. **1.4** — Client/API request shape compatibility.  
6. **2.0** — Richer recipe version model + UI surfacing.  
7. **2.1** — File replacements from Downloads (prompt + route + schema).  
8. **2.2** — Performance: caching / dedupe on generate.  
9. **2.3** — Runtime errors: hydration, 400s, dish lookup.  
10. **3.0** — Component slot map + “What changed” UX.  
11. **3.1** — Density reduction experiment (partially reverted by user feedback).  
12. **3.2** — Bubble cards + emphasis.  
13. **3.3** — Accordion recipe, legacy flag, anti-redundancy UI.  
14. **4.0** — Prompt + API + humanize: tone and non-duplication.  
15. **4.1** — Close Match protein rules, creative palette, structural dishes.  
16. **5.0** — Evolution doc + rules pointer.  
17. **5.1** — Full agent ledger backfill (this document).

---

## How this relates to “agent vs prompt box”

- **Cursor agent** — can edit many files; **update this ledger** when the change is user-visible or affects generation behavior.
- **Prompt box only** — small tweaks: still log a **`N.M`** bump if rollback might matter.

---

## Files touched by this system

- `docs/EVOLUTION.md` — this ledger  
- `.cursorrules` — pointer so agents know the ledger exists  

---

*Last updated: 2026-04-10 (5.1 backfill)*

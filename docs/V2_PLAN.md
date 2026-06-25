# Cadence v2 — Plan

> **Thesis:** Stop building a tracker. Build a coach that owns your rhythm — with **zero paid AI**.
>
> v1 measures you, colors a number, and waits. v2 has *memory, foresight, and a voice* — all from
> statistics and craft, not API tokens. The name finally earns itself: Cadence becomes about **rhythm**.

**Hard constraint:** No paid AI / no API budget. Claude Pro only. Every "intelligent" feature below is
deterministic (stats + templated natural language) and runs free. An LLM is an *optional flavor layer*
(on-device, or a personal Claude Code routine), never a dependency.

---

## 1. The Rhythm Engine — replace the flat Discipline Score

v1's score is a single same-day average with no memory (`src/lib/discipline.ts`). v2 models three living
signals, borrowed from athletic-training science:

### Cadence (the hero number, 0–100)
A momentum-weighted EMA of daily completion, **not** a raw average.

```
α = 1 - 0.5^(1/halfLife)      // halfLife ≈ 7 days
cadence_t = α · completion_today + (1 - α) · cadence_{t-1}
```

Why it's better: it *remembers* but *forgives* — one miss dents it, a good run heals it fast. This is the
"momentum" idea from the original spec, finally made the centerpiece instead of a side metric.

### Load vs. Recovery (the foresight nobody else has)
Treat commitments like training volume.

```
acute_load   = rolling 7-day weighted sum of attempts (habits targeted + tasks committed + blocks planned)
chronic_load = rolling 28-day average of daily load
ACWR         = acute_load / chronic_load        // acute:chronic workload ratio
```

- **0.8 – 1.3** → sustainable, in the groove.
- **> 1.5** → spike. The coach warns: *"You're ramping too fast — historically you crash ~4 days after a spike like this."*
- **< 0.8** → coasting / detraining.

No habit app tells you you're about to burn out. This one will.

### Recovery is first-class
Planned rest stops being a `skip` that punishes you. New `rest` status (or per-habit rest schedule).
A "recovery debt" accrues if you go N hard days with no rest. This is the honest, anti-burnout shift that
fits Cadence's ethos — discipline includes knowing when to stop.

### Rhythm state machine
`In Rhythm · Building · Slipping · Recovering · Overreaching` — derived from cadence trend + ACWR. Drives
the coach's tone **and** the reactive accent color (see Design).

---

## 2. The Signature Visual — "The Pulse"

Retire the borrowed GitHub heatmap as the hero (keep it as a detail view). The new hero is an **EKG-style
waveform**: each day is a beat — amplitude = activity, regularity = consistency. A steady, even pulse means
you're in rhythm; a flatline or arrhythmia is visible at a glance. Pure animated SVG, no library, color
shifts with rhythm state. This is the *ownable* image of the brand.

---

## 3. The Coach — intelligent, deterministic, free

Full read access to your data; **no LLM required**. "Smart" comes from real statistics + a large library of
templated, identity-framed copy that rotates so it never feels canned.

- **Pattern mining** — conditional completion rates across factors (weekday, calendar load, prior-day
  outcome, time-of-day). Surface only statistically meaningful ones with a min sample size:
  *"Your workout skip-rate is 3.2× higher on days with >3 meetings."*
- **Morning brief** — picks today's at-risk habits (weak weekday), proposes time-blocks in calendar gaps,
  orders tasks by priority/due/aging. Templated prose with identity framing.
- **Evening reflection** — plan-vs-actual, cadence delta, honest verdict tiers (no vanity inflation).
- **Recommendations** — adaptive targets (raise after 3 strong weeks, split/lower after weak ones),
  best-time suggestions, freeze-token advice, burnout warnings from ACWR.
- **Forecasting** — predict the day most likely to break a streak; project burnout risk from load.

### Optional LLM flavor (still $0) — later, not required
1. **On-device WebLLM** (e.g. Llama-3.2-1B / Qwen2.5 in a web worker, lazy-loaded) to rewrite the templated
   brief into fluent prose and power a chat. Free + private; cost is a one-time model download.
2. **Personal Claude Code routine** — a nightly scheduled agent on *your* Pro/Max plan reads Supabase and
   writes a richer weekly review into `coach_briefs`. Single-user only, but genuinely free.

The app never depends on either — they're upgrades to copy quality, not the substance.

---

## 4. Design — from one dashboard to a multi-surface app

| Surface | Role |
|---|---|
| **Today** | Timeline-centric: morning brief on top, calendar + blocks + habits inline. The "do" screen. |
| **Rhythm** | The Pulse hero, cadence number, load/recovery gauges, heatmap demoted to detail, insights. The "see" screen. |
| **Coach** | Brief history, detected patterns, recommendations, (optional chat). The "reflect" screen. |
| **Seasons** | Current 12-week season + theme, identities, and the habits laddering up to who you're becoming. |

- **Reactive accent** — color temperature tracks rhythm state (cool violet = steady → warm amber/red = slipping).
- **Cmd-K command palette** — quick-capture habits/tasks/blocks from anywhere.
- **PWA + push** — installable; web-push (VAPID) is **free**, no API cost. Delivers the morning brief and
  streak-save nudges so the coach actually reaches you. This is what makes it feel alive.

---

## 5. Deeper mechanics — Identity & Seasons

- **Identity-first** — habits ladder to identities ("a writer," "an athlete"). Copy reinforces *who you're
  becoming*, not just streak counts.
- **Seasons / 12-week cycles** — a theme + a review ritual gives the daily grind a narrative arc.
- **Recovery days** — first-class (see §1), not a punished skip.
- *(Optional)* **Pacts/stakes** — put something on the line.

---

## 6. Schema changes (Supabase, RLS on every table)

- `rhythm_daily` — date, cadence, load_acute, load_chronic, acwr, state. (augments/replaces `daily_scores`)
- `identities` + `habit_identities` (link table)
- `seasons` — start, end, theme, review jsonb
- `coach_briefs` — date, type (morning|evening|weekly), payload jsonb, source (heuristic|llm)
- `patterns` — detected pattern jsonb, confidence, sample_size
- `energy_logs` — optional morning self-report (1–5), feeds load/recovery + coach
- habit recovery config OR new `rest` value on `habit_logs.status`

---

## 7. Roadmap (each phase shippable)

- **Phase 0 — Rhythm Engine + The Pulse.** New math, `rhythm_daily` table + backfill, replace the hero
  number and visual. (Refactor `src/lib/discipline.ts` → `src/lib/rhythm.ts`, fully unit-tested.)
- **Phase 1 — Multi-surface redesign.** Today / Rhythm / Coach / Seasons routes, reactive accent, Cmd-K.
- **Phase 2 — Deterministic Coach.** Pattern mining + morning/evening briefs + recommendations.
- **Phase 3 — Identity & Seasons.** Mechanics + recovery-days first-class.
- **Phase 4 — PWA + push.** Installable, web-push briefs and streak-save nudges (free).
- **Phase 5 (stretch, optional, $0) — LLM flavor.** On-device WebLLM for fluent briefs + chat, and/or the
  personal Claude Code nightly routine.

---

## Guiding principles (unchanged from v1)
- TypeScript strict, RLS on every table, secrets in env only, Server Components first.
- Honest Mode: no vanity inflation. Identity framing in copy.
- Keep the app runnable at every step. Calendar sync stays isolated behind its interface.
- **Every core feature works with zero paid AI.**

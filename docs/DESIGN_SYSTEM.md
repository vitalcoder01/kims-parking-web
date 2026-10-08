# KIMS Parking — Design System & Architecture Notes

This document describes the elevated, shared design system introduced across
the web PWA (`kims-parking-web`) and the mobile app (`kims-parking-frontend`),
how to adopt it screen‑by‑screen, and the architecture decisions behind it.

The brief was: *upgrade the UI, keep it from feeling generic, and improve the
architecture — without breaking a mature, working product.* The palette is
unchanged. What changed is that the app now has a **real sense of depth, one
shared motion vocabulary, a typographic rhythm, and a set of composable
primitives** that screens build from instead of re‑deriving inline styles.

---

## 1. Tokens

`src/theme/tokens.ts` (web) and `src/theme/tokens.ts` (mobile) are siblings:
same names, platform‑correct shapes.

### Elevation
A five‑step scale — `e0`–`e4`. On the web these are layered CSS box‑shadows
(a tight contact shadow + a soft ambient one), tuned separately for light and
dark. On mobile they are `ViewStyle` shadows (iOS `shadow*` + Android
`elevation`).

```ts
import {shadow} from '../theme';
// web:    boxShadow: shadow(isDark, 'e2')
// mobile: style={[card, shadow(isDark, 'e2')]}
```

Guidance: resting cards `e1`, raised/hover `e2`, sheets/popovers `e3`,
modals & floating hero cards `e4`.

### Motion
`duration` (ms) + `easing` curves, so everything that moves moves the same
way. Web adds a `transition()` helper; mobile exposes `Easing`‑based curves
for `Animated`.

- `standard` — the default enter/settle curve.
- `decelerate` / `accelerate` — arriving / leaving.
- `spring` — a small tasteful overshoot for affirmative moments.

### Type ramp
`text.<variant>` bundles size + weight + line‑height + tracking:
`display, title, heading, subhead, body, bodySm, label, caption, overline`.
A screen writes one variant instead of re‑picking four numbers. (Web
line‑heights are multipliers; mobile are pixels, since RN requires that.)

---

## 2. The primitives kit (`components/ui/`)

One import site for the shared building blocks. Every primitive is
theme‑aware and built on the tokens.

| Primitive | Purpose |
|---|---|
| `Surface` | The elevated card. Decides depth, fill, border, radius, hover‑lift, focus ring. |
| `Text` (`AppText` on mobile) | Typed text bound to the type ramp + theme tones. |
| `Button` | The one CTA — primary / secondary / ghost / danger, 3 sizes, icons, loading. |
| `Field` | Labelled input: resting fill, border only on focus/error, `invalid` for form‑level errors. |
| `IconButton` | Circular icon‑only control (plain / soft / solid). |
| `Avatar` | Initials / icon chip with optional presence dot. |
| `SectionHeader` | Eyebrow + title + optional action. |
| `StatTile` | A KPI tile — icon chip, big value, label, trend, `emphasis`. |
| `EmptyState` | The shared “nothing here (yet)” state. |
| `Skeleton` / `SkeletonText` | Shimmer loading placeholders (web). |
| `SegmentedControl` | In‑screen view switcher with a single active pill. |
| `ProgressBar` | Slim progress track. |
| `Chip` | Selectable filter chip (distinct from the read‑only `Badge`). |
| `Divider` | Hairline rule, optional centered label. |

The barrel re‑exports the pre‑existing `Button`/`Card`/`Badge`/`Skeleton` so
the kit is a single import.

### Dev tooling (web, not shipped)
- `gallery.html` → `src/gallery/` renders the whole kit in both themes.
- `preview.html` → `src/preview/` mounts a **real screen** inside mock
  Auth/AppState/Dialog providers, so authed screens can be reviewed and
  snapshotted without the backend:
  `?screen=doctor-home&scenario=parked&role=doctor`.

Neither is a production rollup input (`vite build` only inputs `index.html`).

---

## 3. Adopting the kit in a screen

A low‑risk, repeatable recipe:

1. Replace ad‑hoc card `div`s with `Surface` (+ an `elevation`).
2. Replace repeated `fontSize/fontWeight/...` spans with `Text variant=…`.
3. Replace the black CTA pill with `Button`.
4. Replace the empty / loading branches with `EmptyState` / `Skeleton`.
5. **Keep all state, effects and handlers byte‑for‑byte.** The rework is
   presentational.
6. Verify in the preview harness (web) or `tsc --noEmit` (mobile), light & dark.

Screens already on the kit: **Login, Sign‑up, Doctor home, Driver dashboard,
Settings** (web); **Login, Sign‑up** cards (mobile). The remaining screens
follow the same recipe.

---

## 4. Architecture notes

### What was improved
- **A real component layer.** The biggest architectural smell was
  duplicated, inline, per‑screen styling. The kit gives the app shared,
  named boundaries; screens shrink and stop re‑deriving the same card.
- **DRY of true duplicates** (e.g. the Doctor home Arrival/Departure
  launchers collapsed into one `LauncherCard`).
- **Testability.** The Auth/AppState contexts now export their raw context +
  types, which is what lets the preview harness inject mock data — and would
  let unit tests do the same.

### A deliberate non‑change: the socket store
`AppStateContext` is ~1100 lines and looks like a god‑object, but it is a
**carefully race‑guarded socket‑sync store**. Its own comments document the
specific bugs its guards prevent: fetch‑sequence races (`fetchSeqRef` /
`mutationSeqRef`), the reassign‑prompt queue, and the driver‑freeing races.
It already splits the high‑frequency GPS feed into a separate context so a
location ping doesn’t re‑render every screen, and it memoises its value.

Fragmenting that store risks reintroducing exactly those races for a
re‑render win that only materialises once consumers migrate. Given the brief
("make no mistakes") the right call was **not** to rewrite it. If/when it is
split, the safe, additive first step is a separate `useAppActions()` context
(stable action identities) that action‑only components can opt into, leaving
the data context and all the race guards untouched — then migrate consumers
incrementally.

### Recommended next steps
1. Continue kit adoption across the remaining web screens (Valet, Admin,
   Analytics, Vehicle setup, History, Records).
2. Break up the giant **leaf** screens (`ValetHomeScreen` ~2000 lines,
   `ValetRecordsScreen` ~1000) into sub‑components + hooks — low risk because
   they are leaves, high readability payoff. Verify each in the harness.
3. Port the kit into the mobile screens the same way, verified on a device /
   emulator (the mobile app can’t be screenshotted headlessly here).
4. Only then consider the additive `useAppActions()` split above.

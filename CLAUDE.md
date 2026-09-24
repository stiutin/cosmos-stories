# CLAUDE.md

Working notes for AI assistants (and humans) on this repository. Read this first: it explains what the project is, how it's built, which rules must not be broken, and how to verify a change. When something here gets out of date, fix this file in the same change.

---

## 1. What this is

**Cosmos Stories** is an Angular 22 web app that shows NASA's Astronomy Picture of the Day (APOD) as Instagram-style stories. It has:

- story rings;
- a 3D cube between groups;
- tap, hold and swipe gestures;
- deep links;
- offline PWA support.

The repo also contains **`@cosmos-stories/carousel`**, a carousel library with a framework-agnostic engine. The app consumes it twice: the "Today in space" banner and the stories cube.

- Live: `https://stiutin.github.io/cosmos-stories/` (GitHub Pages, sub-path `/cosmos-stories/`)
- Playground (library docs): `/playground`
- It is a **portfolio project**. Code quality, tests, accessibility and docs matter as much as features. The history is documented stage by stage in `CHANGELOG.md` and `docs/adr/`.

## 2. Toolchain

| Tool         | Version                                                                                                                                  | Notes                                                                                                                     |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Node.js      | **24** (`.nvmrc`); Angular 22 needs ≥ 22.22.3 or ≥ 24.15                                                                                 | Scripts are `.ts` run by Node's native type stripping                                                                     |
| npm          | 11 (ships with Node 24)                                                                                                                  | npm 10.9 has an arborist bug (`Cannot read properties of null (reading 'edgesOut')`) on fresh lock generation; use npm 11 |
| Angular      | 22.x                                                                                                                                     | zoneless; **OnPush is the default** in v22; fetch is the default HTTP backend                                             |
| TypeScript   | 6.0                                                                                                                                      | strict + `noUncheckedIndexedAccess`, `noPropertyAccessFromIndexSignature` (app)                                           |
| Test runners | Vitest 4 (through `ng test`), `node:test`, Playwright 1.63                                                                               |                                                                                                                           |
| Lint/format  | ESLint 10 flat config (`defineConfig`), `typescript-eslint` **strictTypeChecked**, `angular-eslint` 22 (incl. template a11y), Prettier 3 |                                                                                                                           |
| Other        | sharp (images), `@angular/service-worker`, Lighthouse CI, axe-core                                                                       |                                                                                                                           |

`package.json` has `"type": "module"`.

## 3. Commands

```bash
npm start                  # dev server :4200 (prestart installs sample data if public/data/apod.json is missing)
npm run build              # production build (prebuild ensures data)
npm run build:lib          # ng-packagr build of projects/carousel → dist/carousel
npm test                   # Vitest: app, then library (fake DOM, fake timers)
npm run test:lib           # library only;  npm run test:coverage for coverage
npm run test:scripts       # node:test for scripts/*.test.ts (sharp image pipeline)
npm run typecheck:scripts  # tsc for scripts/ and e2e/ (separate tsconfigs)
npm run lint               # ESLint (type-aware; slow-ish)
npm run format             # Prettier write;  format:check in CI
npm run check              # format:check + lint + typecheck:scripts + test + test:scripts  ← run before finishing
npm run e2e                # e2e:build (base href /cosmos-stories/ + fixture data + story pages) then Playwright
npm run e2e:run            # Playwright only (reuses the last e2e build)
npm run e2e:install        # download Playwright's Chromium (once per machine)
npx lhci autorun           # Lighthouse with gates (needs `npm run e2e:build` first; uses e2e/serve.ts)
npm run data:fetch         # real snapshot from NASA (needs NASA_API_KEY in .env), images optimised
npm run data:sample        # back to bundled sample data
```

### Definition of done for any change

1. `npm run check` is green.
2. UI or behaviour change: `npm run e2e` is green, both projects (`mobile`, `desktop`).
3. New behaviour has tests at the lowest sensible level: pure logic → unit, component wiring → TestBed, user flow → Playwright.
4. `CHANGELOG.md` is updated (Keep a Changelog style). Architectural decisions get an ADR in `docs/adr/`. README tables stay true.
5. No new lint suppressions without a comment explaining why.

## 4. Repository map

```text
src/app/
  app.ts / app.config.ts / app.routes.ts   shell (router-outlet + update prompt), providers, routes
  home/                 Home page. Also the parent route of the player (child route renders over it).
  stories/              Stories player and everything around it:
    stories-player.*      the player (cube faces, timer, keyboard, share, URL sync)
    story-gestures.directive.ts   tap / hold / horizontal drag / swipe-down on one element
    story-navigation.ts   pure next/prev/find cursor helpers
    story-media.*         image (<picture>) or video poster → embed
    story-progress.ts     segmented bars (current segment painted by the player's frame loop)
    seen-stories.service.ts   localStorage seen state
    story-transition.ts   View Transitions: shared name, router hook, which group owns the name
    video-embed.ts        allow-list + youtube-nocookie rewrite
  playground/           interactive docs for the library (route /playground, lazy)
  data/apod/            model, parse/validate (shared with Node!), groups, media helpers, service,
                        testing helpers (makeEntry/makeSnapshot, fakeApodService, fixtures)
  components/           banner carousel (consumer of ui-carousel), slide, story rings, update prompt
  services/banner.service.ts   builds banner slides (intro + latest APOD + outro/playground)
  models/slide.model.ts
src/testing/dom.ts      queryRequired() for tests (no `as`/`!` needed)
projects/carousel/
  core/src/             CarouselEngine, AutoplayClock<Reason>, SwipeTracker, loop helpers. NO DEPENDENCIES.
  src/lib/              <ui-carousel> (UiCarousel), ng-template[uiCarouselSlide], [uiSwipe]
scripts/                fetch-apod.ts, optimize-images.ts (+ .test.ts), story-pages.ts, ensure-data.ts, e2e-prepare.ts
e2e/                    Playwright specs, helpers.ts, fixtures/apod.json, serve.ts (GitHub-Pages-like server)
data/apod.sample.json   dev sample (uses repo artwork from public/slides)
public/                 artwork (slides/*.svg), icons, manifest; public/data/ is GENERATED (git-ignored)
docs/adr/               docs/screens/ README images;  docs/social-preview.png
ngsw-config.json        service worker caching;  lighthouserc.json  Lighthouse gates
```

Path alias: `@cosmos-stories/carousel` and `@cosmos-stories/carousel/core` map to library **sources** through `tsconfig.json` `paths`, so the app never needs a library build.

## 5. Architecture

### 5.1 Carousel engine (library core)

`CarouselEngine` is a **deterministic state machine**. Its phases are `idle`, `animating` and `dragging`, and it has no DOM access, timers or `requestAnimationFrame`.

- **Commands:** `next`, `prev`, `goTo`, `dragStart`/`dragMove`/`dragEnd`, `play`, `pause`, `toggleAutoplay`, `setPaused(reason)`, `setCount`, `setOptions`.
- **Input from the host:** `tick(now)` for time, `settle()` when a transition ends, `resolvePending()` after paint.
- **State:** `index`, `position` (clones included), `count`, `renderedCount`, `dragOffset`, `phase`, `animate`, `playing`, `progress`, `hasPending`. Listeners get it through `subscribe`.

**Renderer contract.** This is ADR 0001; every renderer must follow it:

1. Translate by `-position` slides plus `dragOffset` px.
2. Animate only if `animate && phase !== 'dragging'`.
3. Call `settle()` on `transitionend`, and on a fallback timer in case the event never comes.
4. When `hasPending` is true, paint first, then call `resolvePending()` on the next frame.
5. Render `withClones(items, loop)`.

**Looping** uses clones at both ends plus an invisible jump in `settle()`.

**`AutoplayClock<Reason>`** has _named pause reasons_. Several can hold at once, and playback resumes only when none remain. The type is generic: the library uses `PauseReason` (`user | hover | focus | drag | hidden`), and the stories player uses `StoryPauseReason` (`user | hold | hidden | loading | caption | video | moving | dismiss`).

### 5.2 Renderers

- **`UiCarousel`** mirrors engine state into a `state` signal, maps DOM events to commands, and runs the frame loop. **Progress-only engine updates are not rendered**: the dot fill is painted directly (`#progressFill`), and the public `progress` signal is throttled to 250 ms.
- **Stories cube** (`stories-player.ts`) is a second `CarouselEngine` (`loop: false`). Each face gets `translateZ(-w/2) rotateY(90°·(i − position) + drag) translateZ(w/2)`, and only the active face ±1 is rendered. The story timer is a separate `AutoplayClock<StoryPauseReason>`. The current progress segment is painted from the frame loop.

### 5.3 App structure and routes

| Route                                    | Component              | Notes                                                                                                           |
| ---------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------- |
| `''`                                     | `Home`                 | rings, banner, header nav; hosts a child `<router-outlet>`                                                      |
| `stories/:groupId/:date` (child of `''`) | `StoriesPlayer` (lazy) | opens **over** Home; Home becomes `inert` and pauses the banner; inputs come from `withComponentInputBinding()` |
| `playground`                             | `Playground` (lazy)    |                                                                                                                 |
| `**`                                     | redirect `''`          |                                                                                                                 |

- The **URL is the player state.** The player replaces the URL on every story change (`replaceUrl`), so Back closes the player instead of stepping through stories.
- **Deep link opened directly:** Home does _not_ render the rings or banner until the player closes (`showContent`). See ADR 0004 for why this isn't "on idle".
- **View Transitions:** a ring ↔ active story morph through the shared name `story-cover`.

### 5.4 Data flow

```text
GitHub Actions (daily 06:15 UTC, pushes to master)
  scripts/fetch-apod.ts --strict
    NASA API (key from secret) → normalizeApodResponse() → optimizeImages() (AVIF/WebP 160/480/960/1600)
    fallbacks: deployed snapshot (covers stripped) → sample (never with --strict)
  → public/data/apod.json + public/data/img/*
  → ng build → 404.html copy → scripts/story-pages.ts (stories/<group>/<date>.html) → Pages
Browser
  ApodService (rxResource + HttpClient, retry ×2 with backoff) → parseSnapshot() → entries/groups signals
  BannerService.slides: [intro, ...latest APOD (5), playground outro]; intro/outro render before data
```

## 6. Invariants — do not break

These are the non-obvious rules. Each one exists because breaking it caused, or would cause, a real bug.

1. **`src/app/data/apod/apod.parse.ts` (and `apod.groups.ts`) must have no runtime imports.** `import type` only. Node scripts import them with `.ts` extensions through type stripping; a runtime import of an extensionless path breaks `data:fetch` and CI. No enums, parameter properties or namespaces in files shared with Node either (erasable syntax only; `tsconfig.scripts.json` sets `erasableSyntaxOnly`).
2. **`CarouselEngine` stays pure.** No DOM, timers or Angular in `projects/carousel/core`; after `npm run build:lib`, `grep -c @angular dist/carousel/fesm2022/cosmos-stories-carousel-core.mjs` must print 0. Time comes in through `tick(now)`, and paint timing through `hasPending`/`resolvePending()`.
3. **Resource reads:** in Angular 21/22, `resource.value()` **throws** while the resource is in an error state. Read through `hasValue()` (see `ApodService.data`).
4. **Only one element in the document may have `view-transition-name: story-cover`.** Rings use it only while the player is closed (`transitionsEnabled`) and only for `StoryTransitionService.groupId`. The player uses it only on the active face. A duplicate makes the browser abort the transition.
   **Never run a view transition on the initial navigation** (`from.firstChild === null`). While a transition runs, its pseudo-elements cover the page: `elementFromPoint` returns `<html>` and every tap or swipe is lost. A directly opened story link was unusable for ~0.4 s until this was fixed in v1.0.1.
5. **Don't bind per-frame values to the template.** Progress bars are painted in the frame loop. Adding a signal that changes every frame reintroduces 60 change-detection passes per second (this cost ~2 s of script time under throttling).
6. **`StoryGesturesDirective` ignores gestures that start on `button`, `a` or `iframe`,** and the player stage has `touch-action: none`. The banner uses `[uiSwipe]` with `pan-y`. Don't mix the two on one element.
7. **Hold (220 ms) vs tap** is timing-based. Don't add work to `pointerdown` handlers.
8. **Keep `apod.json` validation symmetric.** A new field in `ApodEntry` must be produced by `normalizeApodItem` (script side) _and_ accepted by `parseSnapshot` (browser side), then added to the fixtures, `makeEntry`, `data/apod.sample.json` and `e2e/fixtures/apod.json`. Snapshot validation drops bad entries or fields; it doesn't fail the page.
9. **Images:** media URLs must be absolute `https:` or safe relative paths (`isSafeMediaUrl`). The fallback snapshot's `cover` must be stripped, because its files are not in the new build.
10. **No API key in code or logs.** `fetch-apod.ts` redacts it. The key only ever comes from `NASA_API_KEY` (a GitHub secret or `.env`).
11. **Base href.** Assets are referenced relatively (`slides/…`, `data/…`, `favicon.svg`), never `/…`, because production lives under `/cosmos-stories/`.
12. **Accessibility is a gate, not a nice-to-have.** Inactive slides get `inert` and clones get `aria-hidden`, interactive elements need visible `:focus-visible`, touch targets are ≥ 24 px, and `aria-live` is quiet during autoplay. E2E axe checks and Lighthouse (a11y = 100) fail CI otherwise.
13. **Visually hidden text needs a positioned ancestor** inside scrollers. A stray `.visually-hidden` once widened the mobile layout viewport (see `.ring { position: relative }`). Keep hidden spans adjacent, without whitespace, when they complete an accessible name.

## 7. Conventions

- **Angular style:** standalone components, `inject()` rather than constructor DI, `input()`/`output()`/`viewChild()`, signals and `computed`, `effect` only for side effects (with `untracked` for writes), new control flow (`@if`/`@for`/`@switch`). **No explicit `changeDetection: OnPush`** (the v22 default). Host listeners go in the `host: {}` metadata.
- **Selectors:** `app-` / `app*` in the app, `ui-` / `ui*` in the library (enforced by ESLint).
- **Class names:** Angular v20+ style, without the `Component` suffix for new code (`StoriesPlayer`, `Playground`). Older files (`CarouselComponent`, `SlideComponent`) keep theirs.
- **TypeScript:** `import type` for types (lint-enforced), `readonly` everywhere by default. No `any`, no `as` casts and no `!` non-null assertions (lint-enforced in the strict preset); in tests use `queryRequired()` or type guards. The app tsconfig has `noPropertyAccessFromIndexSignature`, so use `record['key']`; script and e2e configs don't, and there ESLint prefers `record.key`.
- **Comments explain _why_,** not what. Public APIs get TSDoc.
- **CSS:** SCSS, BEM-ish class names (`block__element--modifier`), design tokens as CSS custom properties in `src/styles.scss`, and always a `prefers-reduced-motion` fallback. Component styles have a 6 kB warning budget.
- **Docs language:** English (British spelling: "optimised", "colour"). User-facing strings are English.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `perf:`, `docs:`, `test:`, `chore:`), one logical change each.

## 8. Testing guide

### Unit (Vitest through `ng test`)

- Pure logic (engine, clock, tracker, navigation, parse, groups, media) is tested with plain inputs. No TestBed.
- Components use TestBed with **fake timers** (`vi.useFakeTimers()`). Fake timers also fake `requestAnimationFrame` and `performance.now()`. Advance with `await vi.advanceTimersByTimeAsync(ms)`, then `fixture.detectChanges()`.
- Routing: `RouterTestingHarness` with `provideRouter(routes, withComponentInputBinding())`. See `stories-player.spec.ts` (`open()`, `settle()`, `loadImages()`, since jsdom never fires `load`).
- Data: `makeEntry()`, `makeSnapshot()`, `fakeApodService(entries)`, and `RAW_ITEMS` for API-shaped input.
- jsdom has no `matchMedia`, `img.decode`, `ResizeObserver` or `inert`, and `document.hidden` must be stubbed. Code guards for these; tests use attributes (`[attr.inert]`).
- A navigation that outlives a test causes NG0205 (injector destroyed), which fails Vitest even when every assertion passed. Give RouterLink clicks a stub route and `await fixture.whenStable()`.

### Scripts (`node:test`)

`scripts/*.test.ts` run with plain `node --test`. Inject I/O (for example `fetchImage`) instead of hitting the network.

### End-to-end (Playwright)

- Projects: `mobile` (Pixel 7, touch) and `desktop` (1440×900). Use `test.skip(({ isMobile }) => …)` for input-specific flows.
- The build is special: `npm run e2e:build` uses base href `/cosmos-stories/`, copies `e2e/fixtures/apod.json` into `dist/.../data/apod.json`, and writes story pages. `e2e/serve.ts` refuses to start on a wrong or missing build and prints how to fix it.
- **Deterministic data:** `useFixtureData(page)`. The fixture groups are `latest` [22…17], `solar-system` [22, 18], `galaxies` [21, 17], `nebulae` [20] and `earth-sky` [19].
- **Readiness before acting:** `expectStory(page, group, title)` also waits for the image to load and for the cube faces to stop animating. Skipping it causes flaky tap-vs-hold results.
- **Gestures are dispatched as touch `PointerEvent`s** (`pointerDown`, `pointerUp`, `swipe()` in `helpers.ts`), not raw CDP touch events. How Chrome converts held or moving synthetic touches (long-press, fling) differs across versions and OSes, and made tests pass on Linux but fail on Windows. The real touch → pointer path is still covered by `touchscreen.tap()` in the tap-zone test.
- `expectStory()` also waits until no view transition is running. Its pseudo-elements swallow input.
- Accessibility specs run with `reducedMotion: 'reduce'`, so nothing is mid-animation during the audit.
- `workers: 2`, `expect.timeout: 10s`: gesture timing needs a responsive browser.
- A sandbox without Playwright's own browser can set `PW_CHROMIUM_EXECUTABLE=/path/to/chrome`.

### Lighthouse

`npx lhci autorun` runs 3 times per URL on home and a story page. Gates: accessibility, best practices and SEO = 100, CLS ≤ 0.02, performance an error < 85 and a warning < 95. Reports go to `lighthouse-report/`.

## 9. Recipes

**Add a carousel option**

1. Add it to the engine options, or to the adapter if it's render-only.
2. Add a `UiCarousel` input and wire it into the `setOptions` effect or the template.
3. Test it in the engine spec and the `carousel.spec.ts` host.
4. Add a control to the playground and a line to `code()`.
5. Update the library README table.

**Add a story topic group.** Edit `TOPICS` in `apod.groups.ts` (order = priority; the first match wins, title before explanation), extend `apod.groups.spec.ts`, and check the e2e fixture groups still match the expectations in section 8.

**Add a pause reason to the player.** Extend `StoryPauseReason` and toggle it with `clock.setPaused(reason, bool)` in exactly one place. Never clear another concern's reason.

**Add a slide theme.** Extend `SlideTheme`, add a `[data-theme]` block in `slide.scss` and tokens in `styles.scss`.

**Change the snapshot model.** Follow invariant 8, then run `npm run test:scripts`, `npm run check` and `npm run e2e`.

**Add an E2E test.** Put it in `e2e/*.spec.ts`, call `useFixtureData`, wait with `expectStory` or role-based locators, and prefer `getByRole` with `exact: true` when names overlap (for example "Playground" vs "Open the playground").

## 10. CI/CD (`.github/workflows/ci.yml`)

| Job          | Runs                                                                                                                                     | Notes                                     |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `check`      | lint, types, unit + script tests, lib build, `data:fetch --strict` (not strict on PRs), app build, 404 copy, story pages, Pages artifact |                                           |
| `e2e`        | Playwright (installs Chromium)                                                                                                           | **required for deploy**                   |
| `lighthouse` | `lhci autorun`                                                                                                                           | reports uploaded; not required for deploy |
| `deploy`     | GitHub Pages                                                                                                                             | `master` only; needs `check` + `e2e`      |

- Triggers: pushes to `master`, PRs, manual runs, and a **daily cron at 06:15 UTC** for fresh data. GitHub disables cron after 60 days without repository activity; re-enable it in the Actions tab.
- Secret: `NASA_API_KEY`. Pages source: GitHub Actions. The `github-pages` environment must allow `master`.
- Dependabot: grouped monthly PRs. Angular majors are ignored, because they're done by hand with `ng update`.

## 11. Troubleshooting

| Symptom                                                                                 | Cause / fix                                                                                                                                         |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run e2e:run` fails immediately with "Can't serve …"                                | No or wrong build. Run `npm run e2e` or `npm run e2e:build`. A plain `npm run build` has base href `/`.                                             |
| Playwright: "Executable doesn't exist"                                                  | `npm run e2e:install`                                                                                                                               |
| E2E runs against old code                                                               | `reuseExistingServer` reused a running `e2e/serve.ts`. Stop it, or rebuild with `npm run e2e`.                                                      |
| `ng` refuses to run: Node version                                                       | Use Node 24 (`nvm use`).                                                                                                                            |
| `npm install`: `Cannot read properties of null (reading 'edgesOut')`                    | npm 10 bug. Use npm 11 (`npx npm@11 install`).                                                                                                      |
| Header shows "Sample data"                                                              | No real snapshot in `public/data/`. Run `npm run data:fetch` with a key, or ignore it in development.                                               |
| View transition doesn't animate; console shows "duplicate view-transition-name"         | Invariant 4.                                                                                                                                        |
| E2E gesture test: nothing happens after a swipe or hold, `elementFromPoint` is `<html>` | A view transition was still running (invariant 4); wait with `expectStory()` or role-based expectations first.                                      |
| A test passes locally but Vitest exits 1 with NG0205                                    | A navigation outlived the test (see section 8).                                                                                                     |
| The service worker serves stale files locally                                           | The SW is only enabled in production builds. Clear site data or use `npm start`.                                                                    |
| `data:fetch` in CI: "Only N usable entries"                                             | The API returned too little. The fallback snapshot is used; if it also fails, `--strict` fails the run and the live site keeps the previous deploy. |

## 12. Docs discipline

- **CHANGELOG.md:** every user-visible or architectural change, under the next version heading.
- **ADR:** any decision with real trade-offs. Number sequentially and add it to `docs/adr/README.md` and the README table.
- **README:** keep the feature list, scores table, scripts table and "What's next" accurate. Scores are _measured_, never guessed. Update `docs/screens/*` when the UI changes noticeably.
- **Versions:** SemVer. App and library versions move together for now.

## 13. Known limitations

- Lighthouse performance on mobile is ~89–96 depending on the run. What keeps it from a stable 95+ is Angular's bootstrap; prerendering or SSR is the planned fix (README, "What's next").
- APOD videos: the length isn't known without provider player APIs, so a video pauses the story while it's open.
- Deep links to stories that dropped out of the snapshot load through `404.html` (status 404, but the app works).
- Seen state is per device (`localStorage`).

# AceDrill — Brand Guidelines (app)

How to use the AceDrill logo, colours and type in this app. The full brand kit (every logo file in every colour,
PNG exports, the presentation board and the build scripts) lives in the
[AceDrill Logo Kit Google Drive folder](https://drive.google.com/drive/folders/1aqFTVvzjPwE9ck_rpb67kFXhF7G-YJSu).

## 1. The logo

**Idea:** a capital **A** whose crossbar is a shaded gold **answer oval**, the bubble a student fills in on a
WAEC, NECO or JAMB answer sheet. It says "the right answer, chosen": what every learner is drilling towards.

| Part | Meaning |
|---|---|
| The A | AceDrill, and the top grade |
| The gold oval | The shaded answer bubble, in place of the crossbar: the answer chosen |
| The cut around the oval | Keeps the oval reading as a separate mark, not a filled-in letter |
| The wordmark | "AceDrill" in Lexend SemiBold, outlined; Lexend was designed for reading fluency |

### Versions and where they are used

The logo is drawn inline by one React component, `BrandLogo`
(`resources/js/components/brand/BrandLogo.tsx`), so it needs no image download and works offline.
Its shapes come from `brandArtwork.ts` next to it, which is generated from the master artwork. Don't edit it by hand.

| Version | Code | Used in |
|---|---|---|
| Full logo, auto colour | `<BrandLogo />` | Landing page nav (`Welcome.tsx`), Past Questions header (`PastQuestionsIndex.tsx`), mobile app header (`AuthenticatedLayout.tsx`) |
| Full logo, white | `<BrandLogo tone="reversed" />` | Dashboard sidebar (`AuthenticatedLayout.tsx`), green brand panel on Login, Register, Forgot Password and Reset Password |
| Symbol, white | `<BrandLogo variant="symbol" tone="reversed" />` | The green tile above each auth card |
| Symbol, small cut | `<BrandLogo variant="symbol" small />` | Any mark under 32 px tall |
| Favicon | `public/images/favicon.svg`, `favicon-16x16.png`, `favicon-32x32.png`, `public/favicon.ico` | Browser tab |
| App icon | `public/images/icon-*.png`, `apple-touch-icon.png`, `maskable-512x512.png` | Home screen and PWA install |

**Auto colour** uses the `--color-brand-mark` CSS variable: Ace Green in light mode and near-white in dark mode,
so one component works on both themes. Use `tone="reversed"` on green, dark or photo backgrounds. The oval
always stays gold.

### Using it in a component

```tsx
import { BrandLogo } from '@/components/brand/BrandLogo';

<BrandLogo className="h-8 w-auto" />                        // full logo, follows the theme
<BrandLogo tone="reversed" className="h-9 w-auto" />        // white, for green or dark panels
<BrandLogo variant="symbol" className="w-8 h-8" title="" /> // the mark alone
```

Set the **height** and let the width follow (`w-auto`). The logo is announced as "AceDrill" by default. If it sits
next to visible "AceDrill" text, or inside a link that already says "AceDrill", pass `title=""` so screen readers
don't hear the name twice.

## 2. Clear space

Keep at least **one oval-height** of empty space around the logo on every side. At an `h-8` (32 px) full logo
that is about 6 px. Don't let buttons, text or edges crowd it.

## 3. Minimum size

| Version | Minimum on screen |
|---|---|
| Full logo | 96 px wide (about `h-6`) |
| Symbol | 32 px; below that use `small`, which works down to 16 px |
| Small cut | Never above 64 px |

## 4. Colour

| Name | HEX | CSS variable | Use for |
|---|---|---|---|
| Ace Green | `#183B2B` | `--color-primary` | The A and the wordmark, sidebar and brand panels, primary buttons, `theme-color`, app icon tile |
| Answer Gold | `#D99A3D` | `--color-accent` | The logo oval; small highlights such as streaks and badges. Never body text |
| Paper | `#F7F4EC` | `--color-background` | Page background in light mode |
| Ink | `#202522` | `--color-text` | Headings and body text in light mode |
| Brand mark | `#183B2B` / `#F1F5F2` | `--color-brand-mark` | The logo's A and name (light / dark mode) |

The full theme, including the dark palette and the hover, tint and status colours, is in `resources/css/app.css`.
Change colours there, not in components.

**Contrast (measured):** white on Ace Green 12.4 : 1 · Ace Green on Paper 11.2 : 1 · Answer Gold on
Ace Green 5.1 : 1 · **Answer Gold on white only 2.4 : 1**, which is why gold is never used for text on light
backgrounds.

**Approved logo and background pairs:** full colour on white or Paper · white (with the gold oval) on Ace Green,
the dark theme background or black · white on a calm area of a photo.

## 5. Typography

- **Interface and body:** Instrument Sans (`--font-sans` in `app.css`), with system-font fallbacks.
- **Code and formulas:** JetBrains Mono for monospace text; maths is typeset by KaTeX.
- **Logo lettering:** "AceDrill" in the logo is Lexend SemiBold drawn as outlines, not live text. Never type
  "AceDrill" in a font as a stand-in for the logo; use `BrandLogo`.
- **Lexend** (SIL Open Font License) may be used for marketing headings. If it is ever added to the app,
  self-host it so it works offline.

## 6. App and web icons

Everything is in `public/` and already wired up in `resources/views/app.blade.php`, `vite.config.ts`
(service worker precache and manifest), `routes/pwa.php` and `public/manifest.webmanifest`:

| File | Purpose |
|---|---|
| `images/favicon.svg` | Browser tab icon (SVG) |
| `favicon.ico`, `images/favicon-16x16.png`, `images/favicon-32x32.png` | Browser tab fallback |
| `images/apple-touch-icon.png` | iPhone / iPad home screen (180 px) |
| `images/icon-144x144.png`, `icon-192x192.png`, `icon-512x512.png` | PWA install icons |
| `images/maskable-512x512.png` | Android adaptive icon (mark inside the safe zone) |
| `images/icon-1024x1024.png` | App store and large previews |

When an icon changes, raise its `revision` in `vite.config.ts` so installed apps fetch the new one.

## 7. Don'ts

- Don't stretch, squash, rotate or skew the logo; set the height only.
- Don't recolour, move or remove the gold oval. It is the idea.
- Don't put the symbol inside a circle, badge or bordered frame (the app-icon tile is the only container).
- Don't add shadows, glows, outlines or gradients (no `drop-shadow` on the logo).
- Don't rebuild a lockup by placing the symbol next to typed text, or respace its parts.
- Don't use the full symbol below 32 px, or the small cut above 64 px.
- Don't use Answer Gold for text, or place the full-colour logo on mid-tone or busy backgrounds.
- Don't bring back the old book-and-brain icon or `BookOpen` as a stand-in logo.

## 8. Changing the logo

The master artwork and its build scripts are kept outside this repo with the brand kit (the Drive folder above).
`build_final.py` regenerates every SVG and PNG and rewrites
`resources/js/components/brand/brandArtwork.ts`. Run it there, then copy the new icons into `public/` and bump the
precache revisions.

## 9. Contact

Master files and the full kit: [AceDrill Logo Kit Google Drive folder](https://drive.google.com/drive/folders/1aqFTVvzjPwE9ck_rpb67kFXhF7G-YJSu).

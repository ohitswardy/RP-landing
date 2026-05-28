# Regis Partners — Institutional Site

Premium institutional corporate site for Regis Partners (regis.ph), built with React + TypeScript + TailwindCSS v4 + Framer Motion + React Router.

## Aesthetic direction

Editorial / FT-Weekend / Bloomberg-print, not the generic "navy + gold" finance reflex.
A serif display (Fraunces) paired with a grotesque body (Geist), warm paper neutrals against ink navy, and gold used as a hairline accent only ≤5%. Asymmetric editorial grids, ticker rails, large numerals as compositional anchors.

## Run

```
npm install
npm run dev
```

The dev server runs on `http://localhost:5173`.

## Build

```
npm run build
npm run preview
```

## Structure

```
src/
  components/    Navbar, MarketRibbon, Hero, Trust, Services, Insights,
                 WhyRegis, CorporateAccess, CTA, Footer, Reveal, PageHeader
  pages/         Home, About, Services, Insights, Login, Contact
  index.css      OKLCH design tokens + Tailwind v4 @theme
  App.tsx        Routes
  main.tsx       Mount + Router
```

## Design tokens

All colors are OKLCH and tinted toward hue 250 (no `#000` / `#fff`).
Typography pairs `Fraunces` (display, variable) and `Geist` (body) via Google Fonts.
Motion uses `cubic-bezier(0.25, 1, 0.5, 1)` (ease-out-quart) — never bounce, never elastic.

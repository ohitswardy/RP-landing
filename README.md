# Regis Partners — Monorepo

Premium institutional site for Regis Partners (regis.ph).

## Structure

```
api/    Laravel backend (PHP) — see api/README.md
web/    React + TypeScript frontend — see web/README.md
```

## Quick start

### Frontend (`web/`)

```bash
cd web
npm install
npm run dev        # http://localhost:5173
```

### Backend (`api/`)

```bash
cd api
composer create-project laravel/laravel .   # first time only
cp .env.example .env
php artisan key:generate
php artisan serve                            # http://localhost:8000
```

## Design direction

Editorial / FT-Weekend / Bloomberg-print. Fraunces (display) + Geist (body), warm paper neutrals, ink navy, amber as a hairline accent ≤5%. OKLCH color tokens, asymmetric editorial grids.

---

See each subdirectory for its own README and setup instructions.

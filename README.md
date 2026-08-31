# streaming-news-backend

Service Node.js (Express + TypeScript) qui synchronise quotidiennement les films et séries Netflix / Prime Video depuis TMDB vers MongoDB Atlas, et les expose à l'application Angular `streaming-news` via une API REST.

## Démarrage

```bash
cp .env.example .env
# renseigner MONGODB_URI et TMDB_ACCESS_TOKEN (token v4 read access, sur themoviedb.org/settings/api)
yarn install
yarn dev
```

## Scripts

- `yarn dev` — serveur en mode watch, avec le cron TMDB planifié (`SYNC_CRON_SCHEDULE`, `0 3 * * *` par défaut).
- `yarn sync:tmdb` — exécute une synchronisation TMDB unique, sans démarrer le serveur HTTP.
- `yarn build` / `yarn start` — build de production.

## API

- `GET /api/titles?provider=netflix|prime_video&type=movie|tv&upcoming=true|false&sort=popularity&q=&genre=&page=1&limit=20`
- `GET /api/titles/genres`
- `GET /api/titles/:id`
- `POST /api/titles/sync` — déclenche une synchronisation TMDB manuelle. Protégé par `CRON_SECRET` (header `Authorization: Bearer <CRON_SECRET>`).
- `GET /api/cron/sync` — même synchronisation, pensé pour être appelé par un scheduler externe (Vercel Cron Jobs). Même protection par `CRON_SECRET`.
- `GET /health`

## Architecture

```
src/
  config/       env, connexion MongoDB
  core/         logger, verification CRON_SECRET
  features/
    titles/
      models/     schéma Mongoose Title
      services/   client TMDB (tmdb.service) + synchronisation (title-sync.service)
      routes/     routes Express /api/titles et /api/cron
  jobs/         planification cron interne (node-cron) + exécution ponctuelle
api/
  index.ts      point d'entrée serverless pour Vercel (enveloppe l'app Express)
```

## Déploiement sur Vercel

Le serveur Express classique (`yarn start`, avec `node-cron` interne) fonctionne pour un hébergement traditionnel (VPS, Render, Railway...). Sur Vercel, les fonctions sont serverless — un `node-cron` interne ne survivrait pas entre deux requêtes — donc le déploiement utilise deux pièces différentes :

- `api/index.ts` : enveloppe l'app Express dans une fonction serverless (toutes les routes, `/health` compris, passent par elle via le rewrite dans `vercel.json`).
- `vercel.json` : déclare un **Vercel Cron Job** qui appelle `GET /api/cron/sync` une fois par jour (`0 3 * * *`) à la place du `node-cron` interne.

Étapes :

1. Importer le dépôt `dracarys-streaming-news-backend` dans Vercel.
2. Dans **Settings → Environment Variables**, renseigner : `MONGODB_URI`, `TMDB_ACCESS_TOKEN`, `TMDB_API_BASE`, `TMDB_IMAGE_BASE`, `WATCH_REGION`, `TMDB_LANGUAGE`, `SYNC_PAGES_PER_QUERY`, `SYNC_LOOKBACK_MONTHS`, `CRON_SECRET` (la même valeur que dans votre `.env` local, ou une nouvelle générée avec `openssl rand -hex 24`), et `CORS_ORIGIN` (URL Vercel du frontend, ex. `https://dracarys-streaming-news-frontend.vercel.app`).
3. Déployer. Vercel détecte automatiquement `api/index.ts` et le cron déclaré dans `vercel.json`.
4. Après le premier déploiement, déclencher une synchro initiale manuellement (la base est vide tant que le cron n'a pas tourné une première fois) :
   ```bash
   curl -X GET "https://<votre-projet>.vercel.app/api/cron/sync" -H "Authorization: Bearer <CRON_SECRET>"
   ```

Le plan Hobby limite les cron jobs à une exécution par jour (dans l'heure indiquée, pas forcément à la minute près) — ce qui correspond exactement à notre besoin.

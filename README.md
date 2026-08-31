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

- `GET /api/titles?provider=netflix|prime_video&type=movie|tv&upcoming=true|false&page=1&limit=20`
- `GET /api/titles/:id`
- `POST /api/titles/sync` — déclenche une synchronisation TMDB manuelle.
- `GET /health`

## Architecture

```
src/
  config/       env, connexion MongoDB
  core/         logger
  features/
    titles/
      models/     schéma Mongoose Title
      services/   client TMDB (tmdb.service) + synchronisation (title-sync.service)
      routes/     routes Express /api/titles
  jobs/         planification cron + exécution ponctuelle
```

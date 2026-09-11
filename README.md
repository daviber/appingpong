# AppingPong

Specifiche di sviluppo per una piccola SPA Angular pubblicata su GitHub Pages, con API Cloudflare Worker e persistenza Cloudflare Workers KV.

> Stato specifica: verificata il 2026-09-11 rispetto alla documentazione corrente di Angular, GitHub Pages e Cloudflare Workers.

## Obiettivo

AppingPong serve a gestire **serie di partite di ping pong tra due colleghi**.

Il prodotto deve restare intenzionalmente piccolo:

- nessuna statistica;
- nessun Elo;
- nessuna prediction;
- nessuno storico delle singole partite;
- nessun backend tradizionale;
- nessun database relazionale;
- nessuna libreria UI esterna;
- nessun Maven;
- Angular + TypeScript + SCSS per il frontend;
- Cloudflare Worker TypeScript + Workers KV per l'API;
- GitHub Pages per il frontend.

La grafica, invece, deve essere molto curata: dark/neon, score centrale enorme, avatar illustrati, microanimazioni e trash-talk contestuale.

## Documenti da leggere

Per Codex, il file principale è [`AGENTS.md`](./AGENTS.md).

Le specifiche complete sono in:

- [`docs/PRODUCT_SPEC.md`](./docs/PRODUCT_SPEC.md) — comportamento, UI, modello dati e API.
- [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) — GitHub Pages, GitHub Actions, Cloudflare Worker/KV e comandi operativi.

## Architettura

```text
Browser
  |
  | HTTPS
  v
GitHub Pages
  |
  | fetch()
  v
Cloudflare Worker
  |
  | KV binding
  v
Cloudflare Workers KV
```

Il frontend **non deve mai** usare direttamente token o REST API di Cloudflare KV. L'accesso a KV passa esclusivamente dal binding del Worker.

## Repository target

```text
/
├─ AGENTS.md
├─ README.md
├─ package.json
├─ package-lock.json
├─ angular.json
├─ tsconfig*.json
├─ public/
│  ├─ runtime-config.json
│  └─ avatars/
├─ src/
│  └─ ...
├─ worker/
│  └─ src/
│     └─ index.ts
├─ wrangler.jsonc
├─ scripts/
│  └─ write-runtime-config.mjs
├─ docs/
│  ├─ PRODUCT_SPEC.md
│  └─ DEPLOYMENT.md
└─ .github/
   └─ workflows/
      ├─ deploy-pages.yml
      └─ deploy-worker.yml
```

## Branch strategy

Il branch sorgente e di release è:

```text
main
```

Il deploy GitHub Pages deve usare **GitHub Actions native**.

Non creare né mantenere manualmente un branch `gh-pages`. Non usare `angular-cli-ghpages` nel percorso principale.

Questo evita un branch generato, riduce il numero di dipendenze e segue il modello GitHub Pages corrente basato su `configure-pages`, `upload-pages-artifact` e `deploy-pages`.

## Avvio locale

Dopo lo scaffold:

```bash
npm ci
```

Terminale 1:

```bash
npm run worker:dev
```

Terminale 2:

```bash
npm start
```

Valori locali previsti:

```text
Angular: http://localhost:4200
Worker:  http://localhost:8787
```

`public/runtime-config.json` deve puntare di default al Worker locale.

## Deploy

1. Creare il namespace KV.
2. Fare un primo deploy del Worker.
3. Inserire l'URL Worker nella GitHub Repository Variable `APPINGPONG_API_URL`.
4. Configurare i secrets Cloudflare per GitHub Actions.
5. Abilitare GitHub Pages con source `GitHub Actions`.
6. Fare push su `main`.

Dettagli e workflow completi: [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md).

## Riferimenti ufficiali

- Angular deployment: https://angular.dev/tools/cli/deployment
- Angular release policy: https://angular.dev/reference/releases
- Angular version compatibility: https://angular.dev/reference/versions
- GitHub Pages custom workflows: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- Cloudflare Wrangler configuration: https://developers.cloudflare.com/workers/wrangler/configuration/
- Cloudflare Workers KV bindings: https://developers.cloudflare.com/kv/concepts/kv-bindings/
- Cloudflare Wrangler KV commands: https://developers.cloudflare.com/workers/wrangler/commands/kv/
- Cloudflare Workers TypeScript: https://developers.cloudflare.com/workers/languages/typescript/
- Wrangler GitHub Action: https://github.com/cloudflare/wrangler-action

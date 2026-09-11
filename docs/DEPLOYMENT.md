# AppingPong — Deployment & Infrastructure

> Verificato il 2026-09-11 su documentazione ufficiale corrente.

## 1. Decisioni

### Frontend

```text
Angular 22.x
Node 24
npm
GitHub Pages
```

Angular 22 è la major attiva nel periodo della specifica e supporta Node 24 nelle versioni compatibili indicate dalla documentazione Angular.

### Backend

```text
Cloudflare Worker
Wrangler 4.x
Workers KV
```

### CI/CD

```text
GitHub Actions
source branch: main
```

### Maven

Non serve.

Il progetto non contiene Java e non deve avere `pom.xml`, Maven wrapper o plugin Maven.

## 2. Perché non usare `gh-pages`

Angular documenta ancora `angular-cli-ghpages` come possibile builder di deploy, ma per questo progetto usare il deploy GitHub Pages nativo tramite Actions.

Vantaggi:

- niente branch generato;
- niente commit automatici di build artifacts;
- meno dipendenze;
- il deploy parte direttamente da `main`;
- workflow leggibile e riproducibile.

GitHub Pages deve essere configurato con:

```text
Settings
→ Pages
→ Build and deployment
→ Source
→ GitHub Actions
```

## 3. Dipendenze Node

Frontend: dipendenze create da Angular CLI 22.

Aggiungere solo:

```bash
npm install --save-dev wrangler@^4
```

Non installare:

```text
angular-cli-ghpages
gh-pages
@cloudflare/workers-types
```

Per i tipi Worker usare:

```bash
npx wrangler types
```

Cloudflare raccomanda attualmente `wrangler types` perché genera tipi coerenti con `compatibility_date`, flags e bindings configurati.

## 4. package.json

Avere almeno:

```json
{
  "scripts": {
    "start": "ng serve",
    "build": "ng build",
    "build:prod": "ng build --configuration production",
    "worker:dev": "wrangler dev",
    "worker:deploy": "wrangler deploy",
    "worker:types": "wrangler types"
  }
}
```

Node:

```json
{
  "engines": {
    "node": ">=24.15.0 <25"
  }
}
```

Se si preferisce non irrigidire la patch locale, è accettabile `"node": "24.x"` purché la CI usi una release Node 24 compatibile con Angular 22.

## 5. Cloudflare Worker config

Usare `wrangler.jsonc`, formato raccomandato da Cloudflare per progetti nuovi.

Target:

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "appingpong-api",
  "main": "worker/src/index.ts",
  "compatibility_date": "2026-09-11",

  "vars": {
    "ALLOWED_ORIGIN": "https://<GITHUB_OWNER>.github.io"
  },

  "kv_namespaces": [
    {
      "binding": "APPINGPONG_KV",
      "id": "<KV_NAMESPACE_ID>"
    }
  ]
}
```

Se il repository è il site repository speciale:

```text
<GITHUB_OWNER>.github.io
```

l'origin è comunque:

```text
https://<GITHUB_OWNER>.github.io
```

Se è Project Pages:

```text
https://<GITHUB_OWNER>.github.io/<REPO>/
```

l'HTTP `Origin` resta:

```text
https://<GITHUB_OWNER>.github.io
```

quindi non inserire il path in `ALLOWED_ORIGIN`.

## 6. Creazione Cloudflare KV

Login locale:

```bash
npx wrangler login
```

Creare il namespace:

```bash
npx wrangler kv namespace create APPINGPONG_KV \
  --binding APPINGPONG_KV \
  --update-config
```

Wrangler corrente supporta il comando:

```text
wrangler kv namespace create
```

Se `--update-config` aggiorna `wrangler.jsonc`, verificare che il binding finale sia:

```text
APPINGPONG_KV
```

e che il namespace id sia valorizzato.

Non committare API token.

### Sviluppo locale KV

```bash
npm run worker:dev
```

Per default Wrangler usa una versione locale del binding KV, evitando di scrivere in produzione.

Questo è il comportamento desiderato.

## 7. Worker skeleton

`worker/src/index.ts` deve seguire il pattern module Worker:

```ts
export default {
  async fetch(request, env): Promise<Response> {
    // routing minimale
  },
} satisfies ExportedHandler<Env>;
```

Dopo aver configurato KV:

```bash
npm run worker:types
```

Il comando deve generare i tipi `Env`, incluso:

```ts
APPINGPONG_KV: KVNamespace
```

Non scrivere manualmente tipi Cloudflare se `wrangler types` può generarli.

## 8. CORS Worker

Header base:

```ts
function corsHeaders(origin: string): HeadersInit {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}
```

Accettare:

```text
http://localhost:4200
env.ALLOWED_ORIGIN
```

Per origin non ammesso non restituire un wildcard `*`.

### Nota sicurezza

CORS protegge dal normale accesso browser cross-origin, ma **non è autenticazione** e non impedisce chiamate dirette via curl/script.

Per il MVP non aggiungere credenziali nel frontend: qualunque secret inserito nella SPA sarebbe pubblico.

Se in futuro è necessaria autenticazione reale, valutare Cloudflare Access davanti al Worker come requisito separato.

## 9. Runtime config Angular

Committare:

```text
public/runtime-config.json
```

con:

```json
{
  "apiBaseUrl": "http://localhost:8787"
}
```

Creare:

```text
scripts/write-runtime-config.mjs
```

con comportamento:

1. leggere `process.env.APPINGPONG_API_URL`;
2. fallire con exit code != 0 se mancante;
3. validare che inizi con `https://` in CI;
4. scrivere `public/runtime-config.json`.

Esempio:

```js
import { writeFile } from 'node:fs/promises';

const apiBaseUrl = process.env.APPINGPONG_API_URL?.trim();

if (!apiBaseUrl) {
  throw new Error('APPINGPONG_API_URL is required');
}

if (!apiBaseUrl.startsWith('https://')) {
  throw new Error('APPINGPONG_API_URL must use https://');
}

await writeFile(
  'public/runtime-config.json',
  JSON.stringify({ apiBaseUrl }, null, 2) + '\n',
  'utf8',
);
```

In locale non eseguire questo script: usare il file committato con localhost.

## 10. Primo deploy Worker

Dopo aver creato KV:

```bash
npm run worker:types
npm run worker:deploy
```

Wrangler stampa l'URL, tipicamente simile a:

```text
https://appingpong-api.<account-subdomain>.workers.dev
```

Non inventare l'URL: usare quello effettivamente restituito da Cloudflare.

Test:

```bash
curl https://<WORKER_URL>/api/health
```

Risposta:

```json
{"ok":true}
```

## 11. GitHub repository configuration

### Variable

GitHub:

```text
Settings
→ Secrets and variables
→ Actions
→ Variables
```

Creare:

```text
APPINGPONG_API_URL
```

Valore:

```text
https://<actual-worker-url>
```

Questa non è una credenziale.

### Secrets

Creare:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

Il token CI deve avere permessi sufficienti a deployare Workers.

Usare un Cloudflare API Token, non la Global API Key.

Cloudflare documenta il preset/permesso per editare Workers per i deploy CI.

## 12. GitHub Pages workflow

Creare:

```text
.github/workflows/deploy-pages.yml
```

Contenuto target:

```yaml
name: Deploy GitHub Pages

on:
  push:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v6

      - name: Setup Node
        uses: actions/setup-node@v6
        with:
          node-version: 24
          cache: npm

      - name: Install
        run: npm ci

      - name: Write production runtime config
        run: node scripts/write-runtime-config.mjs
        env:
          APPINGPONG_API_URL: ${{ vars.APPINGPONG_API_URL }}

      - name: Compute GitHub Pages base href
        id: base
        shell: bash
        run: |
          REPO_NAME="${GITHUB_REPOSITORY#*/}"
          OWNER="${GITHUB_REPOSITORY%/*}"

          if [[ "$REPO_NAME" == "$OWNER.github.io" ]]; then
            BASE_HREF="/"
          else
            BASE_HREF="/$REPO_NAME/"
          fi

          echo "base_href=$BASE_HREF" >> "$GITHUB_OUTPUT"

      - name: Build Angular
        run: >
          npx ng build
          --configuration production
          --base-href "${{ steps.base.outputs.base_href }}"

      - name: Configure Pages
        uses: actions/configure-pages@v5

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v4
        with:
          path: dist/appingpong/browser

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}

    runs-on: ubuntu-latest
    needs: build

    steps:
      - name: Deploy Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

### Output path Angular

Con l'application builder moderno di Angular, il browser bundle è normalmente sotto:

```text
dist/<project-name>/browser
```

Per il progetto nominato `appingpong` usare:

```text
dist/appingpong/browser
```

Se `angular.json` usa un nome diverso, Codex deve aggiornare il workflow con il path reale; non duplicare artefatti.

## 13. Perché calcolare `base-href`

GitHub Project Pages pubblica sotto:

```text
/<repository>/
```

Esempio:

```text
https://mario.github.io/appingpong/
```

Angular deve quindi generare URL relativi alla base corretta.

Il workflow calcola automaticamente:

```text
/             per owner.github.io
/repo-name/   per Project Pages
```

Non hardcodare il nome repository.

## 14. GitHub Worker workflow

Creare:

```text
.github/workflows/deploy-worker.yml
```

Contenuto target:

```yaml
name: Deploy Cloudflare Worker

on:
  push:
    branches:
      - main
    paths:
      - "worker/**"
      - "wrangler.jsonc"
      - "package.json"
      - "package-lock.json"
      - ".github/workflows/deploy-worker.yml"
  workflow_dispatch:

permissions:
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v6

      - name: Setup Node
        uses: actions/setup-node@v6
        with:
          node-version: 24
          cache: npm

      - name: Install
        run: npm ci

      - name: Generate Worker types
        run: npm run worker:types

      - name: Deploy Worker
        uses: cloudflare/wrangler-action@v4
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy
```

Al 2026-09-11 il repository ufficiale `cloudflare/wrangler-action` espone la major `v4` e usa Wrangler 4 per default.

## 15. Ordine di setup iniziale consigliato

### Step A — repository

Assicurarsi che:

```text
default branch = main
```

### Step B — npm

```bash
npm install
npm install --save-dev wrangler@^4
```

### Step C — Cloudflare

```bash
npx wrangler login
npx wrangler kv namespace create APPINGPONG_KV \
  --binding APPINGPONG_KV \
  --update-config

npm run worker:types
npm run worker:deploy
```

### Step D — configurare GitHub

Impostare:

```text
Repository Variable:
APPINGPONG_API_URL

Repository Secrets:
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

### Step E — Pages

Impostare:

```text
Settings → Pages → Source → GitHub Actions
```

### Step F — push

```bash
git add .
git commit -m "Initial AppingPong implementation"
git push origin main
```

Il push su `main`:

- pubblica GitHub Pages;
- pubblica Worker solo quando cambiano file Worker/config/package.

## 16. Deploy manuali

Frontend:

```bash
npm run build:prod
```

Il deploy Pages manuale via branch non è previsto.

Worker:

```bash
npm run worker:deploy
```

## 17. Dry run Worker

Prima del merge/push:

```bash
npx wrangler deploy --dry-run --outdir .wrangler-dry-run
```

La directory:

```text
.wrangler-dry-run/
```

deve stare in `.gitignore`.

## 18. `.gitignore`

Assicurarsi di includere almeno:

```gitignore
node_modules/
dist/
.angular/
.wrangler/
.wrangler-dry-run/
.dev.vars
.env
.env.*
```

Non ignorare:

```text
wrangler.jsonc
public/runtime-config.json
```

Il file runtime config committato contiene solo localhost.

## 19. Secret policy

Mai nel repository:

```text
Cloudflare API token
Global API key
account credentials
```

L'ID del namespace KV nel `wrangler.jsonc` non è un secret applicativo; Cloudflare documenta gli ID namespace come identificatori associati all'account, non credenziali.

Non mettere token nel frontend.

## 20. Backup dati

Per il requisito attuale non creare feature UI di backup.

Poiché tutto è in una sola key, un backup occasionale può essere fatto da CLI/dashboard separatamente.

Non aggiungere cron, R2 o altri servizi.

## 21. Limiti KV rilevanti

L'uso previsto è molto ridotto.

Considerazioni architetturali:

- KV è ottimo per accessi read-heavy e storage semplice;
- local development usa storage simulato per default;
- KV è eventualmente consistente;
- non progettare logiche che richiedono transazioni forti;
- non fare polling frequente.

Il frontend deve aggiornarsi dalla risposta della mutazione e non affidarsi a un GET immediato per confermare la scrittura.

## 22. Route e GitHub Pages

Il MVP è una singola dashboard e non deve usare Angular Router.

Questo elimina il problema del fallback `index.html` sulle deep link di GitHub Pages.

Se in futuro viene introdotto routing, preferire hash routing oppure aggiungere una strategia esplicita compatibile con Pages.

Non aggiungerlo ora.

## 23. Checklist CI

### Pages

- [ ] push su `main`;
- [ ] `npm ci`;
- [ ] runtime config generato da `APPINGPONG_API_URL`;
- [ ] base href calcolato;
- [ ] Angular build riuscita;
- [ ] artifact da `dist/appingpong/browser`;
- [ ] deploy Pages riuscito.

### Worker

- [ ] secrets presenti;
- [ ] KV namespace id valido;
- [ ] `wrangler types` riuscito;
- [ ] deploy Worker riuscito;
- [ ] `/api/health` risponde.

## 24. Riferimenti ufficiali

Angular:

- https://angular.dev/reference/releases
- https://angular.dev/reference/versions
- https://angular.dev/tools/cli/deployment
- https://angular.dev/tools/cli/build-system-migration

GitHub:

- https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- https://docs.github.com/en/get-started/start-your-journey/deploying-your-website-automatically

Cloudflare:

- https://developers.cloudflare.com/workers/wrangler/configuration/
- https://developers.cloudflare.com/workers/wrangler/install-and-update/
- https://developers.cloudflare.com/workers/wrangler/commands/kv/
- https://developers.cloudflare.com/kv/concepts/kv-bindings/
- https://developers.cloudflare.com/workers/languages/typescript/
- https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/
- https://github.com/cloudflare/wrangler-action

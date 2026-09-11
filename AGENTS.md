# AGENTS.md — AppingPong

Questo file è l'entry point per Codex.

Implementare l'intero progetto rispettando queste specifiche. Prima di modificare il repository, leggere anche:

- `docs/PRODUCT_SPEC.md`
- `docs/DEPLOYMENT.md`

## 1. Obiettivo

Creare **AppingPong**, una SPA molto piccola per gestire serie di ping pong tra due giocatori.

La priorità è:

1. codice semplice;
2. dati minimi;
3. deploy completamente statico per il frontend;
4. UI estremamente curata e moderna;
5. zero funzionalità non richieste.

Non trasformare il progetto in una piattaforma di statistiche.

## 2. Funzionalità obbligatorie

La UI deve permettere di:

- recuperare le serie salvate;
- creare una nuova serie;
- scegliere nome Giocatore 1;
- scegliere nome Giocatore 2;
- scegliere quante vittorie servono per vincere la serie;
- offrire preset `30` e `50`;
- consentire comunque un valore custom;
- incrementare il punteggio di ciascun giocatore;
- correggere il punteggio;
- aggiornare nomi e `targetWins`;
- eliminare una serie;
- mostrare chiaramente le serie concluse;
- mostrare trash-talk contestuale durante la serie;
- funzionare bene desktop e mobile.

## 3. Funzionalità esplicitamente escluse

NON implementare:

- statistiche aggregate;
- win rate;
- grafici;
- classifiche;
- Elo;
- prediction;
- account utente;
- login custom;
- chat;
- storico delle singole partite;
- salvataggio delle frasi mostrate nel backend;
- NgRx;
- backend Node persistente;
- database SQL;
- Firebase;
- Maven;
- librerie UI complete come Material, PrimeNG, Bootstrap o simili.

Se una funzionalità non è descritta nelle specifiche, privilegiare la soluzione più piccola.

## 4. Stack obbligatorio

Frontend:

- Angular **22.x**;
- standalone components;
- TypeScript;
- Angular Signals per stato locale;
- `HttpClient`;
- SCSS;
- nessuna libreria UI esterna.

Runtime/build:

- Node.js **24**;
- npm;
- Angular CLI coerente con Angular 22.

Backend serverless:

- Cloudflare Worker in TypeScript;
- Wrangler **4.x**;
- Cloudflare Workers KV;
- nessun framework HTTP aggiuntivo.

Deploy:

- frontend su GitHub Pages;
- Worker su Cloudflare Workers;
- GitHub Actions;
- source branch: `main`;
- GitHub Pages source: `GitHub Actions`;
- NON usare un branch `gh-pages` nel percorso principale.

## 5. Bootstrap del repository

Se il repository è vuoto, inizializzare Angular nella root.

Comando di riferimento:

```bash
npx -p @angular/cli@22 ng new appingpong \
  --directory . \
  --standalone \
  --routing=false \
  --style=scss \
  --ssr=false \
  --package-manager=npm \
  --skip-git
```

Se il repository contiene già un'app Angular valida, adattarla senza ricrearla.

Installare Wrangler localmente:

```bash
npm install --save-dev wrangler@^4
```

Non installare `@cloudflare/workers-types`: usare `wrangler types`, come raccomandato dalla documentazione Cloudflare corrente.

## 6. Struttura applicativa desiderata

Preferire una struttura piccola:

```text
src/app/
├─ app.component.ts
├─ app.component.html
├─ app.component.scss
├─ core/
│  ├─ api/
│  │  └─ series-api.service.ts
│  ├─ config/
│  │  └─ runtime-config.service.ts
│  └─ models/
│     └─ series.model.ts
├─ features/
│  └─ dashboard/
│     ├─ dashboard.component.ts
│     ├─ dashboard.component.html
│     └─ dashboard.component.scss
├─ shared/
│  ├─ avatar/
│  ├─ series-card/
│  └─ score-control/
└─ trash-talk/
   ├─ trash-talk.engine.ts
   ├─ trash-talk.phrases.ts
   └─ trash-talk.types.ts
```

Evitare componentizzazione eccessiva. Creare un componente solo quando migliora davvero leggibilità o riuso.

Worker:

```text
worker/src/index.ts
```

Configurazione:

```text
wrangler.jsonc
```

## 7. Modello dati: mantenere minimo

Usare questo modello concettuale:

```ts
export interface PingPongSeries {
  id: string;
  player1Name: string;
  player2Name: string;
  targetWins: number;
  player1Wins: number;
  player2Wins: number;
  createdAt: string;
  updatedAt: string;
}
```

NON aggiungere:

- `status`;
- `winner`;
- array di match;
- statistiche;
- rating;
- prediction;
- phrase history.

`status` e `winner` devono essere derivati.

Esempio:

```ts
export const isCompleted = (series: PingPongSeries): boolean =>
  series.player1Wins >= series.targetWins ||
  series.player2Wins >= series.targetWins;
```

## 8. Persistenza KV: una sola chiave

Per mantenere il progetto minimo usare una singola chiave:

```text
appingpong:series:v1
```

Il valore è:

```ts
PingPongSeries[]
```

Non introdurre un indice secondario.

Sono accettate le limitazioni di concorrenza/eventual consistency di Workers KV perché l'app è per due colleghi e gli aggiornamenti sono poco frequenti.

Dopo una mutazione, il Worker deve restituire il nuovo dato e il frontend deve aggiornare immediatamente lo stato locale senza eseguire un GET inutile.

## 9. API Worker

Base API:

```text
/api
```

Endpoint:

```text
GET    /api/series
POST   /api/series
PATCH  /api/series/:id
DELETE /api/series/:id
GET    /api/health
OPTIONS *
```

### GET `/api/series`

Risposta:

```json
{
  "series": []
}
```

Ordinare lato Worker o frontend per `updatedAt` decrescente.

### POST `/api/series`

Body:

```json
{
  "player1Name": "Luca",
  "player2Name": "Marco",
  "targetWins": 30
}
```

Il Worker genera:

- `id` con `crypto.randomUUID()`;
- punteggi `0`;
- `createdAt`;
- `updatedAt`.

### PATCH `/api/series/:id`

Body parziale ammesso:

```json
{
  "player1Name": "Luca",
  "player2Name": "Marco",
  "targetWins": 50,
  "player1Wins": 12,
  "player2Wins": 10
}
```

Regole:

- nomi trim;
- nomi non vuoti;
- `targetWins` intero `>= 1` e `<= 200`;
- punteggi interi `>= 0`;
- punteggi `<= targetWins`;
- `targetWins` non può diventare minore del punteggio attuale;
- se una serie è conclusa, bloccare ulteriori incrementi oltre `targetWins`;
- deve restare possibile correggere il punteggio verso il basso.

### DELETE `/api/series/:id`

Risposta `204`.

### GET `/api/health`

Risposta:

```json
{
  "ok": true
}
```

## 10. CORS

L'API Worker è cross-origin rispetto a GitHub Pages.

Implementare:

- `OPTIONS`;
- `Access-Control-Allow-Origin` solo per gli origin configurati;
- `Access-Control-Allow-Methods: GET,POST,PATCH,DELETE,OPTIONS`;
- `Access-Control-Allow-Headers: Content-Type`;
- `Vary: Origin`.

Origin ammessi:

- `http://localhost:4200`;
- origin GitHub Pages configurato in `wrangler.jsonc`.

CORS non è autenticazione. Non aggiungere auth custom al MVP.

## 11. Configurazione runtime frontend

Creare:

```text
public/runtime-config.json
```

Default locale:

```json
{
  "apiBaseUrl": "http://localhost:8787"
}
```

La build GitHub Actions deve sovrascrivere questo file usando la GitHub Repository Variable:

```text
APPINGPONG_API_URL
```

Il frontend deve caricare il file con URL relativo a `document.baseURI`, per funzionare sia su:

```text
https://owner.github.io/
```

sia su:

```text
https://owner.github.io/repository/
```

Se il config non è caricabile, mostrare un errore applicativo leggibile, non fallire silenziosamente.

## 12. UI / art direction

La UI deve ricordare una scoreboard sportiva premium, non un gestionale.

Direzione:

```text
dark + glass + cyan neon + orange neon
```

Caratteristiche:

- background quasi nero;
- texture/geometria ispirata a un tavolo da ping pong realizzata con CSS;
- niente foto di persone;
- due avatar illustrati/locali;
- Giocatore 1 sempre accent cyan;
- Giocatore 2 sempre accent orange;
- score molto grande;
- card principale glassmorphism controllato;
- bordi luminosi sottili;
- ombre soft;
- microanimazioni brevi;
- molto spazio negativo;
- interfaccia leggibile anche senza animazioni.

Non usare 30/50 pallini per rappresentare il target.

Per serie lunghe mostrare:

```text
37 / 50
██████████████████░░░░░░
```

con progress bar sottile per ciascun giocatore.

## 13. Avatar

Non usare fotografie.

Creare due avatar SVG locali, leggeri e stilizzati:

```text
public/avatars/player-cyan.svg
public/avatars/player-orange.svg
```

Devono essere coerenti con la UI e non dipendere da servizi esterni.

Gli avatar sono decorativi e non fanno parte del modello KV.

## 14. Layout desktop

Indicativamente:

```text
┌───────────────────────────────────────────────────────────────┐
│ AppingPong                                      + Nuova serie │
│                                                               │
│ ┌───────────────────────────────────┐ ┌─────────────────────┐ │
│ │ SERIE IN CORSO                    │ │ SERIE SALVATE       │ │
│ │                                   │ │                     │ │
│ │ Avatar       37 : 29      Avatar  │ │ Luca vs Marco      │ │
│ │ Luca                      Marco   │ │ 30 : 24  Conclusa 🗑│ │
│ │                                   │ │                     │ │
│ │ progress                  progress│ │ ...                 │ │
│ │                                   │ │                     │ │
│ │      frase contestuale            │ │                     │ │
│ │                                   │ │                     │ │
│ │   + Luca       correggi   + Marco │ │                     │ │
│ └───────────────────────────────────┘ └─────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

Le serie concluse devono mostrare:

- punteggio finale;
- badge verde `Conclusa`;
- icona cestino **accanto al badge**;
- nessun controllo di incremento.

Le serie non concluse devono mostrare uno stato `In corso`.

## 15. Mobile

Sotto circa `900px`:

- colonna singola;
- scoreboard prima;
- lista serie sotto;
- pulsanti score grandi e touch-friendly;
- modal/form nuova serie full-width;
- evitare hover come unica indicazione di stato.

## 16. Creazione serie

Form minimale:

```text
Giocatore 1  [____________]
Giocatore 2  [____________]

Partite per vincere
[ 30 ] [ 50 ] [ Custom ]

Custom: [__]

[ Crea serie ]
```

Default consigliato:

```text
30
```

Permettere valori da `1` a `200`.

## 17. Aggiornamento punteggio

Interazione primaria:

```text
[ + Luca ]              [ + Marco ]
```

Al click:

1. aggiornare ottimisticamente la UI;
2. inviare PATCH con il nuovo punteggio assoluto;
3. usare la risposta Worker come valore definitivo;
4. se la chiamata fallisce, ripristinare il valore precedente e mostrare un errore discreto.

Aggiungere una modalità `Correggi` piccola/non dominante che permetta di impostare manualmente i due punteggi.

Non salvare l'elenco dei singoli click.

## 18. Fine serie

Una serie è conclusa quando:

```ts
player1Wins === targetWins || player2Wins === targetWins
```

Non memorizzare `status`.

Quando si conclude:

- bloccare incrementi;
- mostrare badge `Conclusa`;
- mostrare frase finale;
- mantenere il cestino visibile;
- animazione celebrativa breve e sobria, solo CSS.

## 19. Trash-talk engine

Le frasi sono una parte importante del prodotto ma **non devono essere salvate in KV**.

Creare almeno **300 frasi italiane**, workplace-safe, suddivise in pool contestuali.

Niente insulti pesanti, riferimenti a caratteristiche personali, politica, religione o contenuti sessuali.

Tono:

- ironico;
- competitivo;
- leggermente provocatorio;
- simpatico;
- da rivalità tra colleghi.

Placeholder supportati:

```text
{leader}
{trailer}
{leaderScore}
{trailerScore}
{lead}
{target}
{remaining}
```

Categorie minime:

```ts
type PhraseContext =
  | 'START'
  | 'TIED'
  | 'SLIGHT_LEAD'
  | 'MEDIUM_LEAD'
  | 'BIG_LEAD'
  | 'DOMINATION'
  | 'COMEBACK'
  | 'ALMOST_TIED'
  | 'LATE_CLOSE'
  | 'ONE_AWAY'
  | 'COMPLETED_CLOSE'
  | 'COMPLETED_DOMINANT';
```

Le categorie non devono dipendere da score assoluti come `3-2`: devono usare percentuali e differenza relativa, così funzionano con target 5, 30, 50 o custom.

Linee guida indicative:

```ts
progress = maxScore / targetWins;
lead = Math.abs(player1Wins - player2Wins);
leadRatio = lead / targetWins;
```

Esempio:

```text
target 50, 24-23 -> SLIGHT_LEAD
target 50, 32-20 -> BIG_LEAD
target 50, 46-44 -> LATE_CLOSE
target 50, 49-31 -> ONE_AWAY
target 50, 50-49 -> COMPLETED_CLOSE
target 50, 50-21 -> COMPLETED_DOMINANT
```

Evitare ripetizioni:

- mantenere le ultime 12 phrase-id in `sessionStorage`;
- non scegliere una frase presente nelle ultime 12;
- se il pool è esaurito, resettare solo il tracking locale;
- non inviare phrase-id al Worker.

Esempi di tono:

```text
"{leader} è avanti, ma non abbastanza da potersela tirare."
"{trailer} sostiene che il piano stia funzionando. Il tabellone non conferma."
"Il vantaggio aumenta. Anche la quantità di spiegazioni richieste."
"Serie ancora apertissima. Le scuse, invece, sono già pronte."
"Un'altra vittoria e {leader} potrà diventare insopportabile ufficialmente."
```

## 20. Stato locale Angular

Usare Signals.

Esempio concettuale:

```ts
readonly series = signal<PingPongSeries[]>([]);
readonly selectedSeriesId = signal<string | null>(null);

readonly selectedSeries = computed(() => ...);
readonly completed = computed(() => ...);
```

Non introdurre store esterni.

## 21. Error handling

Gestire almeno:

- Worker irraggiungibile;
- runtime config mancante;
- risposta API non valida;
- create fallita;
- update fallito;
- delete fallita.

Usare toast/banner custom molto semplice. Nessuna libreria di notifiche.

## 22. Accessibilità

Minimo obbligatorio:

- `button` reali;
- focus visibile;
- contrasto sufficiente;
- `aria-label` sulle icone cestino/modifica;
- `prefers-reduced-motion`;
- nessuna informazione comunicata solo col colore.

## 23. Package scripts target

Aggiungere script equivalenti a:

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

Non aggiungere Maven.

## 24. GitHub Actions

Creare esattamente:

```text
.github/workflows/deploy-pages.yml
.github/workflows/deploy-worker.yml
```

Seguire `docs/DEPLOYMENT.md`.

Il source branch è `main`.

Non creare un workflow che committa build artifacts su `main`.

Non creare un branch `gh-pages` se non richiesto esplicitamente in seguito.

## 25. Test minimi

Aggiungere unit test per:

- `isCompleted`;
- validazione score;
- classificazione phrase context;
- no repeat delle phrase recenti;
- mapping API base URL;
- almeno una mutazione Worker o funzione pura equivalente se l'handler viene scomposto.

Non serve E2E framework aggiuntivo.

## 26. Definition of Done

Prima di considerare terminato il lavoro:

```bash
npm ci
npm run build:prod
npm run worker:types
npx wrangler deploy --dry-run --outdir .wrangler-dry-run
```

Eseguire anche i test disponibili.

Verificare manualmente:

- create serie 30;
- create serie 50;
- create serie custom;
- incremento player 1;
- incremento player 2;
- correzione punteggio;
- serie che arriva al target;
- badge `Conclusa`;
- cestino accanto a `Conclusa`;
- delete;
- refresh e recupero dati;
- nessuna statistica nella UI;
- nessun Elo/prediction;
- nessuna foto;
- build GitHub Pages con base href repository-aware;
- nessun secret Cloudflare incluso nel bundle Angular.

## 27. Regola finale

Quando esiste una scelta tra una soluzione più sofisticata e una più piccola che soddisfa le specifiche, scegliere quella più piccola.

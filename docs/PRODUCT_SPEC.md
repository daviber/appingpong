# AppingPong — Product & Technical Specification

## 1. Visione

AppingPong è una scoreboard moderna per una rivalità interna di ping pong.

Non deve sembrare un CRUD.

Deve sembrare un piccolo prodotto sportivo premium:

- score immediatamente leggibile;
- due identità visive contrapposte;
- forte personalità grafica;
- trash-talk contestuale;
- operazioni semplicissime.

L'applicazione gestisce **serie lunghe**, tipicamente a 30 o 50 vittorie, ma il target deve essere configurabile.

## 2. Dominio

Una "serie" è un confronto tra due giocatori che termina quando uno dei due raggiunge `targetWins`.

Non vengono salvate le singole partite.

Viene salvato solo il punteggio aggregato.

### Modello persistito

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

### Campi derivati

```ts
export function isCompleted(s: PingPongSeries): boolean {
  return s.player1Wins >= s.targetWins || s.player2Wins >= s.targetWins;
}

export function winnerName(s: PingPongSeries): string | null {
  if (!isCompleted(s)) return null;
  return s.player1Wins >= s.targetWins ? s.player1Name : s.player2Name;
}
```

Non persistono `status` e `winner`.

## 3. Storage

KV key:

```text
appingpong:series:v1
```

Value:

```json
[
  {
    "id": "uuid",
    "player1Name": "Luca",
    "player2Name": "Marco",
    "targetWins": 50,
    "player1Wins": 37,
    "player2Wins": 29,
    "createdAt": "2026-09-11T10:00:00.000Z",
    "updatedAt": "2026-09-11T11:00:00.000Z"
  }
]
```

### Perché una sola chiave

Il volume dati è minuscolo e l'app è usata da due persone.

Una singola chiave rende semplici:

- GET di tutte le serie;
- create;
- update;
- delete;
- backup manuale.

Trade-off accettato: Workers KV è eventualmente consistente e non offre transazioni sulla singola struttura JSON. Per questo MVP non introdurre D1, Durable Objects o altri sistemi.

## 4. API contract

Tutte le risposte JSON, eccetto `204`.

Header:

```text
Content-Type: application/json; charset=utf-8
```

### `GET /api/health`

```json
{
  "ok": true
}
```

### `GET /api/series`

```json
{
  "series": [
    {
      "id": "uuid",
      "player1Name": "Luca",
      "player2Name": "Marco",
      "targetWins": 50,
      "player1Wins": 37,
      "player2Wins": 29,
      "createdAt": "2026-09-11T10:00:00.000Z",
      "updatedAt": "2026-09-11T11:00:00.000Z"
    }
  ]
}
```

### `POST /api/series`

Request:

```json
{
  "player1Name": "Luca",
  "player2Name": "Marco",
  "targetWins": 50
}
```

Response `201`:

```json
{
  "series": {
    "id": "generated",
    "player1Name": "Luca",
    "player2Name": "Marco",
    "targetWins": 50,
    "player1Wins": 0,
    "player2Wins": 0,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

### `PATCH /api/series/:id`

Può aggiornare uno o più campi editabili.

Esempio score:

```json
{
  "player1Wins": 38
}
```

Esempio correzione:

```json
{
  "player1Wins": 37,
  "player2Wins": 28
}
```

Esempio metadati:

```json
{
  "player1Name": "Luca",
  "player2Name": "Marco",
  "targetWins": 50
}
```

Response `200`:

```json
{
  "series": {
    "...": "updated record"
  }
}
```

### `DELETE /api/series/:id`

Response:

```text
204 No Content
```

### Error format

Usare sempre:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "targetWins must be an integer between 1 and 200"
  }
}
```

Codici minimi:

```text
BAD_REQUEST
VALIDATION_ERROR
NOT_FOUND
METHOD_NOT_ALLOWED
INTERNAL_ERROR
```

Non inviare stack trace.

## 5. Regole di validazione

### Nomi

```text
trim
min length: 1
max length: 40
```

### targetWins

```text
integer
1 <= targetWins <= 200
targetWins >= max(player1Wins, player2Wins)
```

### Score

```text
integer
0 <= score <= targetWins
```

Quando una serie è conclusa:

- non incrementare oltre target;
- la correzione verso il basso resta permessa;
- se una correzione porta entrambi sotto target, la serie torna automaticamente `In corso`.

## 6. Dashboard

Una sola schermata principale.

Non serve Angular Router per il MVP.

### Header

Sinistra:

```text
[logo] AppingPong
office rivalry tracker
```

Destra:

```text
+ Nuova serie
```

### Area primaria

Se esiste una serie non conclusa selezionata:

```text
SERIE IN CORSO                   First to 50

      avatar                     avatar
       Luca          37 : 29      Marco

     37 / 50                     29 / 50
███████████████░░░           ███████████░░░░

"Marco sostiene che sia tutto sotto controllo.
 Il tabellone ha una versione diversa."

[ + Luca ]      [ Correggi ]      [ + Marco ]
```

Se non esiste una serie attiva:

```text
Nessuna serie in corso
[ Crea nuova serie ]
```

### Sidebar/lista serie

Ogni item:

Serie in corso:

```text
Luca vs Marco
37 : 29
First to 50
In corso                     🗑
```

Serie conclusa:

```text
Luca vs Marco
50 : 43
First to 50
✓ Conclusa                   🗑
```

Il cestino resta sempre disponibile, anche accanto a `Conclusa`.

Click sull'item seleziona la serie.

## 7. Ordinamento serie

Default:

1. serie non concluse, ordinate per `updatedAt` desc;
2. serie concluse, ordinate per `updatedAt` desc.

Non creare tab statistiche.

## 8. Nuova serie

Modal desktop / sheet mobile.

Campi:

```text
Giocatore 1
Giocatore 2
Partite per vincere
```

Target:

```text
[ 30 ] [ 50 ] [ Custom ]
```

`30` selezionato di default.

Quando `Custom`:

```text
[ 1 ... 200 ]
```

Button:

```text
Crea serie
```

Dopo la creazione:

- chiudere modal;
- selezionare nuova serie;
- mostrarla come `Serie in corso`.

## 9. Update serie

### Score fast path

Pulsanti principali molto grandi:

```text
+ {player1}
+ {player2}
```

Ogni click aggiunge `1`.

Se un giocatore raggiunge target, la serie diventa conclusa.

### Correzione

Un controllo secondario `Correggi` apre un mini modal:

```text
Luca   [-] [37] [+]
Marco  [-] [29] [+]

[ Salva ]
```

Permettere input numerico diretto.

### Edit metadati

Dalla serie selezionata, menu discreto `Modifica serie`:

- nome giocatore 1;
- nome giocatore 2;
- targetWins.

Non permettere target inferiore allo score corrente.

## 10. Delete

Icona cestino su ogni serie.

Click:

```text
Eliminare la serie Luca vs Marco?
Questa operazione non può essere annullata.

[ Annulla ] [ Elimina ]
```

Non usare `window.confirm` se è semplice creare un modal coerente col design.

## 11. Stato concluso

Condizione:

```ts
max(player1Wins, player2Wins) === targetWins
```

UI:

- label principale può diventare `SERIE CONCLUSA`;
- vincitore evidenziato;
- badge verde `Conclusa`;
- pulsanti `+ player` nascosti/disabilitati;
- `Correggi` resta disponibile;
- frase finale specifica;
- cestino sempre presente nella lista.

## 12. Art direction

### Palette proposta

Usare CSS custom properties; valori indicativi:

```scss
:root {
  --bg: #070b12;
  --surface: rgba(14, 24, 38, 0.72);
  --surface-strong: rgba(16, 28, 44, 0.92);
  --line: rgba(148, 180, 220, 0.18);

  --p1: #20d9ff;
  --p1-soft: rgba(32, 217, 255, 0.18);

  --p2: #ff833d;
  --p2-soft: rgba(255, 131, 61, 0.18);

  --success: #21d6a1;
  --text: #f6f8fb;
  --muted: #8d9aac;
}
```

È permesso modificare leggermente i valori per contrasto/accessibilità.

### Background

Non usare una fotografia obbligatoria.

Creare l'atmosfera con CSS:

- gradienti radiali cyan/orange;
- linee prospettiche sottili;
- linea centrale tipo tavolo/rete;
- noise leggerissimo solo se implementabile senza asset pesanti.

### Glass

Usare blur con moderazione:

```scss
backdrop-filter: blur(18px);
```

Prevedere fallback leggibile.

### Score

Desktop:

```text
clamp(4.5rem, 9vw, 9rem)
```

Deve essere l'elemento tipografico dominante.

## 13. Motion

Consentite:

- score bump dopo incremento;
- glow breve player vincitore dell'ultimo punto;
- progress bar transition;
- ingresso modal;
- fine serie con leggero confetti/particle CSS molto sobrio.

Durata tipica:

```text
140-260ms
```

Rispettare:

```css
@media (prefers-reduced-motion: reduce)
```

Non usare librerie animation.

## 14. Trash-talk: strategia

Le frasi devono cambiare con il contesto senza essere legate a punteggi specifici.

### Input engine

```ts
interface TrashTalkInput {
  player1Name: string;
  player2Name: string;
  player1Wins: number;
  player2Wins: number;
  targetWins: number;
}
```

### Output

```ts
interface TrashTalkResult {
  id: string;
  context: PhraseContext;
  text: string;
}
```

### Metriche derivate

```ts
const maxScore = Math.max(p1, p2);
const minScore = Math.min(p1, p2);
const lead = maxScore - minScore;
const progress = maxScore / target;
const leadRatio = lead / target;
const remaining = target - maxScore;
```

### Euristica suggerita

È una guida, non un requisito rigido:

```text
0-0                              -> START
p1 == p2                         -> TIED
remaining == 0 + leadRatio <= .08 -> COMPLETED_CLOSE
remaining == 0                  -> COMPLETED_DOMINANT
remaining == 1                  -> ONE_AWAY
progress >= .75 e leadRatio <= .08 -> LATE_CLOSE
leadRatio <= .04                -> SLIGHT_LEAD
leadRatio <= .10                -> MEDIUM_LEAD
leadRatio <= .20                -> BIG_LEAD
leadRatio > .20                 -> DOMINATION
```

`COMEBACK` e `ALMOST_TIED` richiedono un minimo di memoria locale della sessione.

Non aggiungere storico backend.

La dashboard può conservare in memoria:

```ts
previousLeaderId
previousLead
```

per rilevare:

```text
leader cambiato -> COMEBACK
lead ridotto sensibilmente -> ALMOST_TIED
```

Dopo refresh non è necessario ricostruire il comeback.

### Quantità

Minimo:

```text
300 frasi
```

Obiettivo:

```text
25+ frasi per ciascuna delle 12 categorie
```

### Anti-repeat

`sessionStorage`:

```text
appingpong:recent-phrases
```

Massimo 12 id.

Nessun dato phrase in KV.

## 15. Esempi frasi

START:

```text
"La dignità di entrambi è ancora intatta."
"Tabellone pulito. È il momento migliore della giornata per entrambi."
```

SLIGHT_LEAD:

```text
"{leader} è avanti, ma non abbastanza da iniziare il discorso della vittoria."
"{trailer} è ancora abbastanza vicino da rendere la situazione fastidiosa."
```

BIG_LEAD:

```text
"Il margine cresce. Anche la creatività nelle giustificazioni."
"{leader} ha preso spazio. {trailer} sostiene che fosse previsto."
```

ONE_AWAY:

```text
"Una sola vittoria separa {leader} dal diventare insopportabile."
"{trailer} ha ufficialmente terminato il margine di errore."
```

COMPLETED_CLOSE:

```text
"Finita per un soffio. Materiale da discussione per almeno una settimana."
"Il tabellone ha scelto. Le polemiche possono iniziare."
```

COMPLETED_DOMINANT:

```text
"Serie conclusa. Il risultato ha deciso di non essere diplomatico."
"Non è stata una serie equilibrata. È stata documentazione."
```

## 16. Runtime config

File locale:

```json
{
  "apiBaseUrl": "http://localhost:8787"
}
```

Caricamento consigliato:

```ts
const configUrl = new URL('runtime-config.json', document.baseURI).toString();
```

Questo è importante per GitHub Project Pages.

Non hardcodare `/runtime-config.json`, perché su:

```text
https://owner.github.io/appingpong/
```

punterebbe alla root sbagliata.

## 17. UX errori

Esempio:

```text
Impossibile aggiornare il punteggio.
Il valore precedente è stato ripristinato.
```

Non mostrare stack/errori tecnici all'utente.

Log tecnici consentiti in `console.error`.

## 18. Loading

Primo load:

- skeleton breve sulla lista;
- disabilitare mutazioni finché config/API non sono pronte.

Mutazione score:

- evitare spinner invasivo;
- optimistic UI;
- disabilitare il solo pulsante interessato durante la chiamata per impedire doppio click accidentale.

## 19. No-data state

```text
Ancora nessuna serie.

Il tabellone è troppo tranquillo.

[ Crea la prima serie ]
```

## 20. Vincoli finali

La qualità percepita deve arrivare da:

- composizione;
- tipografia;
- colori;
- micro-interazioni;
- frasi.

Non dalla quantità di feature.

import { Phrase, PhraseContext } from './trash-talk.types';

const fragments: Record<PhraseContext, [string[], string[]]> = {
  START: [
    ['Tabellone pulito.', 'Si parte da zero.', 'La sfida è appena iniziata.', 'Punteggi immacolati.', 'Prima battuta, stessa fiducia.'],
    ['Le scuse sono ancora tutte disponibili.', 'La dignità di entrambi è intatta.', 'Ogni previsione sembra credibile.', 'Nessuno può ancora fare il fenomeno.', 'Il tavolo aspetta i fatti.'],
  ],
  TIED: [
    ['Parità perfetta.', 'Nessuno molla un centimetro.', 'Il tabellone rifiuta di scegliere.', '{leaderScore} a {trailerScore}: equilibrio totale.', 'Tutto di nuovo in pari.'],
    ['La tensione sale, la produttività scende.', 'Ogni punto ora pesa doppio.', 'Le certezze tornano in bozza.', 'Serve un colpo, non una riunione.', 'Il prossimo punto decide chi parla.'],
  ],
  SLIGHT_LEAD: [
    ['{leader} è avanti di {lead}.', '{trailer} resta incollato al punteggio.', 'Vantaggio minimo per {leader}.', '{leader} mette il naso avanti.', 'Il margine è sottile.'],
    ['Troppo presto per il discorso della vittoria.', 'Basta poco per cambiare narrativa.', 'Nessuno può ancora rilassarsi.', 'Il tabellone consiglia prudenza.', 'Ogni celebrazione sarebbe prematura.'],
  ],
  MEDIUM_LEAD: [
    ['{leader} costruisce un margine.', '{trailer} inizia a rincorrere.', 'Il vantaggio di {leader} prende forma.', '{lead} punti separano i contendenti.', 'La serie si inclina verso {leader}.'],
    ['Non è fuga, ma il passo è quello.', 'Il piano di recupero serve adesso.', 'Il tabellone comincia a prendere posizione.', 'C’è ancora tempo, meno comodità.', 'La pressione ha cambiato lato.'],
  ],
  BIG_LEAD: [
    ['{leader} ha preso spazio.', 'Il margine cresce.', '{trailer} vede allontanarsi il punteggio.', '{leader} accelera senza preavviso.', 'La distanza ora è {lead}.'],
    ['Le spiegazioni diventano creative.', 'Il piano B chiede aggiornamenti.', 'Il tabellone non accetta slide correttive.', 'Serve una rimonta con priorità alta.', 'La pausa caffè non risolverà tutto.'],
  ],
  DOMINATION: [
    ['{leader} controlla la serie.', 'Il tabellone parla molto chiaro.', '{trailer} è finito in modalità recupero.', 'La distanza è diventata importante.', '{leader} detta ritmo e punteggio.'],
    ['Qui serve più di un buon proposito.', 'La rimonta richiede consegna urgente.', 'Ogni punto perso lascia una ricevuta.', 'Il margine non entra più nelle note a piè pagina.', 'La situazione ha smesso di essere diplomatica.'],
  ],
  COMEBACK: [
    ['Cambio al comando: {leader} passa avanti.', '{leader} completa il sorpasso.', 'La rimonta ha cambiato proprietario al vantaggio.', '{trailer} perde la testa della serie.', 'Il tabellone registra un ribaltone.'],
    ['Adesso le vecchie battute costano care.', 'La narrativa va aggiornata subito.', 'Nessuno aveva prenotato questo finale.', 'Le certezze hanno lasciato la stanza.', 'Il tavolo ama cambiare programma.'],
  ],
  ALMOST_TIED: [
    ['{trailer} riduce il distacco.', 'La rimonta entra nel vivo.', '{leader} sente arrivare il fiato sul collo.', 'Il margine si scioglie.', '{trailer} torna a distanza di disturbo.'],
    ['La parità ora è molto vicina.', 'Il finale torna interessante.', 'Le scuse vengono temporaneamente archiviate.', 'Chi guidava farebbe bene a guardarsi indietro.', 'Il tabellone riapre la discussione.'],
  ],
  LATE_CLOSE: [
    ['Finale stretto.', 'La serie entra nella zona calda.', '{leader} guida, {trailer} non sparisce.', 'Pochi punti, molta tensione.', 'Il traguardo è vicino per entrambi.'],
    ['Ogni errore avrà lunga memoria.', 'Ora si gioca anche contro il nervosismo.', 'Il prossimo punto vale una settimana di battute.', 'Non c’è spazio per una call di allineamento.', 'La tastiera può aspettare.'],
  ],
  ONE_AWAY: [
    ['Una sola vittoria per {leader}.', '{leader} è a un passo dal target.', 'Match point di serie per {leader}.', 'Manca un punto alla sentenza.', '{trailer} ha finito il margine di errore.'],
    ['La gloria è vicina, la modestia meno.', 'Il tabellone prepara il verdetto.', 'Adesso ogni scambio pesa tantissimo.', 'Ultima chiamata per la rimonta.', 'Il prossimo punto può chiudere tutto.'],
  ],
  COMPLETED_CLOSE: [
    ['Finita per un soffio.', '{leader} vince una serie tiratissima.', 'Il tabellone sceglie {leader} di misura.', 'Una distanza minima decide tutto.', '{leader} arriva al target appena in tempo.'],
    ['Le polemiche possono iniziare.', 'Materiale da discussione per una settimana.', '{trailer} chiederà subito la rivincita.', 'Il risultato lascia spazio a molte versioni.', 'La stretta di mano sarà attentamente monitorata.'],
  ],
  COMPLETED_DOMINANT: [
    ['Serie conclusa: {leader} domina.', 'Il risultato sceglie poca diplomazia.', '{leader} chiude con {lead} punti di margine.', 'Il tabellone consegna un verdetto netto.', '{trailer} raggiunge il target delle spiegazioni.'],
    ['Questa non era una partita, era documentazione.', 'La rivincita sembra già necessaria.', 'Il punteggio non accetta ricorsi.', 'Il tavolo ricorderà la giornata.', 'Ora serve una retrospettiva molto breve.'],
  ],
};

function buildPool(context: PhraseContext): Phrase[] {
  const [starts, ends] = fragments[context];
  return starts.flatMap((start, i) => ends.map((end, j) => ({
    id: `${context.toLowerCase()}-${i + 1}-${j + 1}`,
    text: `${start} ${end}`,
  })));
}

export const PHRASES = Object.fromEntries(
  (Object.keys(fragments) as PhraseContext[]).map(context => [context, buildPool(context)]),
) as Record<PhraseContext, Phrase[]>;

export const PHRASE_COUNT = Object.values(PHRASES).reduce((total, pool) => total + pool.length, 0);

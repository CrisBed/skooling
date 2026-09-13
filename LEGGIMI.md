# Skooling

Skooling è una web app installabile per iPad. Libri, annotazioni, quaderni e compiti restano nel browser del dispositivo e continuano a funzionare senza rete.

## Installazione su iPad

1. Pubblica l'intera cartella `Skooling` su un indirizzo HTTPS oppure servila dalla rete locale con HTTPS.
2. Apri `index.html` in Safari sull'iPad.
3. Aspetta che compaia la scritta **Pronto offline**.
4. Tocca il pulsante **Condividi** di Safari.
5. Scorri l'elenco e tocca **Aggiungi a Home**.
6. Lascia il nome **Skooling** e tocca **Aggiungi**.
7. Apri Skooling dalla nuova icona nella schermata Home.
8. Prima di usare la modalità aereo, apri una volta l'app con la rete attiva. In questo modo Safari conserva tutti i file dell'app.

Per una prova finale, chiudi completamente Skooling, attiva la modalità aereo e riaprila dalla schermata Home.

## Due modi per servire la cartella

### 1. Piccolo server sul computer nella stessa rete

Per controllare subito l'app dal computer:

```sh
cd /percorso/della/cartella/Skooling
python3 -m http.server 8080
```

Sul computer apri `http://localhost:8080`.

L'iPad può raggiungere il computer usando il suo indirizzo di rete, per esempio `http://192.168.1.20:8080`. Questo collegamento HTTP è utile per una prova dell'interfaccia, ma Safari su iPad richiede un'origine sicura HTTPS per installare e conservare il service worker. L'eccezione `localhost` vale soltanto sullo stesso dispositivo, quindi per una vera installazione offline dall'iPad il server locale deve avere HTTPS con un certificato considerato attendibile dall'iPad.

Aprire `index.html` con un doppio clic e un indirizzo che inizia con `file:` non basta: i moduli JavaScript e il service worker richiedono un server HTTP o HTTPS.

### 2. Hosting statico gratuito

Carica la cartella così com'è su un servizio di hosting statico gratuito che fornisca HTTPS. Non impostare comandi di build: la cartella pubblicata deve essere direttamente `Skooling`. GitHub Pages, Cloudflare Pages e Netlify sono esempi tecnici; il servizio scelto può richiedere un account per la sola pubblicazione. Skooling non usa quell'account e non invia al servizio libri o dati personali: il provider consegna soltanto i file statici dell'app.

## Primo utilizzo

### Aggiungere libri

1. Apri **Libreria**.
2. Tocca **Aggiungi libro**.
3. Scegli uno o più PDF dall'app File.
4. Aspetta che Skooling generi le copertine.

I PDF vengono copiati nell'archivio interno dell'app. Dopo l'importazione il file originale può essere spostato o eliminato senza togliere il libro da Skooling.

### Leggere e annotare

1. Tocca una copertina.
2. Usa le frecce o scrivi il numero della pagina.
3. Apri l'**Astuccio** con il pulsante della matita.
4. Scegli penna, evidenziatore, sottolineatura, testo o forma.
5. La Apple Pencil disegna sempre. Il dito scorre e ingrandisce; l'opzione **Disegna anche col dito** si trova in Impostazioni.
6. Attiva **Sola lettura** per scorrere senza lasciare segni.
7. Il pulsante **2 pagine** mostra due pagine affiancate, come un libro aperto. Si scrive su tutte e due e l'astuccio è lo stesso. Le pagine vanno a coppie: 1-2, 3-4, 5-6. Il pulsante **1 pagina** torna alla pagina singola.

Due dita ingrandiscono e spostano la pagina anche quando il dito disegna: appena appoggi il secondo dito il segno appena iniziato viene tolto, così non restano scarabocchi.

Con lo strumento **Testo**, tocca uno spazio libero e scrivi. Tocca una casella di testo esistente per spostarla; trascina il quadratino nell'angolo per ridimensionarla. Quando il Testo è acceso, l'astuccio mostra **Dimensione**, **Carattere** e i due pulsanti **G** (grassetto) e **C** (corsivo): valgono per la casella scelta e, se non ce n'è nessuna, per la prossima che scrivi.

La **gomma** toglie solo la parte toccata, non tutto il segno. Vale per i tratti a mano libera e anche per cerchi, quadrati, righe e frecce: la porzione sotto la gomma sparisce e il resto della figura resta al suo posto. Ogni modifica si salva automaticamente.

### Quaderni

Apri **Quaderni**, scegli **Nuovo quaderno** e indica titolo, materia e tipo di foglio: righe, quadretti, bianco, pentagramma o millimetrato. Sul foglio a pentagramma l'astuccio mostra i **Simboli musicali**, raccolti in Chiavi, Note, Pause e Altri segni: ogni segno si vede disegnato sul suo rigo, col nome sotto. Scegli il segno e tocca il rigo dove metterlo. Dentro il quaderno puoi aggiungere ed eliminare pagine. I pulsanti in alto esportano la pagina corrente in PNG o tutto il quaderno in PDF.

Nel quaderno il dito scrive sempre, senza Apple Pencil. **Due dita ingrandiscono e spostano il foglio**: appoggia due dita e allontanale per ingrandire, avvicinale per tornare alla misura naturale, muovile insieme per spostare. Il segno iniziato con un dito solo viene tolto appena arriva il secondo, quindi ingrandire non lascia mai segni per sbaglio. Il pulsante **2 pagine** apre due fogli affiancati, scrivibili tutti e due.

### Compiti

Apri **Compiti** e scegli **Nuovo compito**. Puoi collegarlo a una pagina di un libro oppure a una pagina di quaderno. Il pulsante con la freccia apre direttamente quel punto.

Metà della sezione è occupata dal **biglietto del giorno**: una battuta, un quiz lampo, una curiosità vera, una sfida, l'oroscopo della scuola o la parola del giorno. Cambia da solo ogni giorno e non si ripete per 240 giorni; quando finiscono, il giro ricomincia. Non serve rete e non c'è niente da scrivere: i 240 giorni viaggiano dentro l'app. Sul quiz si tocca una risposta e si scopre subito com'è andata.

### Album delle foto

Le foto che non appartengono a un compito stanno in **Album**, raccolte in cartelle.

1. Tocca **Aggiungi foto** e scegli o scatta le foto.
2. Skooling chiede in quale album metterle e ne propone uno nuovo col nome della data di oggi, per esempio `13-09-2026`.
3. Cambia quel nome se preferisci, per esempio `Gita a Venezia`, oppure scegli un album che c'è già.

Dentro un album le foto si chiamano 1, 2, 3 e così via. Il pulsante **⋯** su ogni foto permette di darle un nome (`Il cartellone`) o di eliminarla; lo stesso pulsante sulla copertina di un album lo rinomina o lo elimina con tutte le sue foto. Quando sei dentro un album, le foto nuove entrano lì senza altre domande.

Le foto salvate prima che esistessero gli album vengono raccolte da sole in un album per ogni giornata, col nome della data in cui erano state scattate.

## Backup e ripristino

Apri **Impostazioni** e tocca **Esporta backup**. Il file `.skooling` contiene libri, copertine, annotazioni, segnalibri, quaderni, pagine, compiti, album, foto e impostazioni.

Per ripristinarlo su un dispositivo pulito:

1. Installa e apri Skooling sul nuovo dispositivo.
2. Vai in **Impostazioni**.
3. Tocca **Importa backup**.
4. Scegli il file `.skooling` e conferma.
5. L'app ricostruisce l'archivio e si riavvia.

L'importazione sostituisce i dati già presenti. Conserva sempre una copia recente del backup fuori dall'app.

## Aggiornare l'app

L'aggiornamento arriva da solo. Chi usa Skooling non deve fare nulla: né reinstallare, né togliere e rimettere l'icona, né svuotare qualcosa.

Come funziona:

1. Chi cura l'app modifica i file e lancia `pubblica.sh`.
2. Lo script alza da solo il numero di versione in `sw.js`, per esempio da `skooling-v8` a `skooling-v9`, e pubblica tutto.
3. Alla prima apertura di Skooling con la rete attiva, l'app controlla se c'è una versione nuova.
4. Se c'è, la scarica, la mette al posto della vecchia e si ricarica da sola. Compare la scritta "Skooling si è aggiornato".
5. Se in quel momento è aperto un libro o un quaderno, l'app aspetta: la versione nuova parte alla chiusura del libro o del quaderno, così non interrompe il lavoro.

Senza rete Skooling continua a funzionare con la versione che ha già. Il controllo si ripete alla prossima apertura con la rete.

Questo vale per il **codice** dell'app, cioè le funzioni e l'aspetto. NON vale per i **contenuti**: i libri, i quaderni, le annotazioni e i compiti restano sul dispositivo e non viaggiano. Aggiungere un libro alla libreria resta un'azione da fare sul dispositivo stesso.

Se aggiungi un nuovo file necessario all'app, inseriscilo anche nell'elenco `STATIC_FILES` di `sw.js`.

Nota per chi sviluppa: sul server locale (`python3 serve.py`, indirizzo `localhost` o `127.0.0.1`) vince sempre la rete. Una modifica si vede ricaricando la pagina, senza dover ripulire a mano service worker e cache.

## Privacy e spazio

Skooling non contiene pubblicità, statistiche, tracciamento o chiamate a servizi esterni. IndexedDB conserva i dati sul dispositivo. L'app richiede a Safari la conservazione persistente e mostra un avviso quando resta poco spazio.

iPadOS mantiene comunque il controllo finale sullo spazio. Esporta regolarmente un backup, soprattutto prima di aggiornare l'iPad, cancellare i dati di Safari o rimuovere l'app dalla schermata Home.

## Compatibilità

È consigliata una versione aggiornata di iPadOS e Safari. Apple Pencil usa Pointer Events, pressione e inclinazione quando il dispositivo li rende disponibili. Mouse e trackpad possono essere usati per le prove su computer.

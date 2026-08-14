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

Con lo strumento **Testo**, tocca uno spazio libero e scrivi. Tocca una casella di testo esistente per spostarla; trascina il quadratino nell'angolo per ridimensionarla. La gomma elimina per intero il segno toccato. Ogni modifica si salva automaticamente.

### Quaderni

Apri **Quaderni**, scegli **Nuovo quaderno** e indica titolo, materia e foglio a righe o quadretti. Dentro il quaderno puoi aggiungere ed eliminare pagine. I pulsanti in alto esportano la pagina corrente in PNG o tutto il quaderno in PDF.

### Compiti

Apri **Compiti** e scegli **Nuovo compito**. Puoi collegarlo a una pagina di un libro oppure a una pagina di quaderno. Il pulsante con la freccia apre direttamente quel punto.

## Backup e ripristino

Apri **Impostazioni** e tocca **Esporta backup**. Il file `.skooling` contiene libri, copertine, annotazioni, segnalibri, quaderni, pagine, compiti e impostazioni.

Per ripristinarlo su un dispositivo pulito:

1. Installa e apri Skooling sul nuovo dispositivo.
2. Vai in **Impostazioni**.
3. Tocca **Importa backup**.
4. Scegli il file `.skooling` e conferma.
5. L'app ricostruisce l'archivio e si riavvia.

L'importazione sostituisce i dati già presenti. Conserva sempre una copia recente del backup fuori dall'app.

## Aggiornare l'app

Dopo una modifica a qualunque file statico:

1. Apri `sw.js`.
2. Cambia la prima costante, per esempio da `skooling-v5` a `skooling-v6`.
3. Pubblica di nuovo tutti i file.
4. Apri Skooling online una volta e poi riaprila. Il vecchio contenuto in cache viene eliminato automaticamente.

Se aggiungi un nuovo file necessario all'app, inseriscilo anche nell'elenco `STATIC_FILES` di `sw.js`.

## Privacy e spazio

Skooling non contiene pubblicità, statistiche, tracciamento o chiamate a servizi esterni. IndexedDB conserva i dati sul dispositivo. L'app richiede a Safari la conservazione persistente e mostra un avviso quando resta poco spazio.

iPadOS mantiene comunque il controllo finale sullo spazio. Esporta regolarmente un backup, soprattutto prima di aggiornare l'iPad, cancellare i dati di Safari o rimuovere l'app dalla schermata Home.

## Compatibilità

È consigliata una versione aggiornata di iPadOS e Safari. Apple Pencil usa Pointer Events, pressione e inclinazione quando il dispositivo li rende disponibili. Mouse e trackpad possono essere usati per le prove su computer.

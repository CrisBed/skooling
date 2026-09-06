# Giornalino del rugby, numero zero

Pagina verticale 1024x1536 pensata per la lettura sul telefono in quindici secondi. Esempio dimostrativo di un giornalino mensile di una società di rugby, con i personaggi Gabriel e Ovale.

## File

1. `GIORNALINO-RUGBY-numero-zero-1024x1536.png`: la pagina finita, nel formato richiesto.
2. `GIORNALINO-RUGBY-numero-zero-2048x3072.png`: la stessa pagina a risoluzione doppia, per la stampa o gli schermi ad alta densità.
3. `GIORNALINO-RUGBY-numero-zero.html`: la pagina in HTML e SVG, autosufficiente, con i caratteri incorporati.
4. `sorgente/`: gli script che rigenerano tutto.

## Rigenerare la pagina

Servono Node 22 e Playwright con Chromium.

```sh
cd giornalino-rugby/numero-zero/sorgente
node build.cjs
node render.cjs ../GIORNALINO-RUGBY-numero-zero-1024x1536.png 1
node render.cjs ../GIORNALINO-RUGBY-numero-zero-2048x3072.png 2
```

Lo script `render.cjs` controlla anche che nessun testo esca dal suo riquadro e stampa l'esito.

## Caratteri

Luckiest Guy, Bangers, Patrick Hand e Comic Neue, scaricati da Google Fonts con licenza SIL Open Font License. I file si trovano in `sorgente/fonts`.

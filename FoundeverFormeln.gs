/**
 * Ergaenzt Foundever in Formeln des aktiven Arbeitsblatts, sobald
 * Teleperformance und Concentrix denselben Zellbezug enthalten.
 * Fuellt leere Zellen in betroffenen Spalten bis Zeile 34 auf.
 */
function foundeverErgaenzenUndBisZeile34Fuellen() {
  const ZIELZEILE = 34;
  const blatt = SpreadsheetApp.getActiveSheet();
  const datei = blatt.getParent();

  if (!datei.getSheetByName('Foundever')) {
    throw new Error('Das Arbeitsblatt "Foundever" wurde nicht gefunden.');
  }

  const letzteSpalte = blatt.getLastColumn();
  if (letzteSpalte === 0) return;

  if (blatt.getMaxRows() < ZIELZEILE) {
    blatt.insertRowsAfter(blatt.getMaxRows(), ZIELZEILE - blatt.getMaxRows());
  }

  // Auch passende Formeln unterhalb von Zeile 34 werden erweitert.
  const formeln = blatt.getRange(1, 1, blatt.getLastRow(), letzteSpalte)
    .getFormulas();
  let geaendert = 0;

  for (let zeile = 0; zeile < formeln.length; zeile++) {
    for (let spalte = 0; spalte < letzteSpalte; spalte++) {
      const formel = formeln[zeile][spalte];
      if (!formel) continue;

      const info = foundeverPaareInFormel_(formel);
      if (!info || info.fehlendeBezuege.length === 0) continue;

      blatt.getRange(zeile + 1, spalte + 1)
        .setFormula(foundeverFormelErweitern_(formel, info.fehlendeBezuege));
      geaendert++;
    }
  }

  if (geaendert > 0) SpreadsheetApp.flush();

  // R1C1 verschiebt beim Fuellen alle relativen Zellbezuege passend.
  const zielbereich = blatt.getRange(1, 1, ZIELZEILE, letzteSpalte);
  const aktuelleFormeln = zielbereich.getFormulas();
  const r1c1Formeln = zielbereich.getFormulasR1C1();
  const werte = zielbereich.getValues();

  for (let spalte = 0; spalte < letzteSpalte; spalte++) {
    let vorlage = null;

    for (let zeile = 0; zeile < ZIELZEILE; zeile++) {
      const formel = aktuelleFormeln[zeile][spalte];
      if (formel) {
        if (foundeverPaareInFormel_(formel)) {
          vorlage = r1c1Formeln[zeile][spalte];
        }
        continue;
      }

      if (vorlage && werte[zeile][spalte] === '') {
        blatt.getRange(zeile + 1, spalte + 1).setFormulaR1C1(vorlage);
      }
    }
  }
}

/** Gleiche Zellbezuege der beiden Dienstleister suchen und Duplikate vermeiden. */
function foundeverPaareInFormel_(formel) {
  // Text in doppelten Anfuehrungszeichen ist kein echter Blattbezug.
  const ohneText = formel.replace(/"(?:[^"]|"")*"/g, '""');

  function bezuege(muster) {
    const ergebnis = [];
    let treffer;
    while ((treffer = muster.exec(ohneText)) !== null) {
      ergebnis.push(treffer[1]);
    }
    return ergebnis;
  }

  function normalisieren(bezug) {
    return bezug.replace(/\$/g, '').toUpperCase();
  }

  const teleperformance = bezuege(/(?:'Teleperformance'|Teleperformance)!\s*(\$?[A-Z]{1,3}\$?\d+)/gi);
  const concentrix = new Set(bezuege(/(?:'Concentrix'|Concentrix)!\s*(\$?[A-Z]{1,3}\$?\d+)/gi).map(normalisieren));
  const foundever = new Set(bezuege(/(?:'Foundever'|Foundever)!\s*(\$?[A-Z]{1,3}\$?\d+)/gi).map(normalisieren));
  const paare = new Set();
  const fehlendeBezuege = [];

  for (const bezug of teleperformance) {
    const zelle = normalisieren(bezug);
    if (!concentrix.has(zelle)) continue;
    paare.add(zelle);
    if (!foundever.has(zelle) && !fehlendeBezuege.some(b => normalisieren(b) === zelle)) {
      fehlendeBezuege.push(bezug);
    }
  }

  return paare.size ? { fehlendeBezuege: fehlendeBezuege } : null;
}

/** Foundever als weiteres Summenargument oder als Summand ergaenzen. */
function foundeverFormelErweitern_(formel, fehlendeBezuege) {
  const summanden = fehlendeBezuege.map(bezug => 'Foundever!' + bezug);
  const grenzen = foundeverSummenKlammern_(formel);

  if (grenzen) {
    const inhalt = formel.slice(grenzen.auf + 1, grenzen.zu);
    const trennzeichen = foundeverOberstesTrennzeichen_(inhalt);
    const zusatz = trennzeichen
      ? trennzeichen + summanden.join(trennzeichen)
      : '+' + summanden.join('+');
    return formel.slice(0, grenzen.zu) + zusatz + formel.slice(grenzen.zu);
  }

  // Andere numerische Formeln als Ganzes beibehalten und Foundever addieren.
  return '=(' + formel.trim().slice(1) + ')+' + summanden.join('+');
}

/** Nur eine SUMME/SUM-Funktion, die die ganze Formel bildet, erkennen. */
function foundeverSummenKlammern_(formel) {
  const anfang = /^\s*=\s*(?:SUMME|SUM)\s*\(/i.exec(formel);
  if (!anfang) return null;

  const auf = anfang[0].length - 1;
  let tiefe = 0;
  let inText = false;

  for (let i = auf; i < formel.length; i++) {
    const zeichen = formel[i];
    if (zeichen === '"') {
      if (inText && formel[i + 1] === '"') { i++; continue; }
      inText = !inText;
    } else if (!inText) {
      if (zeichen === '(') tiefe++;
      if (zeichen === ')' && --tiefe === 0) {
        return formel.slice(i + 1).trim() === '' ? { auf: auf, zu: i } : null;
      }
    }
  }
  return null;
}

/** Trennzeichen nur auf der aeusseren Ebene der Summenargumente suchen. */
function foundeverOberstesTrennzeichen_(inhalt) {
  let tiefe = 0;
  let inText = false;
  let kommaGefunden = false;

  for (let i = 0; i < inhalt.length; i++) {
    const zeichen = inhalt[i];
    if (zeichen === '"') {
      if (inText && inhalt[i + 1] === '"') { i++; continue; }
      inText = !inText;
    } else if (!inText) {
      if (zeichen === '(') tiefe++;
      else if (zeichen === ')') tiefe--;
      else if (tiefe === 0 && zeichen === ';') return ';';
      else if (tiefe === 0 && zeichen === ',') kommaGefunden = true;
    }
  }
  return kommaGefunden ? ',' : null;
}

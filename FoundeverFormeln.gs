/**
 * Ergaenzt Foundever in passenden SUMME-Formeln des aktiven Arbeitsblatts
 * und fuehrt die Formeln in leeren Zellen jeder betroffenen Spalte bis Zeile 34 fort.
 * Bereits belegte Zellen bleiben unveraendert. Mehrfaches Ausfuehren ist sicher.
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

  const hoehe = Math.max(blatt.getLastRow(), ZIELZEILE);
  const bereich = blatt.getRange(1, 1, hoehe, letzteSpalte);
  const formeln = bereich.getFormulas();
  const werte = bereich.getValues();

  // Gleicher Zellbezug in allen drei Blattern; Foundever darf schon vorhanden sein.
  // SUMME/SUM und Semikolon/Komma werden je nach Tabelleneinstellung akzeptiert.
  const muster = /^\s*=\s*(SUMME|SUM)\s*\(\s*(?:'Teleperformance'|Teleperformance)!\s*(\$?[A-Z]{1,3}\$?\d+)\s*([;,])\s*(?:'Concentrix'|Concentrix)!\s*\2\s*\3\s*'LKS-1st'!\s*\2\s*(?:\3\s*((?:'Foundever'|Foundever)!\s*\2)\s*)?\)\s*$/i;

  function neueFormel(funktion, trennzeichen, bezug) {
    return '=' + funktion + '(' + [
      'Teleperformance!' + bezug,
      'Concentrix!' + bezug,
      "'LKS-1st'!" + bezug,
      'Foundever!' + bezug
    ].join(trennzeichen) + ')';
  }

  for (let spalte = 0; spalte < letzteSpalte; spalte++) {
    let vorlage = null;

    for (let zeile = 0; zeile < hoehe; zeile++) {
      const treffer = formeln[zeile][spalte].match(muster);

      if (treffer) {
        const funktion = treffer[1];
        const bezug = treffer[2];
        const trennzeichen = treffer[3];

        if (!treffer[4]) {
          blatt.getRange(zeile + 1, spalte + 1)
            .setFormula(neueFormel(funktion, trennzeichen, bezug));
        }

        if (zeile + 1 <= ZIELZEILE) {
          const teile = bezug.match(/^(\$?[A-Z]{1,3})(\$?)(\d+)$/i);
          vorlage = {
            startzeile: zeile + 1,
            funktion: funktion,
            trennzeichen: trennzeichen,
            buchstaben: teile[1],
            festeZeile: teile[2],
            bezugszeile: Number(teile[3])
          };
        }
        continue;
      }

      // Nur leere Zellen unter einer passenden Formel auffuellen.
      if (zeile + 1 > ZIELZEILE || !vorlage ||
          formeln[zeile][spalte] || werte[zeile][spalte] !== '') {
        continue;
      }

      const bezugszeile = vorlage.bezugszeile +
        (vorlage.festeZeile ? 0 : zeile + 1 - vorlage.startzeile);
      const neuerBezug = vorlage.buchstaben + vorlage.festeZeile + bezugszeile;

      blatt.getRange(zeile + 1, spalte + 1)
        .setFormula(neueFormel(vorlage.funktion, vorlage.trennzeichen, neuerBezug));
    }
  }
}

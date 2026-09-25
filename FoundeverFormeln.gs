/**
 * Ergaenzt Foundever in Formeln des aktiven Arbeitsblatts, sobald
 * Teleperformance und Concentrix denselben Zellbezug enthalten.
 * Fuellt leere Zellen in betroffenen Spalten bis Zeile 34 auf.
 * Entfernt ausserdem Majorel-Summanden aus dem Blatt Foundever.
 * Ergaenzt Auswertung_FE_Skill bei passenden Skill-Formeln.
 */
function foundeverErgaenzenUndBisZeile34Fuellen() {
  const ZIELZEILE = 34;
  const blatt = SpreadsheetApp.getActiveSheet();
  const datei = blatt.getParent();

  const foundeverBlatt = datei.getSheetByName('Foundever');
  if (!foundeverBlatt) {
    throw new Error('Das Arbeitsblatt "Foundever" wurde nicht gefunden.');
  }

  const entfernt = foundeverMajorelAusBlattEntfernen_(foundeverBlatt);
  if (entfernt > 0) SpreadsheetApp.flush();
  const skillsErgaenzt = foundeverSkillFormelnErgaenzen_(datei);
  if (skillsErgaenzt > 0) SpreadsheetApp.flush();

  // Im Foundever-Blatt selbst keine Foundever-Blattbezuege hinzufuegen.
  const istFoundeverBlatt = blatt.getName() === 'Foundever';
  if (istFoundeverBlatt) return;

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

/** Skill-Formeln in allen Blaettern suchen, unabhaengig vom aktiven Blatt. */
function foundeverSkillFormelnErgaenzen_(datei) {
  const zellen = datei.createTextFinder('TP_Skill')
    .matchFormulaText(true)
    .findAll();
  let geaendert = 0;

  for (const zelle of zellen) {
    const formel = zelle.getFormula();
    if (!formel) continue;
    const neueFormel = foundeverSkillErgaenzen_(formel);
    if (neueFormel === formel) continue;
    zelle.setFormula(neueFormel);
    geaendert++;
  }
  return geaendert;
}

/** TP-Skill zusammen mit Lidl- oder WH-Skill braucht auch den FE-Skill. */
function foundeverSkillErgaenzen_(formel) {
  const ohneText = formel.replace(/"(?:[^"]|"")*"/g, '""');
  const namen = /[A-Za-z_][A-Za-z0-9_]*/g;
  const skills = new Set();
  let treffer;

  while ((treffer = namen.exec(ohneText)) !== null) {
    const name = treffer[0];
    const teile = /^(?:Auswertung_)?((?:TP|WH|Lidl|FE)_Skill(?:_(?:TP|WH|Lidl|FE)_Skill)*)$/i
      .exec(name);
    if (!teile) continue;

    // Gleichnamige Arbeitsblaetter wie 'Auswertung_TP_Skill'!A1 auslassen.
    if (/^\s*'?\s*!/.test(ohneText.slice(namen.lastIndex))) continue;
    for (const skill of teile[1].match(/(?:TP|WH|Lidl|FE)_Skill/gi)) {
      skills.add(skill.split('_')[0].toUpperCase());
    }
  }

  if (!skills.has('TP') ||
      !(skills.has('WH') || skills.has('LIDL')) ||
      skills.has('FE')) return formel;
  return formel.replace(/\s+$/, '') + '+Auswertung_FE_Skill';
}

/** Alle Majorel-Bezuege im Blatt Foundever vor dem Schreiben pruefen. */
function foundeverMajorelAusBlattEntfernen_(blatt) {
  const letzteZeile = blatt.getLastRow();
  const letzteSpalte = blatt.getLastColumn();
  if (letzteZeile === 0 || letzteSpalte === 0) return 0;

  const formeln = blatt.getRange(1, 1, letzteZeile, letzteSpalte).getFormulas();
  const aenderungen = [];
  const nichtAdditiv = [];

  for (let zeile = 0; zeile < letzteZeile; zeile++) {
    for (let spalte = 0; spalte < letzteSpalte; spalte++) {
      const formel = formeln[zeile][spalte];
      if (!formel || !foundeverHatMajorelBezug_(formel)) continue;

      const neueFormel = foundeverMajorelAusFormelEntfernen_(formel);
      if (foundeverHatMajorelBezug_(neueFormel)) {
        nichtAdditiv.push('Zeile ' + (zeile + 1) + ', Spalte ' + (spalte + 1));
      } else if (neueFormel !== formel) {
        aenderungen.push({ zeile: zeile + 1, spalte: spalte + 1, formel: neueFormel });
      }
    }
  }

  if (nichtAdditiv.length) {
    throw new Error(
      'Majorel-Bezuege in Foundever konnten nicht sicher als Summanden entfernt werden: ' +
      nichtAdditiv.slice(0, 5).join('; ')
    );
  }

  for (const eintrag of aenderungen) {
    blatt.getRange(eintrag.zeile, eintrag.spalte).setFormula(eintrag.formel);
  }
  return aenderungen.length;
}

/** Nur echte Blattbezuege erkennen, nicht Text innerhalb von Anfuehrungszeichen. */
function foundeverHatMajorelBezug_(formel) {
  const ohneText = formel.replace(/"(?:[^"]|"")*"/g, '""');
  return /(?:'Auswertung_Majorel_Skill'|Auswertung_Majorel_Skill)!\s*\$?[A-Z]{1,3}\$?\d+/i
    .test(ohneText);
}

/** Einzelne Majorel-Summanden mit beliebiger Zelladresse entfernen. */
function foundeverMajorelAusFormelEntfernen_(formel) {
  const bezug = "(?:'Auswertung_Majorel_Skill'|Auswertung_Majorel_Skill)!\\s*\\$?[A-Z]{1,3}\\$?\\d+";
  let ergebnis = formel;
  const grenzen = foundeverSummenKlammern_(ergebnis);

  // Ein ganzes SUMME/SUM-Argument darf samt Trennzeichen verschwinden.
  if (grenzen) {
    const inhalt = ergebnis.slice(grenzen.auf + 1, grenzen.zu);
    const trennzeichen = foundeverOberstesTrennzeichen_(inhalt);
    const ganzesArgument = new RegExp('^\\s*\\+?\\s*' + bezug + '\\s*$', 'i');

    if (trennzeichen) {
      const argumente = foundeverSummenArgumente_(inhalt, trennzeichen);
      const behalten = argumente.filter(argument => !ganzesArgument.test(argument));
      if (behalten.length !== argumente.length) {
        ergebnis = behalten.length
          ? ergebnis.slice(0, grenzen.auf + 1) +
            behalten.join(trennzeichen) + ergebnis.slice(grenzen.zu)
          : '=0';
      }
    } else if (ganzesArgument.test(inhalt)) {
      ergebnis = '=0';
    }
  }

  // Anfuehrungszeichen-Inhalte unveraendert lassen.
  const teile = ergebnis.split(/("(?:[^"]|"")*")/g);
  for (let i = 0; i < teile.length; i += 2) {
    let teil = teile[i];
    const allein = new RegExp('^\\s*=\\s*\\+?\\s*' + bezug + '\\s*$', 'i');
    const fuehrend = new RegExp('(^|[=(;,])\\s*\\+?\\s*' + bezug + '\\s*\\+\\s*', 'gi');
    const summand = new RegExp('[+-]\\s*' + bezug + '(?=\\s*(?:[+\\-);,]|$))', 'gi');

    if (allein.test(teil)) {
      teil = '=0';
    } else {
      teil = teil.replace(fuehrend, (_, vorzeichen) => vorzeichen);
      teil = teil.replace(summand, (treffer, position, text) => {
        let davor = position - 1;
        while (davor >= 0 && /\s/.test(text[davor])) davor--;
        return davor < 0 || !/[A-Za-z0-9_$)\]]/.test(text[davor]) ? treffer : '';
      });
    }
    teile[i] = teil;
  }
  return teile.join('');
}

/** SUMME/SUM-Argumente trennen, ohne innere Funktionen zu zerlegen. */
function foundeverSummenArgumente_(inhalt, trennzeichen) {
  const argumente = [];
  let start = 0;
  let tiefe = 0;
  let inText = false;

  for (let i = 0; i < inhalt.length; i++) {
    const zeichen = inhalt[i];
    if (zeichen === '"') {
      if (inText && inhalt[i + 1] === '"') { i++; continue; }
      inText = !inText;
    } else if (!inText) {
      if (zeichen === '(') tiefe++;
      else if (zeichen === ')') tiefe--;
      else if (tiefe === 0 && zeichen === trennzeichen) {
        argumente.push(inhalt.slice(start, i));
        start = i + 1;
      }
    }
  }
  argumente.push(inhalt.slice(start));
  return argumente;
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

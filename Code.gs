/**
 * Erstellt das Menü beim Öffnen der Tabelle
 */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('SR-Cockpit')
      .addItem('Steuerungs-Cockpit öffnen', 'showControlPanel')
      .addToUi();
}

/**
 * Mail Versand (als Funktion erhalten)
 */
function sendGroupEmail() {
  const senderEmail = "tagessteuerung.lks@lidl.de"; 
  const recipient = "shoan_david.scharrer@lidl.de";
  const subject = "Steuerungsreport bereitgestellt";
  const body = "Hallo zusammen,\n\nder Steuerungsreport wurde erstellt und in der gewohnten Ablage bereitgestellt.\n\nMit freundlichen Grüßen,";

  try {
    GmailApp.sendEmail(recipient, subject, body, {
      from: senderEmail,        
      name: "Tagessteuerung Berlin"
    });
    Logger.log("E-Mail erfolgreich als " + senderEmail + " versendet.");
  } catch (e) {
    Logger.log("Fehler: " + e.toString());
  }
}

/**
 * Hauptfunktion zum Starten des Cockpits
 */
function showControlPanel() {
  try {
    const html = HtmlService.createHtmlOutput(getDashboardHtml())
        .setWidth(500)
        .setHeight(780) 
        .setTitle("Steuerungs-Cockpit");
    SpreadsheetApp.getUi().showModelessDialog(html, "Steuerungs-Cockpit");
  } catch (e) {
    SpreadsheetApp.getUi().alert("Fehler beim Öffnen des Menüs: " + e.message);
  }
}

function startImportFromMenu(dateStr) { 
  if (acquireLock()) {
    try {
      datenImportieren(dateStr); 
    } finally {
      releaseLock();
    }
  }
}

function startDeleteFromMenu(dateStr) { 
  if (acquireLock()) {
    try {
      datenLoeschen(dateStr); 
    } finally {
      releaseLock();
    }
  }
}

function startDLExportFromMenu() { 
  if (acquireLock()) {
    try {
      exportSteuerungsreportDL(); 
    } finally {
      releaseLock();
    }
  }
}

function startCXExportFromMenu(dateStr) { 
  if (acquireLock()) {
    try {
      exportCXRawData(dateStr); 
    } finally {
      releaseLock();
    }
  }
}

function acquireLock() {
  const lock = LockService.getScriptLock();
  const hasLock = lock.tryLock(0); 
  if (!hasLock) {
    const ui = SpreadsheetApp.getUi();
    updateProgress("ABBRUCH: System ist belegt!", 100); 
    ui.alert("⚠️ DATEI GESPERRT ⚠️\n\nEin anderer Benutzer führt gerade einen Vorgang durch.\nBitte warten.");
    return false;
  }
  return true;
}

function releaseLock() {
  LockService.getScriptLock().releaseLock();
}

/**
 * DATEN LÖSCHEN
 */
function datenLoeschen(manualDateStr) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  let dateObj = null;

  resetProgress(); 
  if (manualDateStr) {
    dateObj = parseDateString(manualDateStr);
  } else {
    const input = ui.prompt('Datensatz entfernen', 'Datum (TT.MM.JJJJ):', ui.ButtonSet.OK_CANCEL);
    if (input.getSelectedButton() !== ui.Button.OK) return;
    dateObj = parseDateString(input.getResponseText());
  }

  if (!dateObj || isNaN(dateObj.getTime())) { ui.alert("Ungültiges Datum!"); return; }
  const dateStrDisplay = Utilities.formatDate(dateObj, Session.getScriptTimeZone(), "dd.MM.yyyy");
  
  if (!manualDateStr) {
    const confirm = ui.alert("Löschen", "Sollen ALLE Daten vom " + dateStrDisplay + " gelöscht werden?", ui.ButtonSet.YES_NO);
    if (confirm !== ui.Button.YES) return;
    openProgressBar();
  }

  updateProgress("Bereinige Daten...", 10);
  try {
    batchDeleteRows(ss.getSheetByName("DTAG"), 3, dateObj); 
    batchDeleteRows(ss.getSheetByName("SF"), 14, dateObj);
    batchDeleteRows(ss.getSheetByName("Datenbank_Lvl"), 3, dateObj);
    const sheetLKS = ss.getSheetByName("LKS-2nd");
    if (sheetLKS) {
      const data = sheetLKS.getRange(1, 1, sheetLKS.getLastRow(), 1).getValues();
      for (let i = 0; i < data.length; i++) {
        if (isSameDay(data[i][0], dateObj)) sheetLKS.getRange(i + 1, 32).clearContent();
      }
    }
    updateProgress("Fertig!", 100);
    SpreadsheetApp.flush();
    Utilities.sleep(2000);
    closeProgressBar();
  } catch (e) {
    updateProgress("FEHLER: " + e.message, 100); 
  }
}

function batchDeleteRows(sheet, colIndexOneBased, dateObj) {
  if (!sheet || sheet.getLastRow() < 2) return;
  const values = sheet.getRange(1, colIndexOneBased, sheet.getLastRow(), 1).getValues();
  const rangesToDelete = [];
  let blockEnd = -1;
  for (let i = values.length - 1; i >= 1; i--) { 
    if (isSameDay(values[i][0], dateObj)) {
      if (blockEnd === -1) blockEnd = i + 1; 
    } else {
      if (blockEnd !== -1) {
        rangesToDelete.push({ row: i + 2, num: blockEnd - (i + 1) });
        blockEnd = -1;
      }
    }
  }
  if (blockEnd !== -1) rangesToDelete.push({ row: 2, num: blockEnd - 1 });
  rangesToDelete.forEach(r => { try { sheet.deleteRows(r.row, r.num); } catch(e) {} });
}

/**
 * IMPORT HAUPTFUNKTION
 */
function datenImportieren(manualDateStr) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  let dat = null;

  resetProgress();
  if (manualDateStr) {
    dat = parseDateString(manualDateStr);
  } else {
    const input = ui.prompt('Datum eingeben', 'Datum für Auswertung (TT.MM.JJJJ):', ui.ButtonSet.OK_CANCEL);
    if (input.getSelectedButton() !== ui.Button.OK) return;
    dat = parseDateString(input.getResponseText());
  }
  
  if (!dat || isNaN(dat.getTime())) { ui.alert("Kein gültiges Datum!"); return; }

  dat.setDate(dat.getDate() - 1);
  const datCheckString = Utilities.formatDate(dat, Session.getScriptTimeZone(), "dd.MM.yyyy");
  
  const sheetDTAG = ss.getSheetByName("DTAG");
  if (!sheetDTAG) { ui.alert("Blatt 'DTAG' fehlt!"); return; }
  
  if (sheetDTAG.getLastRow() > 1) {
    const dataCheck = sheetDTAG.getRange(1, 3, sheetDTAG.getLastRow(), 1).getValues();
    for (let i = 2; i < dataCheck.length; i++) {
      if (isSameDay(dataCheck[i][0], dat)) {
        ui.alert("Import für " + datCheckString + " bereits vorhanden!");
        return;
      }
    }
  }

  if (!manualDateStr) openProgressBar();
  updateProgress("Initialisiere...", 5);

  try {
    const wsSettings = ss.getSheetByName("Einstellungen_Global");
    if (!wsSettings) throw new Error("Blatt 'Einstellungen_Global' fehlt.");

    const FOLDER_ID_TELEKOM = wsSettings.getRange("E6").getValue();
    const FOLDER_ID_PERFORMANCE = wsSettings.getRange("E18").getValue();
    const FOLDER_ID_LEVEL = wsSettings.getRange("E30").getValue();
    
    if (!FOLDER_ID_TELEKOM || !FOLDER_ID_PERFORMANCE || !FOLDER_ID_LEVEL) throw new Error("Ordner-IDs fehlen in 'Einstellungen_Global'.");

    const fileDateStr = Utilities.formatDate(dat, Session.getScriptTimeZone(), "dd.MM.yyyy"); 
    const levelDateStr = Utilities.formatDate(dat, Session.getScriptTimeZone(), "dd_MM_yyyy");
    
    const nameTelekom = fileDateStr + ".xls";
    const nameSF = fileDateStr + "_SF.xlsx";
    const nameLevel = "Level_" + levelDateStr + ".csv";

    // DATEIPRÜFUNG MIT FEHLERMELDUNG
    updateProgress("Suche Telekom-Datei...", 10);
    const fileTelekom = findFileInFolder(FOLDER_ID_TELEKOM, nameTelekom);
    if (!fileTelekom) throw new Error("Datei nicht gefunden: " + nameTelekom + " (Telekom)");

    updateProgress("Suche Salesforce-Datei...", 12);
    const fileSF = findFileInFolder(FOLDER_ID_PERFORMANCE, nameSF);
    if (!fileSF) throw new Error("Datei nicht gefunden: " + nameSF + " (Salesforce)");

    updateProgress("Suche Level-Datei...", 15);
    const fileLevel = findFileInFolder(FOLDER_ID_LEVEL, nameLevel);
    if (!fileLevel) throw new Error("Datei nicht gefunden: " + nameLevel + " (Level)");

    // --- 1. TELEKOM ---
    updateProgress("Importiere Telekom...", 20);
    let dataTelekom = importExcelData(fileTelekom.getId(), "Statistik");
    if (dataTelekom && dataTelekom.length > 17) {
      const dataToImport = dataTelekom.slice(17);
      if (dataToImport.length > 0) {
        const startRow = sheetDTAG.getLastRow() + 1;
        sheetDTAG.getRange(startRow, 4, dataToImport.length, dataToImport[0].length).setValues(dataToImport);
        sheetDTAG.getRange(startRow, 3, dataToImport.length, 1).setNumberFormat("dd.MM.yyyy").setValue(Utilities.formatDate(dat, Session.getScriptTimeZone(), "yyyy-MM-dd"));
        
        const formA = sheetDTAG.getRange("A3").getFormulaR1C1();
        const formB = sheetDTAG.getRange("B3").getFormulaR1C1();
        const targetA = sheetDTAG.getRange(startRow, 1, dataToImport.length, 1);
        const targetB = sheetDTAG.getRange(startRow, 2, dataToImport.length, 1);
        if (formA) targetA.setFormulaR1C1(formA); else targetA.setValue(sheetDTAG.getRange("A3").getValue());
        if (formB) targetB.setFormulaR1C1(formB); else targetB.setValue(sheetDTAG.getRange("B3").getValue());
        SpreadsheetApp.flush();
        targetA.setValues(targetA.getValues());
        targetB.setValues(targetB.getValues());
      }
    }
    dataTelekom = null;

    // --- 2. SALESFORCE ---
    updateProgress("Lade Salesforce...", 30);
    const sheetSF = ss.getSheetByName("SF");
    let dataSFSource = importExcelData(fileSF.getId(), "Performance_History_Contacts_in");
    const checkResult = validateSFHeaders(dataSFSource);
    if (!checkResult.valid) {
       updateProgress("ABBRUCH: Header-Fehler!", 100);
       showColumnErrorDialog(datCheckString, checkResult.missing);
       return; 
    }
    
    const levelCandidates = []; 
    if (dataSFSource) {
      updateProgress("Analysiere Salesforce-Daten...", 35);
      const startRowSF = sheetSF.getLastRow() + 1;
      const lastColSF = Math.max(sheetSF.getLastColumn(), 16); 
      const headers = sheetSF.getRange(1, 1, 1, lastColSF).getValues()[0];
      const flags = sheetSF.getRange(2, 1, 1, lastColSF).getValues()[0];
      const srcHeaders = dataSFSource[0];
      const mapSrc = {};
      srcHeaders.forEach((h, i) => { if(h) mapSrc[String(h).trim().toLowerCase().replace(/\s+/g, '')] = i; });
      const colsToImport = [];
      flags.forEach((f, i) => { if(f === "Import") colsToImport.push({n: String(headers[i]).trim().toLowerCase().replace(/\s+/g, ''), d: i}); });

      const validSourceRows = [];
      for(let i=1; i<dataSFSource.length; i++) {
        let isRowEmpty = true;
        for(let j=0; j<dataSFSource[i].length; j++) {
          if(dataSFSource[i][j] !== "" && dataSFSource[i][j] != null) { isRowEmpty = false; break; }
        }
        if(!isRowEmpty) validSourceRows.push(dataSFSource[i]);
      }
      dataSFSource = null;
      const numRows = validSourceRows.length;

      if (numRows > 0) {
        const mappingMap = new Map();
        const mappingSheet = ss.getSheetByName("Mapping_SF");
        if (mappingSheet && mappingSheet.getLastRow() > 1) {
           mappingSheet.getRange(2, 1, mappingSheet.getLastRow() - 1, 2).getValues().forEach(r => { if (r[0] != null) mappingMap.set(String(r[0]).trim(), String(r[1]).trim()); });
        }
        
        const countMap = new Map();
        if (sheetSF.getLastRow() > 2) {
           const existingData = sheetSF.getRange(3, 1, sheetSF.getLastRow() - 2, 11).getValues();
           existingData.forEach(r => {
              if (String(r[1] || "").trim() === "9. Unfinished (back to Q)") {
                 const key = String(r[0] || "").trim() + "|" + String(r[10] || "").trim();
                 countMap.set(key, (countMap.get(key) || 0) + 1);
              }
           });
        }

        updateProgress("Bereite " + numRows + " Zeilen vor...", 45);
        let newData = new Array(numRows);
        const levelCriteria = new Set(["3. New Written", "4. Splitted Written", "5. Merged Written", "7. Reply Written", "8. Reply Written Subcase"]);
        
        // Pass 1: Grundmapping & Zähler
        for (let i = 0; i < numRows; i++) {
          newData[i] = new Array(lastColSF).fill("");
          colsToImport.forEach(c => { const si = mapSrc[c.n]; if (si !== undefined) newData[i][c.d] = validSourceRows[i][si]; });
          if (String(newData[i][1] || "").trim() === "9. Unfinished (back to Q)") {
             const key = String(newData[i][0] || "").trim() + "|" + String(newData[i][10] || "").trim();
             countMap.set(key, (countMap.get(key) || 0) + 1);
          }
        }

        updateProgress("Berechne Logik...", 55);
        for (let i = 0; i < numRows; i++) {
          const a = String(newData[i][0] || "").trim(), b = String(newData[i][1] || "").trim(), e = String(newData[i][4] || "").trim(), 
                f = String(newData[i][5] || "").trim(), k = String(newData[i][10] || "").trim(), i_val = String(newData[i][8] || "").trim(), m = String(newData[i][12] || "").trim();
          
          // FIX SPALTE N: Reiner ISO-String für Datums-Erkennung ohne Uhrzeit
          let isoDate = "";
          if (i_val.length >= 10) isoDate = i_val.substring(0, 10);
          newData[i][13] = isoDate;
          
          newData[i][14] = countMap.get(a + "|" + k) || 0;
          
          let fallback = "Online Shop";
          if (m === "NA" && (e === "5.2.1 General Lidl Plus" || e === "5.2.2 Registration Lidl Plus" || e === "5.2.3 Coupons/Offers")) fallback = "Lidl Plus";
          let lookup = mappingMap.has(m) ? mappingMap.get(m) : fallback;
          newData[i][15] = (lookup !== 0 && lookup !== "0" && lookup !== "") ? lookup : (f === "Store" ? "Store" : "Online Shop");
          
          if (String(newData[i][11] || "").trim() === "Lidl" && newData[i][14] === 0 && levelCriteria.has(b)) {
              levelCandidates.push([a, newData[i][6], isoDate, newData[i][15], "", "", ""]);
          }
          newData[i][10] = ""; 
        }

        const maxRows = sheetSF.getMaxRows();
        if (startRowSF + numRows > maxRows) { sheetSF.insertRowsAfter(maxRows, (startRowSF + numRows - maxRows) + 50); SpreadsheetApp.flush(); }

        updateProgress("Speichere Salesforce...", 65);
        sheetSF.getRange(startRowSF, 1, numRows, lastColSF).setValues(newData);
        sheetSF.getRange(startRowSF, 14, numRows, 1).setNumberFormat("dd.MM.yyyy"); 
        SpreadsheetApp.flush(); 
      }
    }
    
    updateProgress("Berechne NZ...", 75);
    berechnungNZ(dat);

    updateProgress("Verarbeite Level-CSV...", 85);
    if (levelCandidates.length > 0) {
       const fileContent = DriveApp.getFileById(fileLevel.getId()).getBlob().getDataAsString("UTF-8");
       const delim = fileContent.indexOf(";") !== -1 ? ";" : ",";
       const levelData = Utilities.parseCsv(fileContent, delim);
       if (levelData && levelData.length > 0) {
          const finalData = matchLevelDataInMemory(levelCandidates, levelData);
          if (finalData.length > 0) {
              const wsDest = ss.getSheetByName("Zuweisung_Level");
              wsDest.clear();
              wsDest.getRange(1, 1, finalData.length, 7).setValues(finalData);
              datenVerschiebenOptimiert(finalData, dat);
          }
       }
    }

    updateProgress("Fertig!", 100);
    SpreadsheetApp.flush();
    Utilities.sleep(1500); 
    closeProgressBar();
    if (!manualDateStr) ss.toast("Import erfolgreich!", "Erfolg");

  } catch (e) {
    updateProgress("FEHLER: " + e.message, 100);
    ss.toast("Fehler: " + e.message, "Abbruch", 10);
    console.error(e);
  }
}

// --- LOGIK HILFEN ---
function matchLevelDataInMemory(candidates, levelData) {
  const filtered = [];
  const dict = new Map();
  for (let i = 1; i < levelData.length; i++) {
    const key = String(levelData[i][0] || "").trim();
    if (!dict.has(key)) dict.set(key, []);
    const entry = [levelData[i][3], levelData[i][4], levelData[i][5]];
    const existing = dict.get(key);
    if(existing.length < 2) {
       let found = false;
       for(let ex of existing) if(String(ex[2]).trim() === String(entry[2]).trim()) found = true;
       if(!found) existing.push(entry);
    }
  }
  for (let row of candidates) {
    const key = String(row[0] || "").trim();
    const matches = dict.get(key);
    if (matches && matches.length > 0) {
      for (let m of matches) {
        let newRow = [...row];
        newRow[4] = m[0]; newRow[5] = m[1]; newRow[6] = m[2];
        filtered.push(newRow);
      }
    } else { filtered.push(row); }
  }
  return filtered;
}

function berechnungNZ(dateObj) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetLKS = ss.getSheetByName("LKS-2nd");
  const sheetDTAG = ss.getSheetByName("DTAG");
  if (!sheetDTAG || sheetDTAG.getLastRow() < 2) return;
  const data = sheetDTAG.getRange(1, 1, sheetDTAG.getLastRow(), 36).getValues();
  let totalNZ = 0, totalCalls = 0;
  for (let i = 1; i < data.length; i++) {
    if (!isSameDay(data[i][2], dateObj)) continue;
    if (String(data[i][1] || "").toLowerCase().includes("telefonie de_kleinelines")) {
      const aj = Number(data[i][35]), e = Number(data[i][4]);
      if (aj > 0) { totalNZ += aj * e; totalCalls += e; }
    }
  }
  if (totalCalls > 0) {
    const res = totalNZ / totalCalls;
    const lksData = sheetLKS.getRange(1, 1, sheetLKS.getLastRow(), 1).getValues();
    for (let i = 0; i < lksData.length; i++) { if (isSameDay(lksData[i][0], dateObj)) { sheetLKS.getRange(i + 1, 31).setValue(res); break; } }
  }
}

function datenVerschiebenOptimiert(dataQuelle, dateObj) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const wsZiel = ss.getSheetByName("Datenbank_Lvl");
  const lastRowZiel = wsZiel.getLastRow();
  let vorhanden = false;
  if (lastRowZiel > 1) {
    const dbDates = wsZiel.getRange(1, 3, lastRowZiel, 1).getValues();
    for (let i = dbDates.length - 1; i >= 1; i--) { if (isSameDay(dbDates[i][0], dateObj)) { vorhanden = true; break; } }
  }
  if (!vorhanden) {
    const row = lastRowZiel + 1;
    const maxRowsDb = wsZiel.getMaxRows();
    if (row + dataQuelle.length > maxRowsDb) wsZiel.insertRowsAfter(maxRowsDb, (row + dataQuelle.length - maxRowsDb) + 50);
    wsZiel.getRange(row, 1, dataQuelle.length, 7).setValues(dataQuelle);
    SpreadsheetApp.flush(); 
  }
}

// --- EXPORT ---
function exportSteuerungsreportDL() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  resetProgress();
  updateProgress("Initialisiere Export...", 0);
  try {
    const targets = getDLExportTargets(ss);
    targets.forEach((target, index) => {
      updateProgress("Export " + target.sheetName + "...", Math.round(10 + (index / targets.length) * 80));
      exportSingleSheet(ss, target.sheetName, target.folderId, target.fileName);
    });
    updateProgress("Fertig!", 100);
    Utilities.sleep(1500);
    closeProgressBar();
    ss.toast("Dienstleister-Export fertig.");
  } catch (e) {
    updateProgress("FEHLER: " + e.message, 100);
    ss.toast(e.message, "Abbruch", 10);
    throw e;
  }
}

function exportSingleSheet(ss, sName, fId, tName) {
    const src = ss.getSheetByName(sName);
    if (!src) throw new Error(sName + " fehlt.");
    const vals = src.getDataRange().getValues();
    const folder = DriveApp.getFolderById(fId);
    const existing = folder.getFilesByName(tName);
    while (existing.hasNext()) existing.next().setTrashed(true);
    const newSS = SpreadsheetApp.create(tName);
    const target = src.copyTo(newSS);
    target.setName("Report");
    target.getRange(1, 1, vals.length, vals[0].length).setValues(vals);
    newSS.deleteSheet(newSS.getSheets()[0]);
    SpreadsheetApp.flush(); 
    DriveApp.getFileById(newSS.getId()).moveTo(folder);
}

// --- CX ROHDATEN EXPORT ---
function exportCXRawData(dateInput) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const wsSettings = ss.getSheetByName("Einstellungen_Global");
  const FOLDER_ID_PERFORMANCE = wsSettings.getRange("E18").getValue();
  const TARGET_FOLDER_ID = "1W7pwawnSYUQhVb3JF67ieA7cXE9Wl2Sz";
  resetProgress();
  updateProgress("Analysiere Zeitraum...", 5);
  try {
    let dates = [];
    if (dateInput.includes('-')) {
      let parts = dateInput.split('-'), startD = parseDateString(parts[0].trim()), endD = parseDateString(parts[1].trim());
      if (!startD || !endD) throw new Error("Ungültiges Datumsformat im Zeitraum.");
      let curr = new Date(startD);
      while (curr <= endD) { dates.push(new Date(curr)); curr.setDate(curr.getDate() + 1); }
    } else {
      let single = parseDateString(dateInput.trim());
      if (!single) throw new Error("Ungültiges Datum.");
      dates.push(single);
    }
    for (let i = 0; i < dates.length; i++) {
      const currentDat = dates[i], fileDateStr = Utilities.formatDate(currentDat, Session.getScriptTimeZone(), "dd.MM.yyyy"), targetDateStr = Utilities.formatDate(currentDat, Session.getScriptTimeZone(), "dd_MM_yyyy");
      const fileNameSF = fileDateStr + "_SF.xlsx", targetFileName = "Rohdaten_CX_" + targetDateStr + "_2026.xlsx"; 
      updateProgress("Verarbeite " + fileNameSF + "...", 10 + (i/dates.length)*60);
      const fileSF = findFileInFolder(FOLDER_ID_PERFORMANCE, fileNameSF);
      if (!fileSF) continue; 
      const dataSF = importExcelData(fileSF.getId(), "Performance_History_Contacts_in"); 
      if (!dataSF || dataSF.length === 0) continue;
      const headers = dataSF[0];
      let locIndex = -1;
      for (let j = 0; j < headers.length; j++) { if (String(headers[j] || "").trim().toLowerCase() === "location") { locIndex = j; break; } }
      if (locIndex === -1) continue;
      const filtered = [headers]; 
      for (let r = 1; r < dataSF.length; r++) { if (dataSF[r][0] !== "" && String(dataSF[r][locIndex] || "").trim().toLowerCase() === "webhelp") filtered.push(dataSF[r]); }
      if (filtered.length <= 1) continue;
      const tempSS = SpreadsheetApp.create("Temp_CX_" + targetDateStr);
      tempSS.getSheets()[0].getRange(1, 1, filtered.length, filtered[0].length).setValues(filtered);
      SpreadsheetApp.flush();
      const blob = UrlFetchApp.fetch("https://docs.google.com/spreadsheets/d/" + tempSS.getId() + "/export?format=xlsx", { headers: { 'Authorization': 'Bearer ' + ScriptApp.getOAuthToken() } }).getBlob().setName(targetFileName);
      const folder = DriveApp.getFolderById(TARGET_FOLDER_ID);
      const existingFiles = folder.getFilesByName(targetFileName);
      while(existingFiles.hasNext()) existingFiles.next().setTrashed(true);
      folder.createFile(blob);
      DriveApp.getFileById(tempSS.getId()).setTrashed(true);
    }
    updateProgress("Bereinige alte Dateien...", 90);
    cleanupOldCXFiles(TARGET_FOLDER_ID);
    updateProgress("Fertig!", 100);
    Utilities.sleep(1500);
    closeProgressBar();
    ss.toast("CX-Export fertig.");
  } catch (e) { updateProgress("FEHLER: " + e.message, 100); ss.toast(e.message, "Abbruch"); }
}

function cleanupOldCXFiles(folderId) {
  try {
    const folder = DriveApp.getFolderById(folderId);
    const files = folder.getFiles();
    let workdaysCount = 0, checkDate = new Date();
    checkDate.setHours(12, 0, 0, 0); 
    while (workdaysCount < 2) { if (isServerWorkDay(checkDate)) workdaysCount++; if (workdaysCount < 2) checkDate.setDate(checkDate.getDate() - 1); }
    const cutoff = checkDate.getTime();
    while (files.hasNext()) {
      const file = files.next(), name = file.getName();
      if (name.startsWith("Rohdaten_CX_")) {
        const p = name.split('_');
        if (p.length >= 5) {
          const fDate = new Date(parseInt(p[4], 10), parseInt(p[3], 10) - 1, parseInt(p[2], 10), 12, 0, 0);
          if (fDate.getTime() < cutoff) file.setTrashed(true);
        }
      }
    }
  } catch (e) {}
}

function isServerWorkDay(date) {
  const day = date.getDay();
  if (day === 0 || day === 6) return false; 
  const year = date.getFullYear();
  const fixed = ["01-01", "03-08", "05-01", "10-03", "12-25", "12-26"];
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, dM = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - dM - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), month = Math.floor((h + l - 7 * m + 114) / 31) - 1, dayE = ((h + l - 7 * m + 114) % 31) + 1;
  const easter = new Date(year, month, dayE);
  const format = (dt) => String(dt.getMonth() + 1).padStart(2, '0') + "-" + String(dt.getDate()).padStart(2, '0');
  const addD = (n) => { let d2 = new Date(easter); d2.setDate(d2.getDate() + n); return format(d2); };
  const hol = [...fixed, addD(-2), addD(1), addD(39), addD(50)];
  return !hol.includes(String(date.getMonth() + 1).padStart(2, '0') + "-" + String(date.getDate()).padStart(2, '0'));
}

// --- HELPER ---
function parseDateString(str) {
  if (!str) return null;
  if (str.includes('-')) { const p = str.split('-'); return new Date(p[0], p[1]-1, p[2], 12); }
  if (str.includes('.')) { const p = str.split('.'); return new Date(p[2], p[1]-1, p[0], 12); }
  return null;
}
function isSameDay(d1, d2) {
  if (!d2) return false;
  let dt = d1 instanceof Date ? d1 : new Date(d1);
  if (isNaN(dt)) return false;
  return dt.getFullYear() === d2.getFullYear() && dt.getMonth() === d2.getMonth() && dt.getDate() === d2.getDate();
}
function importExcelData(fileId, sheetId) {
  let tempId = null;
  try {
    const blob = DriveApp.getFileById(fileId).getBlob();
    const temp = Drive.Files.create({name: "T_"+Date.now(), mimeType: MimeType.GOOGLE_SHEETS}, blob);
    tempId = temp.id;
    const sheet = SpreadsheetApp.openById(tempId).getSheets()[typeof sheetId==='number'?sheetId:0];
    const vals = sheet ? sheet.getDataRange().getValues() : [];
    DriveApp.getFileById(tempId).setTrashed(true);
    return vals;
  } catch(e) { if(tempId) try{DriveApp.getFileById(tempId).setTrashed(true)}catch(z){} return null; }
}
function findFileInFolder(fId, name) {
  try { const f = DriveApp.getFolderById(fId).getFilesByName(name); return f.hasNext() ? f.next() : null; } catch(e) { return null; }
}

// --- UI ---
function resetProgress() { CacheService.getUserCache().putAll({"done": "false", "msg": "Init...", "pct": "0"}, 60); Utilities.sleep(300); }
function updateProgress(msg, pct) { CacheService.getUserCache().putAll({"msg": msg, "pct": String(pct)}, 3600); }
function closeProgressBar() { updateProgress("Fertig", 100); CacheService.getUserCache().put("done", "true", 60); }
function getProgressData() { const c = CacheService.getUserCache(); return { msg: c.get("msg")||"Laden...", pct: parseInt(c.get("pct")||"0"), done: c.get("done")==="true" }; }
function openProgressBar() { SpreadsheetApp.getUi().showModelessDialog(HtmlService.createHtmlOutput(getProgressBarHtml()).setWidth(500).setHeight(780), "Status"); }

function getDashboardHtml() { return `<!DOCTYPE html><html><head><base target="_top"><style>
    body { font-family: 'Segoe UI', sans-serif; background: #ffffff; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; color: #0050AA; }
    .card { background: white; width: 100%; height: 100%; box-shadow: 0 4px 15px rgba(0,0,0,0.1); display: flex; flex-direction: column; }
    .header { background: #0050AA; color: white; padding: 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; } .sub { color: #FFD100; font-size: 12px; font-weight: bold; margin-top: 5px; }
    .content { padding: 25px; display: flex; flex-direction: column; gap: 15px; flex: 1; overflow-y: auto; }
    .sec { background: #f9f9f9; padding: 15px; border: 1px solid #eee; border-radius: 8px; text-align: left; color: #333; }
    label { display: block; font-size: 14px; font-weight: 600; margin-bottom: 8px; color: #333; }
    input { width: 95%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; margin-bottom: 10px; box-sizing: border-box; }
    button { width: 100%; border: none; padding: 12px; border-radius: 5px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; }
    .btn-i { background: #0050AA; color: white; } .btn-i:hover { background: #003d82; }
    .btn-d { background: white; color: #E30613; border: 2px solid #E30613; } .btn-d:hover { background: #fff0f0; }
    .container { display: none; flex-direction: column; align-items: center; justify-content: center; height: 100%; }
    h2 { font-size: 20px; margin: 10px 0; } .warn { color: #E30613; font-weight: bold; font-size: 13px; margin-bottom: 20px; }
    .wrap { width: 100%; background: #ecf0f1; height: 24px; border-radius: 4px; overflow: hidden; border: 1px solid #ccc; margin: 15px 0; }
    .bar { height: 100%; background: #0050AA; width: 0%; transition: width 0.3s; }
    .spin { border: 5px solid #0050AA; border-top: 5px solid #FFD100; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin-bottom: 15px; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .confirm-view { display: none; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; }
    .confirm-btn-group { display: flex; gap: 15px; margin-top: 20px; }
    .btn-yes { background: #E30613; color: white; min-width: 80px; }
    .btn-no { background: #aaa; color: white; min-width: 80px; }
  </style></head><body>
  <div class="card" id="menu"><div class="header"><h1>Steuerungs-Cockpit</h1><div class="sub">Datenverarbeitung Zentrale</div></div><div class="content">
    <div class="sec"><label>Neuer Import:</label><div style="font-size:11px;color:#555;margin-bottom:10px">Heute für gestern.</div><input type="date" id="d1" value="${new Date().toISOString().split('T')[0]}"><button class="btn-i" onclick="run('startImportFromMenu','d1')">📥 Import Starten</button></div>
    <div style="font-size: 16px; font-weight: bold; color: #1e8449; margin-bottom: -5px;">Dienstleister Export</div>
    <div class="sec" style="background:#eafaf1;border-color:#d5f5e3"><label style="color:#1e8449">Steuerungsreport Bereitstellen:</label><div style="font-size:11px;color:#555;margin-bottom:10px">Kopiert die Werte für TP, CX und Foundever in den jeweiligen DL-Ordner.</div><button class="btn-i" style="background:#2ecc71" onclick="runExport()">📤 Steuerungsreport bereitstellen</button></div>
    <div class="sec" style="background:#eafaf1;border-color:#d5f5e3"><label style="color:#1e8449">CX Rohdaten (Webhelp):</label><div style="font-size:11px;color:#555;margin-bottom:10px">Tag (TT.MM.JJJJ) oder Zeitraum (TT.MM.JJJJ-TT.MM.JJJJ).</div><input type="text" id="d_cx" placeholder="TT.MM.JJJJ" style="border-color:#a3e4d7;"><button class="btn-i" style="background:#2ecc71" onclick="runCXExport()">📥 Concentrix Rohdaten bereitstellen</button></div>
    <div class="sec" style="background:#fdedec;border-color:#fadbd8"><label style="color:#c0392b">Daten löschen:</label><input type="date" id="d2"><button class="btn-d" onclick="confirmDelete()">🗑️ Löschen</button></div>
  </div></div>
  <div class="confirm-view" id="confirm"><h2>Löschen?</h2><p>Dies kann nicht rückgängig gemacht werden.</p><div class="confirm-btn-group"><button class="btn-yes" onclick="runDeleteConfirmed()">JA</button><button class="btn-no" onclick="cancelDelete()">Nein</button></div></div>
  <div class="container" id="prog"><div class="spin" id="s"></div><h2 id="t">Verarbeite...</h2><div class="warn">Bitte Fenster nicht schließen!</div><div id="msg">Starte...</div><div class="wrap"><div class="bar" id="b"></div></div><div id="p">0%</div></div>
  <script>
    window.onload = function() {
      let d = new Date(); d.setDate(d.getDate() - 1); 
      function getBerlinHolidays(year) {
        const fixed = ["01-01", "03-08", "05-01", "10-03", "12-25", "12-26"];
        const a = year % 19, b = Math.floor(year / 100), c = year % 100, dM = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - dM - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), month = Math.floor((h + l - 7 * m + 114) / 31) - 1, dayE = ((h + l - 7 * m + 114) % 31) + 1;
        const easter = new Date(year, month, dayE);
        const format = (dt) => String(dt.getMonth() + 1).padStart(2, '0') + "-" + String(dt.getDate()).padStart(2, '0');
        const addD = (n) => { let d2 = new Date(easter); d2.setDate(d2.getDate() + n); return format(d2); };
        return [...fixed, addD(-2), addD(1), addD(39), addD(50)];
      }
      let isHoliday = true;
      while (isHoliday) {
        let holidays = getBerlinHolidays(d.getFullYear()); 
        let checkStr = String(d.getMonth() + 1).padStart(2, '0') + "-" + String(d.getDate()).padStart(2, '0');
        if (d.getDay() === 0 || holidays.includes(checkStr)) { d.setDate(d.getDate() - 1); } else { isHoliday = false; }
      }
      document.getElementById('d_cx').value = String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear();
    };
    function run(f,i){const d=document.getElementById(i).value;if(!d)return alert("Datum!");switchToProgress();startProcess(f,d)}
    function runExport(){switchToProgress();startProcess('startDLExportFromMenu',null)}
    function runCXExport(){const d = document.getElementById('d_cx').value;if(!d)return alert("Datum!");switchToProgress();startProcess('startCXExportFromMenu', d)}
    function confirmDelete(){const d=document.getElementById('d2').value;if(!d)return alert("Datum!");document.getElementById('menu').style.display='none';document.getElementById('confirm').style.display='flex'}
    function cancelDelete(){document.getElementById('confirm').style.display='none';document.getElementById('menu').style.display='flex'}
    function runDeleteConfirmed(){const d=document.getElementById('d2').value;document.getElementById('confirm').style.display='none';switchToProgress();startProcess('startDeleteFromMenu',d)}
    function switchToProgress(){document.getElementById('menu').style.display='none';document.getElementById('prog').style.display='flex';document.getElementById('msg').innerText="Vorbereitung...";document.getElementById('b').style.width='0%';document.getElementById('p').innerText='0%';document.getElementById('t').innerText="Verarbeite..."}
    function startProcess(f,a){google.script.run.withSuccessHandler(()=>{google.script.run.withSuccessHandler(()=>{google.script.host.close()}).withFailureHandler(e=>{alert("Fehler: "+e.message);google.script.host.close()})[f](a);setTimeout(poll,500)}).resetProgress()}
    function poll(){setInterval(()=>google.script.run.withSuccessHandler(d=>{document.getElementById('msg').innerText=d.msg;document.getElementById('b').style.width=d.pct+'%';document.getElementById('p').innerText=d.pct+'%';if(d.pct>=100){document.getElementById('t').innerText="Fertig!";document.getElementById('s').style.display='none'}if(d.done)setTimeout(()=>google.script.host.close(),3000)}).getProgressData(),1000)}
  </script></body></html>`;
}
function getProgressBarHtml() { return getDashboardHtml(); }

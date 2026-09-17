/**
 * Ziele für die Bereitstellung der ausgewerteten Dienstleister-Reports.
 * Foundever erhält nur den Report, keinen separaten Rohdatenexport.
 */
function getDLExportTargets(ss) {
  const wsSettings = ss.getSheetByName("Einstellungen_Global");
  if (!wsSettings) throw new Error("Blatt 'Einstellungen_Global' fehlt.");

  const targets = [
    {
      sheetName: "Teleperformance",
      folderId: String(wsSettings.getRange("E42").getValue() || "").trim(),
      fileName: "Steuerungsreport_Teleperformance"
    },
    {
      sheetName: "Concentrix",
      folderId: String(wsSettings.getRange("E54").getValue() || "").trim(),
      fileName: "Steuerungsreport_Concentrix"
    },
    {
      sheetName: "Foundever",
      folderId: "1SnMraecpyMgILcNPK-waZ5t_OsCAy0T3",
      fileName: "Steuerungsreport_Foundever"
    }
  ];

  // Alle Quellblätter und Ordner-IDs prüfen, bevor der erste Report ersetzt wird.
  targets.forEach(target => {
    if (!ss.getSheetByName(target.sheetName)) {
      throw new Error("Blatt '" + target.sheetName + "' fehlt. Bitte den Dienstleister-Report in der Tabelle anlegen.");
    }
    if (!target.folderId) {
      throw new Error("Export-Ordner-ID für " + target.sheetName + " fehlt in 'Einstellungen_Global'.");
    }
  });

  return targets;
}

/**
 * Prüft die Salesforce Rohdaten auf die notwendigen Spalten.
 * Gibt ein Objekt zurück: { valid: boolean, missing: string }
 */
function validateSFHeaders(data) {
  if (!data || data.length < 1) return { valid: false, missing: "Datei leer" };

  // Header Zeile normalisieren (alles klein, getrimmt)
  const headers = data[0].map(h => String(h).trim().toLowerCase());
  
  // Wir suchen nach Teilen des Strings, falls Leerzeichen abweichen
  const hasMerge = headers.some(h => h.includes("merge to"));
  const hasParent = headers.some(h => h.includes("parent case number"));

  if (!hasMerge || !hasParent) {
    let missingArr = [];
    if (!hasMerge) missingArr.push("'Merge To'");
    if (!hasParent) missingArr.push("'Parent Case Number'");
    return { valid: false, missing: missingArr.join(" und ") };
  }
  
  return { valid: true, missing: "" };
}

/**
 * Zeigt den kritischen Fehler-Dialog an
 */
function showColumnErrorDialog(dateString, missingCols) {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <base target="_top">
        <style>
          body { font-family: 'Segoe UI', sans-serif; padding: 20px; background-color: #fdf2f2; text-align: center; }
          .icon { font-size: 50px; color: #E30613; margin-bottom: 10px; }
          h2 { color: #E30613; margin: 0 0 15px 0; }
          p { color: #333; font-size: 14px; line-height: 1.5; }
          .box { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); border-left: 5px solid #E30613; }
          .action-required { font-weight: bold; margin-top: 15px; display: block; background: #fff0f0; padding: 10px; border-radius: 4px; color: #c0392b; border: 1px dashed #E30613; }
          button { background-color: #E30613; color: white; border: none; padding: 10px 20px; font-size: 14px; border-radius: 4px; cursor: pointer; margin-top: 20px; }
          button:hover { background-color: #c0392b; }
        </style>
      </head>
      <body>
        <div class="box">
          <div class="icon">⚠️</div>
          <h2>Import abgebrochen</h2>
          <p>Die Salesforce-Datei hat ein falsches Format.</p>
          <p>Es fehlen folgende Spalten:<br><b>${missingCols}</b></p>
          <p>Vermutlich wurde die <i>alte Performance History</i> verwendet.</p>
          
          <span class="action-required">
            WICHTIG:<br>
            Da der Import teilweise schon lief (DTAG), müssen die Daten vom <b>${dateString}</b> jetzt über das Menü "Daten löschen" entfernt werden, bevor du es erneut versuchst!
          </span>
          
          <button onclick="google.script.host.close()">Verstanden, ich werde löschen</button>
        </div>
      </body>
    </html>
  `;

  const html = HtmlService.createHtmlOutput(htmlContent)
      .setWidth(450)
      .setHeight(400);
      
  SpreadsheetApp.getUi().showModalDialog(html, "Kritischer Fehler beim Import");
}

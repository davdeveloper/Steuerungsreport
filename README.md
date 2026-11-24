## Foundever-Export im Steuerungs-Cockpit

* **Steuerungsreport bereitstellen** kopiert das Blatt `Foundever` mit seinen Werten und seiner Formatierung als `Steuerungsreport_Foundever` in den [Foundever-Ordner](https://drive.google.com/drive/folders/1SnMraecpyMgILcNPK-waZ5t_OsCAy0T3). Derselbe Lauf stellt auch die Reports für Teleperformance und Concentrix bereit.
* **Foundever Rohdaten bereitstellen** liest für den gewählten Tag oder Zeitraum die Tagesdateien `TT.MM.JJJJ_SF.xlsx` aus dem Performance-History-Ordner in `Einstellungen_Global!E18`. Pro Tag mit Treffern entsteht im Foundever-Ordner die Datei `Rohdaten_Foundever_TT_MM_JJJJ_2026.xlsx` mit der Kopfzeile und allen Quellspalten in Originalreihenfolge. Für Foundever zählt der Wert `Foundever` in der Spalte `Location`, für den Concentrix-Button weiterhin `Webhelp`.
* Ein erneuter Export ersetzt die gleichnamige Rohdatendatei. Die Bereinigung entfernt ältere Rohdaten des gewählten Dienstleisters. Die Aufbewahrung beginnt mit dem zweiten Arbeitstag, von heute rückwärts gezählt.

Für die Übernahme in die Google-Tabelle `Code.gs` und `Helper.gs` im zugehörigen Apps-Script-Projekt aktualisieren und die Tabelle neu laden.

## Steuerungsreport-/Rohdaten manuell versenden

Im Cockpit **Steuerungsreport-/Rohdaten manuell versenden** öffnen, den Dienstleister wählen und den Tag oder Zeitraum für die Rohdaten angeben. **Zur Prüfung an tagessteuerung.lks@lidl.de senden** schickt der Tagessteuerung den aktuellen Steuerungsreport und pro Tag mit passenden Rohdaten eine weitere Excel-Datei. Die Tagessteuerung prüft die Anhänge und leitet die E-Mail anschließend an den ausgewählten Dienstleister weiter.

Für Teleperformance filtert der Versand nach `Location = Teleperformance`, für Concentrix nach `Webhelp` und für Foundever nach `Foundever`. Der Mailversand kann auch ältere Tagesdateien aus der Performance History verwenden.

## Foundever in Summenformeln aufnehmen

`FoundeverFormeln.gs` enthaelt die Funktion
`foundeverErgaenzenUndBisZeile34Fuellen()`. Sie erweitert im aktiven
Arbeitsblatt Formeln mit Teleperformance und Concentrix um Foundever
mit demselben Zellbezug. LKS-1st darf ebenfalls vorkommen, ist aber
keine Voraussetzung. In betroffenen Spalten setzt sie die
Formel in leeren Zellen bis Zeile 34 fort. Vorhandene Inhalte bleiben erhalten.

Beim selben Lauf entfernt die Funktion im Blatt `Foundever` alle addierten
Bezuege auf `Auswertung_Majorel_Skill` (z. B. `+Auswertung_Majorel_Skill!B6`
oder `+Auswertung_Majorel_Skill!O34`). Auch eigenstaendige Argumente in
`SUMME(...)` werden entfernt. Falls ein Majorel-Bezug in einer anderen
Rechenoperation steht, bricht die Funktion mit der Zellposition ab.
Ist `Foundever` das aktive Blatt, werden dort keine Selbstbezuege auf
`Foundever` hinzugefuegt.

In allen Arbeitsblaettern ergaenzt das Skript bei Formeln mit
`Auswertung_TP_Skill` und `Auswertung_Lidl_Skill` oder
`Auswertung_WH_Skill` den Summanden `+Auswertung_FE_Skill`, sofern er
noch fehlt. Das gilt auch fuer zusammengesetzte Namen wie
`TP_Skill_WH_Skill_Lidl_Skill`.

Die Datei `FoundeverFormeln.gs` in das Apps-Script-Projekt der betreffenden
Google-Tabelle uebernehmen und dort die Funktion
`foundeverErgaenzenUndBisZeile34Fuellen()` ausfuehren. Ein GitHub-Push
aktualisiert das Apps-Script-Projekt der Tabelle nicht automatisch.

## FE-Auswertung: Malusformel

Die Formel fuer `X17` mit den Prozentgrenzen in `AB` und den Malussaetzen
in `AC` steht in [formeln/FE-Auswertung-X17-Malus.md](formeln/FE-Auswertung-X17-Malus.md).

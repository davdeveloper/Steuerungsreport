Foundever Ordner Google
https://drive.google.com/drive/folders/1SnMraecpyMgILcNPK-waZ5t_OsCAy0T3

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

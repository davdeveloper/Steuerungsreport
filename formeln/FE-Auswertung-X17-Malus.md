# FE-Auswertung: voraussichtlicher Malus in X17

Die Formel liest die Abnahmequote aus **X16** und die Staffel aus den Spalten **AB** (Text mit Prozentgrenze) und **AC** (Malussatz). Sie sucht die Staffel in den Zeilen 1 bis 30; die genaue Startzeile ist damit unerheblich. Das Ergebnis ist ein **Prozentsatz**, kein Eurobetrag. X17 als Prozent formatieren.

```gs
=WENN(NICHT(ISTZAHL(X16));"Quote in X16 prüfen";WENNFEHLER(LET(gueltig;REGEXMATCH($AB$1:$AB$30;"[0-9]")*($AC$1:$AC$30<>"");labels;FILTER($AB$1:$AB$30;gueltig);saetze;FILTER($AC$1:$AC$30;gueltig);grenzen;ARRAYFORMULA(WERT(REGEXEXTRACT(labels;"[0-9]+(?:,[0-9]+)?")));satz;INDEX(saetze;VERGLEICH(MIN(95;RUNDEN(X16*100;1));grenzen;-1));WENN(ISTZAHL(satz);satz;WERT(REGEXEXTRACT(satz;"-?[0-9]+(?:,[0-9]+)?"))/100));"Staffel AB:AC prüfen"))
```

Die Einträge in AB müssen nach der **ersten Prozentzahl absteigend** stehen, wie auf dem Screenshot: `95 - 100 %`, `Ab 94,9 % und darunter`, `Ab 92,9 % und darunter` usw. AC darf echte Prozentwerte oder Text wie `-1 %` enthalten. Die Quote wird auf eine Nachkommastelle gerundet, passend zur Staffel.

Beispiele: X16 = `95 %` ergibt `0 %`; `94,9 %` ergibt `-1 %`; `92,9 %` ergibt `-2 %`; `70,9 %` ergibt `-13 %`. Unterhalb von 70,9 % bleibt der letzte vorhandene Satz maßgeblich. Für einen Malus **in Euro** fehlt die vertragliche Berechnungsgrundlage; dafür reicht die AB/AC-Staffel allein nicht.

Die Formel bezieht sich auf das im Screenshot gezeigte Blatt. Sie wurde noch nicht in dieser Google-Tabelle ausgeführt; dafür ist der Link zur konkreten Datei nötig. Der sichtbare `#REF!`-Fehler in „Abnahme Monat Gesamt %“ wird durch X17 nicht behoben.

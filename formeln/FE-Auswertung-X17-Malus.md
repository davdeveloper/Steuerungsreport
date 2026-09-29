# FE-Auswertung: voraussichtlicher Malus in X17

Die Formel liest die Abnahmequote aus **X16**, die Staffeltexte aus **AB** und echte Prozentwerte aus **AC**. Sie sucht die Staffel in den Zeilen 1 bis 30; die genaue Startzeile ist damit unerheblich. AC enthält nach dem neuen Screenshot positive Werte wie `1,00 %`. X17 gibt den Malus wie in der ursprünglichen Staffel **negativ** aus (`−1,00 %`). X17 als Prozent formatieren.

```gs
=WENN(NICHT(ISTZAHL(X16));"Quote in X16 prüfen";WENNFEHLER(LET(gueltig;ARRAYFORMULA(REGEXMATCH($AB$1:$AB$30;"[0-9]")*ISTZAHL($AC$1:$AC$30));labels;FILTER($AB$1:$AB$30;gueltig);saetze;FILTER($AC$1:$AC$30;gueltig);grenzen;ARRAYFORMULA(WERT(REGEXEXTRACT(labels;"[0-9]+(?:,[0-9]+)?")));-ABS(INDEX(saetze;VERGLEICH(MIN(95;RUNDEN(X16*100;1));grenzen;-1))));"Staffel AB:AC prüfen"))
```

Die Einträge in AB müssen nach der **ersten Prozentzahl absteigend** stehen, wie auf dem Screenshot: `95 - 100 %`, `Ab 94,9 % und darunter`, `Ab 92,9 % und darunter` usw. Die Werte in AC müssen echte Zahlen im Prozentformat sein: `1,00 %` hat intern den Wert `0,01`. Die Quote wird auf eine Nachkommastelle gerundet, passend zur Staffel. Soll X17 den Malus als positive Höhe anzeigen, `-ABS(...)` durch `ABS(...)` ersetzen.

Beispiele: X16 = `95 %` ergibt `0 %`; `94,9 %` ergibt `-1 %`; `92,9 %` ergibt `-2 %`; `70,9 %` ergibt `-13 %`. Unterhalb von 70,9 % bleibt der letzte vorhandene Satz maßgeblich. Für einen Malus **in Euro** fehlt die vertragliche Berechnungsgrundlage; dafür reicht die AB/AC-Staffel allein nicht.

Die Formel wurde noch nicht in der Tabelle des Screenshots ausgeführt; dafür ist deren Link nötig. Der sichtbare `#REF!`-Fehler in „Abnahme Monat Gesamt %“ wird durch X17 nicht behoben.

# FE-Auswertung: Malussatz in X17

Die Staffel in **AB** und die Malussätze in **AC** sind jetzt echte Prozentwerte. Die AB-Werte stehen absteigend von `100,00 %` bis `70,90 %`; AC enthält die zugehörigen Sätze von `0,00 %` bis `13,00 %`. X16 enthält die Abnahmequote.

**Diese Formel vollständig in X17 einfügen:**

```gs
=WENN(NICHT(ISTZAHL(X16));"Quote in X16 prüfen";WENNFEHLER(LET(gueltig;ARRAYFORMULA(ISTZAHL($AB$1:$AB$40)*ISTZAHL($AC$1:$AC$40));grenzen;FILTER($AB$1:$AB$40;gueltig);saetze;FILTER($AC$1:$AC$40;gueltig);quote;MIN(1;RUNDEN(WENN(X16>1;X16/100;X16);3));INDEX(saetze;VERGLEICH(quote;grenzen;-1)));"Staffel AB:AC prüfen"))
```

**X17 als Prozent mit zwei Dezimalstellen formatieren** (`Format → Zahl → Prozent`). Die Formel gibt einen echten numerischen Prozentwert zurück. Bei X16 = `93,3 %` wählt sie die Grenze `94,90 %` und zeigt `1,00 %`; bei `92,9 %` zeigt sie `2,00 %`; ab `95 %` zeigt sie `0,00 %`. X16 darf intern `0,933` oder als unformatierte Zahl `93,3` vorliegen.

Die Formel wurde in einer Google-Tabelle mit deutschem Gebietsschema und numerisch formatierten AB/AC-Prozentwerten geprüft. X17 in der abgebildeten Tabellenkopie wurde nicht direkt geändert.

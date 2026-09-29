# FE-Auswertung: Malussatz und Malusbetrag

## Aktuelle Staffel aus dem Screenshot

In AB steht in der ersten Staffelzeile der Text `95 - 100`, darunter stehen **Zahlen** wie `94,9`, `92,9` und `90,9`. In AC stehen echte positive Prozentwerte `0 %`, `1 %`, `2 %` usw. Die frühere Formel behandelte AB als reine Textspalte und ist für diesen Aufbau nicht geeignet.

Diese Formel ermittelt **nur den Malussatz**. Sie kann zum Prüfen in eine freie Hilfszelle außerhalb von AB:AC gesetzt werden. Bei `93,3 %` in X16 liefert sie `1 %`; erst ab `95 %` liefert sie `0 %`.

```gs
=WENN(NICHT(ISTZAHL(X16));"Quote in X16 prüfen";WENNFEHLER(LET(quote;WENN(X16>1;X16;X16*100);gueltig;ARRAYFORMULA(ISTZAHL($AB$1:$AB$30)*ISTZAHL($AC$1:$AC$30));grenzen;FILTER($AB$1:$AB$30;gueltig);saetze;FILTER($AC$1:$AC$30;gueltig);WENN(quote>=95;0;INDEX(saetze;VERGLEICH(RUNDEN(quote;1);grenzen;-1))));"Staffel AB:AC prüfen"))
```

Die numerischen Grenzen in AB müssen absteigend sortiert sein. Für einen **Malusbetrag in Euro** braucht X17 zusätzlich die vertragliche Berechnungsbasis. Im Screenshot stehen `Pauschale (€ / Monat)`, `Preis je Kontakt (€)`, `Malus-Regel` und `Kontakte bis Pauschale` noch auf `fehlt`. Deshalb darf X17 derzeit keinen scheinbar gültigen Betrag `0 €` ausgeben. Je nach Vertrag ist die allgemeine Rechnung `−Malussatz × vereinbarte Berechnungsbasis`.

Die verlinkte Datei im Repository (`link.txt`) ist eine andere Tabellenkopie als die Fotos. Deshalb sind die aktuellen Zelladressen der Foundever-Variablen noch nicht verifiziert. Der sichtbare `#REF!`-Fehler bei „Abnahme Monat Gesamt %“ ist eine weitere, unabhängige Formelstelle.

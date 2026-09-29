# FE-Auswertung: Malussatz in X17

X17 soll den Malussatz aus **AC** anzeigen. Die Staffel in **AB** wird vollständig als Text behandelt: `95 - 100`, `94,9`, `92,9` usw. Die Formel funktioniert auch, wenn einzelne AB-Zellen tatsächlich Zahlen sind. AC darf echte Prozentwerte oder Text wie `1,00 %` enthalten.

**Diese Formel vollständig in X17 einsetzen:**

```gs
=WENN(NICHT(ISTZAHL(X16));"Quote in X16 prüfen";WENNFEHLER(LET(gueltig;ARRAYFORMULA(REGEXMATCH($AB$1:$AB$30&"";"[0-9]")*($AC$1:$AC$30<>""));labels;FILTER($AB$1:$AB$30;gueltig);saetze;FILTER($AC$1:$AC$30;gueltig);grenzen;ARRAYFORMULA(WERT(REGEXEXTRACT(labels&"";"[0-9]+(?:,[0-9]+)?")));quote;WENN(X16>1;X16;X16*100);satz;INDEX(saetze;VERGLEICH(MIN(95;RUNDEN(quote;1));grenzen;-1));zahl;WENN(ISTZAHL(satz);satz;WERT(REGEXEXTRACT(REGEXREPLACE(satz&"";"[−–]";"-");"-?[0-9]+(?:,[0-9]+)?"))/100);TEXT(zahl;"0.00%"));"Staffel AB:AC prüfen"))
```

Die Formel nimmt jeweils die **erste Zahl** aus dem AB-Text. Die Grenzen müssen von 95 abwärts sortiert sein. Bei X16 = `93,3` oder `93,3 %` findet sie die Grenze `94,9` und gibt `1,00%` aus. Bei `92,9 %` gibt sie `2,00%` aus; ab `95 %` gibt sie `0,00%` aus.

X17 enthält damit **sichtbaren Prozenttext** und zeigt nicht mehr `0`, wenn das Zellformat auf ganze Zahlen steht. Für spätere Rechnungen mit X17 wäre eine numerische Formel plus Prozentformatierung nötig. Die Formel wurde mit Textgrenzen in AB, gemischten Zahl- und Textsätzen in AC sowie deutschem Tabellen-Gebietsschema geprüft. X17 in der abgebildeten Tabellenkopie wurde nicht direkt geändert.

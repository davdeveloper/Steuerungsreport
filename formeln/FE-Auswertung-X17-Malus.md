# FE-Auswertung: Malussatz in X17

X17 soll **nur den Malussatz aus AC als Prozentwert** anzeigen. X16 enthält die Abnahmequote; die Grenzen in AB stehen als Zahlen ohne Prozentzeichen (`94,9`, `92,9` usw.). Die erste Grenze `95 - 100` ist Text und wird gesondert behandelt. AC enthält echte Prozentwerte (`0,00 %`, `1,00 %` usw.).

**Diese Formel direkt in X17 einfügen:**

```gs
=WENN(NICHT(ISTZAHL(X16));"Quote in X16 prüfen";WENNFEHLER(LET(quote;WENN(X16>1;X16;X16*100);gueltig;ARRAYFORMULA(ISTZAHL($AB$1:$AB$30)*ISTZAHL($AC$1:$AC$30));grenzen;FILTER($AB$1:$AB$30;gueltig);saetze;FILTER($AC$1:$AC$30;gueltig);WENN(quote>=95;0;INDEX(saetze;VERGLEICH(RUNDEN(quote;1);grenzen;-1))));"Staffel AB:AC prüfen"))
```

**Anschließend X17 markieren und `Format → Zahl → Prozent` wählen.** Bei Bedarf die Dezimalstellen zweimal erhöhen. Der Satz `1,00 %` hat intern den Wert `0,01` und wird bei einer Ganzzahlformatierung nur als `0` angezeigt. Das Foto `82346.jpg` zeigt in X17 eine `0` ohne Prozentzeichen; das spricht für genau dieses Anzeigeproblem. Zum Prüfen kann in einer freien Zelle `=X17*100` stehen: Bei einem tatsächlichen Malussatz von `1 %` ergibt das `1`.

Die Formel akzeptiert in X16 sowohl einen echten Prozentwert mit internem Wert `0,933` als auch die Zahl `93,3`. Die numerischen Grenzen in AB müssen absteigend stehen. Sie wählt für `93,3 %` die Grenze `94,9` und damit den AC-Satz `1,00 %`. Ab `95 %` gibt sie `0,00 %` aus; bei `92,9 %` den Satz `2,00 %`. Der Wert wird **nicht** in Euro umgerechnet und nicht negativ gemacht.

Die Formel wurde mit dem neuen AB/AC-Aufbau in einer deutschen Google-Tabelle getestet. Die verlinkte Datei in `link.txt` ist eine andere Tabellenkopie als die Fotos; X17 in der abgebildeten Kopie wurde nicht direkt geändert.

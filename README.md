Hoe speel je het zelf?
1. Download de nieuwste versie van Node.js van https://nodejs.org/en/download
2. Download de .zip met alle code ([downloadlink](<https://github.com/qastrol/slimstemens/archive/refs/heads/main.zip>)), en pak de .zip uit in een nieuwe map
3. Open start_server.bat
4. Als het goed is start dit bestand een lokale server op. Bij De Slimste Mens open je de lokale bestanden display.html en index.html (waarschijnlijk worden die standaard al geopend)
5. Via index.html bedien je als "presentator" het scherm dat voor de toeschouwers en kandidaten te zien is via display.html
6. Als je OBS gebruikt, maak je een browserbron aan met het lokale display.html bestand. Als je via Discord speelt kan je gewoon een browser openen en de browser streamen naar Discord. Je kan ook twee beeldschermen gebruiken als je het spel offline op locatie wilt spelen met iedereen in dezelfde kamer.
7. Veel speelplezier!

De website gebruikt deels de volgende lettertypes: DIN Black, Formula Condensed Bold, Arial (deze lettertypes zijn optioneel, maar met de lettertypes geïnstalleerd werkt het spel beter)

display.html werkt het beste bij een scherm van 1920 pixels breed en 1080 pixels hoog

Configuratie upload (.json en .zip)
1. In index.html kan je bij Configuratie nu zowel een los .json bestand als een .zip bestand uploaden.
2. Voor een portable custom game (ook op een andere pc) gebruik je een .zip met:
	- game-config.json (in root of in een submap)
	- alle gebruikte media (Galerij/Collectief) in dezelfde .zip
3. Bij .zip upload worden paden van Galerij/Collectief automatisch gekoppeld aan bestanden in de .zip.
4. Aanbevolen structuur voor duidelijkheid:
	- game-config.json
	- galerij/...
	- collectief_geheugen/...
	- of media/...

Custom Game Builder
1. Open index.html en klik bij Configuratie op "Custom game maken".
2. Er opent een aparte builderpagina waarin je per ronde vragen kan toevoegen.
3. Het logo staat vast op assets/slimstemens.png (niet meer instelbaar in de builder).
4. Je kan optioneel spelers vooraf instellen (namen + profielfoto's), zodat deze automatisch ingevuld worden bij het laden van de config.
5. Download je custom game als:
	- JSON: alleen configuratiebestand
	- ZIP: configuratie + gekozen mediabestanden in 1 pakket
6. De ZIP kan je daarna direct weer inladen via de normale Configuratie upload.
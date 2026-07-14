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

## Desktop-versie (.exe) met Electron

De huidige webserver-route blijft werken. Je hebt nu 2 manieren om te spelen:

1. Webmodus (bestaande manier)
- Start `start_server.bat` of run `npm start`
- Open `index.html` (host) en `display.html` (scherm)

2. Desktopmodus (Electron)
- Run eenmalig: `npm install`
- Start desktop-app: `npm run desktop`
- Electron start automatisch de lokale WebSocket server en opent host + display venster

### Windows .exe bouwen

1. Installeer dependencies:
- `npm install`

2. Bouw installer (.exe):
- `npm run dist:win`

3. Output:
- Je vindt de bestanden in de map `dist/`
- NSIS installer: installeerbare Windows app
- Portable: los uitvoerbaar bestand zonder installatie

### Troubleshooting (Windows)

Als de build stopt met een fout zoals `Cannot create symbolic link` tijdens `winCodeSign`:

1. Zet Windows Developer Mode aan:
- Instellingen -> Privacy en beveiliging -> Voor ontwikkelaars -> Ontwikkelaarsmodus

2. Sluit en heropen je terminal na het aanzetten.

3. Run de build opnieuw:
- `npm run dist:win` of `npm run dist:portable`

Alternatief: start VS Code of je terminal als Administrator en probeer opnieuw.

### Belangrijk

- De webvariant (`npm start` / `start_server.bat`) blijft volledig beschikbaar.
- De desktopvariant gebruikt dezelfde spelbestanden en dezelfde gameflow.

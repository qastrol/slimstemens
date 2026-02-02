# Game Config Manager - Documentatie

## Overzicht

De Game Config Manager is een systeem waarmee je **aangepaste quizdata** per ronde kan instellen. Je kan een JSON-bestand uploaden met je eigen vragen, en het spel zal deze gebruiken. **Als een ronde niet in het bestand staat of onvolledig is, wordt automatisch teruggevallen op de standaard vragen.**

Dit stelt je in staat om:
- ✓ Verschillende quizsets te gebruiken zonder code aan te passen
- ✓ 3-6-9 vragen vooraf in te stellen (net als andere rondes)
- ✓ Snelle switches tussen verschillende game configuraties
- ✓ Config bestanden te downloaden en delen

## Hoe te gebruiken

### 1. Config bestand uploaden

1. Ga naar de **Configuratie** sectie in de host interface (`index.html`)
2. Klik op "Upload aangepast game config bestand"
3. Selecteer een JSON bestand (bijv. `game-config-example.json`)
4. Klik op "Configuratie laden"
5. Je ziet een bevestiging: "✓ Configuratie geladen"

### 2. Config bestand downloaden

1. Klik op "Huidige config downloaden"
2. Er wordt een JSON bestand gedownload met de huidige configuratie
3. Je kan dit bestand aanpassen en later opnieuw uploaden

### 3. Bestand structuur

Bekijk `game-config-example.json` voor een volledig voorbeeld. Hier zijn de vereiste formaten per ronde:

#### Settings (optioneel)

Je kan per ronde instellen of vragen willekeurig of in volgorde gebruikt worden:

```json
"settings": {
  "threeSixNine": {
    "shuffle": false,
    "description": "false = volgorde zoals in bestand, true = willekeurig (standaard)"
  },
  "opendeur": {"shuffle": true},
  "puzzel": {"shuffle": true},
  "galerij": {"shuffle": true},
  "collectief": {"shuffle": false},
  "finale": {"shuffle": true}
}
```

- **`shuffle: true`** (standaard) - Vragen worden willekeurig gekozen
- **`shuffle: false`** - Vragen worden in volgorde gebruikt zoals in het bestand

#### 3-6-9 Ronde

De 3-6-9 ronde ondersteunt verschillende vraag types met speciale UI elementen:

##### Type 1: Klassieke vragen
```json
{
  "type": "classic",
  "text": "Wat is de hoofdstad van Nederland?",
  "answers": ["Amsterdam"]
}
```

##### Type 2: Meerkeuzevragen
```json
{
  "type": "multiple-choice",
  "text": "Hoeveel poten heeft een spin?",
  "options": {
    "A": "6",
    "B": "8",
    "C": "10",
    "D": "12"
  },
  "correctAnswer": "B"
}
```
- Toont automatisch A/B/C/D opties op scherm
- Host markeert antwoord als goed/fout

##### Type 3: Fotovragen
```json
{
  "type": "photo",
  "text": "Welk gebouw zie je op deze foto?",
  "photoUrl": "assets/rijksmuseum.jpg",
  "answers": ["Rijksmuseum"]
}
```
- Host kan foto tonen/verbergen met knop
- Foto wordt getoond op display scherm

##### Type 4: Audiovragen
```json
{
  "type": "audio",
  "text": "Welke artiest hoor je?",
  "audioUrl": "assets/beatles.mp3",
  "answers": ["The Beatles", "Beatles"]
}
```
- Host kan audio afspelen met knop
- Audio wordt ook op display scherm afgespeeld

##### Type 5: DOE-vragen
```json
{
  "type": "doe",
  "text": "Doe een perfecte imitatie van een politicus",
  "description": "Host kiest beste imitatie"
}
```
- Host selecteert winnaar uit kandidaten
- Geen goed/fout knoppen, alleen kandidaat selectie

##### Type 6: Inschattingsvragen
```json
{
  "type": "estimation",
  "text": "Hoeveel kilometer is het van Amsterdam naar Berlijn?",
  "correctAnswer": "650",
  "unit": "km"
}
```
- Alle kandidaten geven antwoord
- Host selecteert wie het dichtst bij correct antwoord zat
- Correcte antwoord wordt getoond aan host

**Let op:** Gebruik altijd `text` (niet `question`) voor 3-6-9 vragen!

#### Open Deur Ronde
```json
"opendeur": [
  {
    "text": "Wat is...",
    "answers": ["Antwoord"]
  },
  ...
]
```

#### Puzzel Ronde
```json
"puzzel": [
  {
    "link": "Het verband",
    "answers": ["Antwoord1", "Antwoord2", "Antwoord3", "Antwoord4"]
  },
  ...
]
```

#### Galerij Ronde
```json
"galerij": [
  {
    "theme": "Thema naam",
    "images": [
      {
        "src": "pad/naar/afbeelding.jpg",
        "answer": "Antwoord"
      },
      ...
    ]
  }
]
```

#### Collectief Geheugen Ronde
```json
"collectief": [
  {
    "question": "Noem...",
    "answers": ["Antwoord1", "Antwoord2", "Antwoord3", ...]
  },
  ...
]
```

#### Finale Ronde
```json
"finale": [
  {
    "question": "Wat is...",
    "answers": ["Antwoord1", "Antwoord2", "Antwoord3", "Antwoord4", "Antwoord5"]
  },
  ...
]
```
**Let op:** Finale vragen hebben **5 antwoorden** per vraag!

## Voorbeelden

### Alleen 3-6-9 vragen aanpassen

```json
{
  "metadata": {
    "name": "Mijn Quiz",
    "description": "Alleen aangepaste 3-6-9"
  },
  "threeSixNine": [
    {"question": "Vraag 1", "answers": ["Antwoord"]},
    {"question": "Vraag 2", "answers": ["Antwoord"]}
  ],
  "opendeur": [],
  "puzzel": [],
  "galerij": [],
  "collectief": [],
  "finale": []
}
```

De Open Deur, Puzzel, Galerij, Collectief en Finale rondes zullen hun standaard vragen gebruiken.

### Volledige custom game

```json
{
  "metadata": {
    "name": "Volledig Custom",
    "description": "Alle vragen aanpast"
  },
  "threeSixNine": [...],
  "opendeur": [...],
  "puzzel": [...],
  "galerij": [...],
  "collectief": [...],
  "finale": [...]
}
```

## Fallback systeem

Het systeem werkt als volgt:

1. **Als config geladen is met vragen** → Begin met config vragen
2. **Als config vragen onvolledig** → Voeg standaard vragen toe tot compleet
3. **Als ronde helemaal leeg in config** → Gebruik volledig standaard vragen
4. **Als geen config geladen** → Alles gebruikt standaard vragen

Voorbeeld voor Finale:
- Config heeft: 5 custom vragen
- Finale verwacht: 10 vragen
- Resultaat: 5 custom + 5 standaard = 10 vragen ✓

## Technische details

### Functions

#### `loadGameConfig()`
- Laadt automatisch `game-config.json` bij startup
- Fallback naar lege config als bestand niet bestaat

#### `getQuestionsForRound(roundKey, defaultQuestions)`
- Haalt vragen op voor een ronde
- Parameter `roundKey`: `'threeSixNine'`, `'opendeur'`, `'puzzel'`, etc.
- Parameter `defaultQuestions`: standaard vragen als fallback

#### `uploadConfigFile(file)`
- Laadt een geupload JSON bestand
- Valideert de JSON structuur
- Returned een Promise

#### `downloadConfigFile()`
- Download huidige config als JSON bestand
- Bestandsnaam: `game-config-YYYY-MM-DD.json`

#### `setQuestionsForRound(roundKey, questions)`
- Stelt vragen voor ronde in na laden

#### `exportRoundToConfig(roundKey, currentQuestions)`
- Exporteert huidige vragen naar config

## Tips & Tricks

1. **Template**: Start altijd met `game-config-example.json` als template
2. **Validatie**: Test je JSON op [jsonlint.com](https://jsonlint.com) voor je het uploadt
3. **Backup**: Download je config regelmatig als backup
4. **Delen**: Share config bestanden met andere host-operators
5. **Thema's**: Maak config bestanden per thema/seizoen

## Troubleshooting

| Probleem | Oplossing |
|----------|-----------|
| "Selecteer eerst een JSON bestand" | Upload een bestand voordat je klikt |
| "Fout: invalid JSON" | Controleer JSON structuur op jsonlint.com |
| Vragen verschijnen niet | Zorg dat minstens 1 vraag ingevuld is per ronde |
| Fallback werkt niet goed | Laad page opnieuw (F5) |
| Config werkt niet bij volgende ronde | Upload config VOORDAT je spel start |

## Implementatie details

De config-manager is geïntegreerd in alle rond-setups:
- `js/round-3-6-9.js`
- `js/round-opendeur.js`
- `js/round-puzzel.js`
- `js/round-galerij.js`
- `js/round-collectiefgeheugen.js`
- `js/round-finale.js`

Elk roonde-script gebruikt `getQuestionsForRound()` voor vragen met fallback.

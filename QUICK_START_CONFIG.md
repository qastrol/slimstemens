# ⚡ Quick Start - Game Config Manager

## In 2 minuten aan de slag

### Stap 1: Config bestand uploaden
1. Open `index.html` (host interface)
2. Scroll naar **"Configuratie"** sectie
3. Kies een JSON bestand: probeer eerst `game-config-example.json`
4. Klik **"Configuratie laden"**
5. Je ziet: ✓ Configuratie geladen: "Voorbeeld Quiz Config"

### Stap 2: Spel starten
- Voer kandidaatnamen in
- Klik **"Maak spel"**
- Start de eerste ronde
- De config vragen worden gebruikt! 🎉

### Stap 3: Eigen vragen gebruiken
1. Download `game-config-example.json` als template
2. Open in tekstverwerker of code editor
3. Edit je eigen vragen
4. **Optioneel:** Zet `shuffle` op `false` voor volgorde
5. Save als `mijn-config.json`
6. Upload in index.html
7. Klaar! ✓

---

## Shuffle Instelling

**Nieuw!** Je kan per ronde instellen of vragen willekeurig of in volgorde gebruikt worden:

```json
"settings": {
  "threeSixNine": {
    "shuffle": false
  }
}
```

- **`shuffle: true`** - Willekeurige volgorde (standaard)
- **`shuffle: false`** - Vragen in volgorde zoals in bestand

**Gebruik dit voor:**
- Quiz met opbouwende moeilijkheid
- Verhaalvragen in specifieke volgorde
- Thematische progressie

---

## Game-instellingen Forceren

**Nieuw!** Je kan nu ook spel-instellingen forceren via de config, zoals het aantal vragen of foto's:

```json
"settings": {
  "threeSixNine": {
    "shuffle": true,
    "maxQuestions": 15
  },
  "galerij": {
    "shuffle": true,
    "photoCount": 8
  }
}
```

### Beschikbare instellingen per ronde:

**3-6-9 Ronde:**
- `maxQuestions` - Forceert aantal vragen (bijv. 15 in plaats van standaard 12)

**Galerij Ronde:**
- `photoCount` - Forceert aantal foto's per galerij (bijv. 8 in plaats van standaard 10)

**Voordelen:**
- ✓ Geen handmatige aanpassing meer nodig per spel
- ✓ Consistente setup voor herhaalde events
- ✓ Kortere of langere rondes voor verschillende doelgroepen

**Voorbeeld:**
```json
{
  "settings": {
    "threeSixNine": {
      "shuffle": false,
      "maxQuestions": 20,
      "_comment": "20 vragen in vaste volgorde"
    },
    "galerij": {
      "photoCount": 5,
      "_comment": "Snellere galerij met slechts 5 foto's"
    }
  }
}
```

Zie `game-config-with-settings-example.json` voor een volledig voorbeeld!

---

## Meest gestelde vragen

### ❓ Waar plak ik mijn eigen vragen?

Open dit voorbeeld en vervang de vragen:

```json
{
  "metadata": {
    "name": "Mijn Eigen Quiz"
  },
  "threeSixNine": [
    {
      "question": "Mijn eerste vraag?",
      "answers": ["Antwoord1", "Antwoord2"]
    }
  ],
  "opendeur": [],
  "puzzel": [],
  "galerij": [],
  "collectief": [],
  "finale": []
}
```

### ❓ Kan ik maar één ronde aanpassen?

**JA!** Vul alleen die ronde in, de rest wordt automatisch ingevuld:

```json
{
  "threeSixNine": [
    {"question": "Mijn vraag", "answers": ["Antwoord"]}
  ],
  "opendeur": [],
  "puzzel": [],
  "galerij": [],
  "collectief": [],
  "finale": []
}
```

### ❓ Wat als ik niet genoeg vragen heb?

Geen probleem! Het systeem **vullen automatisch aan**:
- Je hebt 5 Finale vragen → Voeg 5 standaard toe
- Je hebt 3 Puzzels → Voeg standaard toe tot compleet
- Het werkt altijd!

### ❓ Mijn vragen verschijnen niet

✓ Zorg dat het JSON bestand **geldige JSON** is (test op [jsonlint.com](https://jsonlint.com))
✓ Upload config **VOOR je het spel start**
✓ Zorg dat minstens **1 vraag** per ronde is ingevuld

### ❓ Kan ik het bestand delen met anderen?

**JA!** Download je config en email het door. Anderen kunnen het uploaden.

---

## Volle format voorbeelden

### 3-6-9 Ronde
```json
"threeSixNine": [
  {
    "text": "Wat is...?",
    "answers": ["Antwoord1", "Antwoord2"],
    "type": "classic"
  },
  {"text": "Wie...?", "answers": ["Naam"], "type": "classic"}
]
```
**LET OP:** Gebruik `text` voor de vraag (niet `question`)!

### Puzzel Ronde
```json
"puzzel": [
  {
    "link": "Het Verband",
    "answers": ["Ding 1", "Ding 2", "Ding 3", "Ding 4"]
  }
]
```

### Galerij Ronde
```json
"galerij": [
  {
    "theme": "Beroemde Personen",
    "images": [
      {"src": "pad/naar/foto.jpg", "answer": "Naam"}
    ]
  }
]
```

### Finale Ronde
```json
"finale": [
  {
    "question": "Wat is...?",
    "answers": ["Antwoord1", "Antwoord2", "Antwoord3", "Antwoord4", "Antwoord5"]
  }
]
```
**LET OP:** Finale heeft **5 antwoorden** per vraag!

---

## Opmaak tipjes

- JSON moet valide zijn (geen komma's na laatste item)
- Tekst tussen `"aanhalingstekens"`
- Arrays met `[]`, objecten met `{}`
- Antwoorden als array: `["Optie1", "Optie2"]`

---

## Backup & Delen

1. **Downloaden**: Klik "Huidige config downloaden"
2. **Delen**: Email het JSON bestand
3. **Terugvinden**: Check je Downloads map

---

Vragen? Kijk in `CONFIG_MANAGER_README.md` voor volledige documentatie.

# 🎯 Game Config Manager - Compleet Overzicht

## 🎉 Wat is geïmplementeerd?

Je hebt nu een **volledig systeem** waarmee je aangepaste quizdata per ronde kan beheren! 

Het systeem werkt als volgt:
1. **Upload een JSON bestand** met je eigen vragen
2. **Het spel gebruikt deze vragen** in plaats van de standaard
3. **Als een ronde niet in het bestand staat** → automatisch fallback naar standaard vragen
4. Je kan **3-6-9 vragen vooraf bepalen** (net als andere rondes)

---

## 📁 Nieuwe Bestanden

### Kernbestanden
```
js/config-manager.js          ← Config management module
game-config.json              ← Jouw custom configuratie (leeg)
game-config-example.json      ← Voorbeeld met alle formaten
```

### Documentatie
```
CONFIG_MANAGER_README.md      ← Volledige handleiding
QUICK_START_CONFIG.md         ← Snelstart (BEGIN HIER!)
IMPLEMENTATION_SUMMARY.md     ← Wat is er gebouwd
ARCHITECTURE_DIAGRAM.md       ← Technische flowcharts
```

### Gewijzigde Bestanden
```
index.html                    ← UI toegevoegd
js/round-3-6-9.js            ← Config support
js/round-opendeur.js         ← Config support
js/round-puzzel.js           ← Config support
js/round-galerij.js          ← Config support
js/round-collectiefgeheugen.js ← Config support
js/round-finale.js           ← Config support
```

---

## 🚀 Hoe te Gebruiken (3 Stappen)

### Stap 1: Download het voorbeeld
Open `game-config-example.json` - dit is je template

### Stap 2: Voeg je eigen vragen in
```json
{
  "metadata": {"name": "Mijn Quiz"},
  "threeSixNine": [
    {"question": "Mijn eerste vraag?", "answers": ["Antwoord1"]}
  ],
  "opendeur": [],
  "puzzel": [],
  "galerij": [],
  "collectief": [],
  "finale": []
}
```

### Stap 3: Upload in index.html
- Open `index.html`
- Ga naar **Configuratie** sectie
- Upload je bestand
- Start het spel! ✓

---

## 💡 Voorbeelden per Ronde

### 3-6-9
```json
"threeSixNine": [
  {"question": "Wat is...?", "answers": ["Antwoord1", "Antwoord2"]},
  {"question": "Wie...?", "answers": ["Naam"]}
]
```

### Open Deur
```json
"opendeur": [
  {"text": "Vraag hier", "answers": ["Antwoord"]}
]
```

### Puzzel
```json
"puzzel": [
  {
    "link": "Het verband",
    "answers": ["Ding1", "Ding2", "Ding3", "Ding4"]
  }
]
```

### Galerij
```json
"galerij": [
  {
    "theme": "Thema",
    "images": [
      {"src": "pad/foto.jpg", "answer": "Antwoord"}
    ]
  }
]
```

### Collectief Geheugen
```json
"collectief": [
  {"question": "Noem...", "answers": ["Antwoord1", "Antwoord2", "..."]}
]
```

### Finale
```json
"finale": [
  {"question": "Vraag", "answers": ["Antwoord1", "Antwoord2"]}
]
```

---

## 🔄 Fallback Systeem

Het systeem is **super slim**:
- Vul je alleen `threeSixNine` in? → Dat gebruikt custom
- Vul je maar 5 Finale vragen in van de 10 nodig? → 5 custom + 5 standaard
- De rest valt automatisch terug op standaard
- Vergeten rondes in te vullen? → Geen probleem!

**Voorbeeld:**
```json
{
  "threeSixNine": [vul je in],  → GEBRUIKT CUSTOM + AANVULLEN
  "opendeur": [],               → FALLBACK COMPLEET
  "puzzel": [3 vragen van 9],   → USES 3 CUSTOM + 6 STANDAARD
  "galerij": [],                → FALLBACK COMPLEET
  "collectief": [],             → FALLBACK COMPLEET
  "finale": []                  → FALLBACK COMPLEET
}
```

---

## 🎮 Praktische Scenario's

### Scenario 1: Kleine Aanpassingen
Je wilt alleen 3-6-9 aanpassen? Geen probleem!
- Vul alleen `threeSixNine` array in
- Upload
- De rest komt van standaard

### Scenario 2: Volledig Custom
Je wilt alles zelf bepalen?
- Vul alle arrays in
- Upload
- Alles is custom!

### Scenario 3: Templates Delen
Je wilt config delen met anderen?
- Download je config
- Email het bestand
- Anderen laden het in hun index.html
- Iedereen speelt dezelfde quiz!

### Scenario 4: Wekelijks Veranderen
Je wilt elke week andere vragen?
- Maak per week 1 bestand
- Upload wanneer nodig
- Upload volgende week een ander bestand

---

## 📋 Checklist

Bij starten:
- [ ] `index.html` openen
- [ ] "Configuratie laden" sectie zien
- [ ] `game-config-example.json` downloaden
- [ ] Je vragen invoeren
- [ ] Bestand uploaden
- [ ] ✓ "Configuratie geladen" zien
- [ ] Spel starten

Bij problemen:
- [ ] Controleer JSON validatie (test op jsonlint.com)
- [ ] Zorg minstens 1 vraag per ronde
- [ ] Upload VOOR je spel start
- [ ] Refresh pagina (F5) als niet werkt

---

## 🔑 Key Features

✅ **Upload eigen vragen** - Drag-and-drop of bestand selecteren
✅ **Download configuratie** - Backup je setup
✅ **Fallback systeem** - Lege rondes worden gevuld
✅ **Flexibel format** - Per ronde ander format
✅ **Geen code nodig** - Zuiver JSON
✅ **Delen** - Email config naar anderen
✅ **Versiebeheer** - Timestamp in bestandsnaam

---

## 📚 Documentatie

**Start hier:**
- `QUICK_START_CONFIG.md` ← Begin met dit!

**Voor details:**
- `CONFIG_MANAGER_README.md` ← Volledige handleiding
- `game-config-example.json` ← Alle voorbeelden

**Voor technische info:**
- `ARCHITECTURE_DIAGRAM.md` ← Flowcharts
- `IMPLEMENTATION_SUMMARY.md` ← Wat is er gebouwd

---

## 🛠️ Troubleshooting

| Probleem | Oplossing |
|----------|-----------|
| "Selecteer eerst een JSON bestand" | Upload een bestand |
| "Fout: invalid JSON" | Check syntax op jsonlint.com |
| Vragen verschijnen niet | Min 1 vraag per ronde nodig |
| Fallback werkt niet | Pagina refreshen (F5) |
| Config werkt niet | Upload VOOR spel start |

---

## 🎯 Volgende Stap

1. Open `QUICK_START_CONFIG.md` 
2. Download `game-config-example.json`
3. Voer je vragen in
4. Upload in `index.html`
5. Enjoy! 🎉

---

## ✨ Pro Tips

💡 **Tip 1:** Maak per thema een apart bestand
💡 **Tip 2:** Backup je config regelmatig
💡 **Tip 3:** Test JSON op jsonlint.com
💡 **Tip 4:** Gebruik consistent format
💡 **Tip 5:** Share met andere game-masters!

---

**Veel speelplezier! 🎮**

Je hebt nu een professioneel configuratie-systeem dat volledig functioneel is en geen technische kennis vereist.

---

*Vragen? Kijk in de README files of controleer de ARCHITECTURE_DIAGRAM.md*

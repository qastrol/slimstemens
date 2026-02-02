# 🗺️ Game Config Manager - Flowchart & Architecture

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      index.html                              │
│                   (Host Interface)                           │
└──────────────────────────┬──────────────────────────────────┘
                           │
                   ┌───────┴───────┐
                   │               │
                   ▼               ▼
        ┌──────────────────┐  ┌──────────────────┐
        │ js/config-manager.js  │  Game Controls   │
        │ (Global Config)   │  │                  │
        └────────┬─────────┘  └──────────────────┘
                 │
         ┌───────┼───────┐
         │       │       │
         ▼       ▼       ▼
    game-config.json  │  Upload Input
    (Startup)        │  (User)
                     │
              ┌──────┴──────┐
              │             │
              ▼             ▼
        Fetch/Parse    FileReader
        game-config    Parse JSON


┌─────────────────────────────────────────────────────────────┐
│                When Round Starts                             │
│                                                               │
│  setupThreeSixNineRound()                                    │
│         │                                                     │
│         ▼                                                     │
│  getQuestionsForRound('threeSixNine', Q_3_6_9)              │
│         │                                                     │
│         ├─ gameConfig['threeSixNine'].length > 0?           │
│         │                                                     │
│         ├─ YES → Use config questions ✓                      │
│         │                                                     │
│         └─ NO → Use Q_3_6_9 (fallback) ✓                     │
│         │                                                     │
│         ▼                                                     │
│  shuffleArray() → perRoundState.questions                    │
│         │                                                     │
│         ▼                                                     │
│  Game Ready!                                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Config Loading Sequence

```
Browser Starts
    │
    ▼
1. index.html geladen
    │
    ├─ <script src="js/config-manager.js"></script>
    │   │
    │   ├─ Variables initialized: gameConfig = null
    │   │
    │   └─ When DOMContentLoaded:
    │       └─ loadGameConfig() executed
    │
    ├─ <script src="js/369vragen.js"></script>
    │   └─ quizQuestions defined
    │
    ├─ <script src="js/round-3-6-9.js"></script>
    │   └─ setupThreeSixNineRound() defined
    │
    └─ Other scripts...

loadGameConfig() runs:
    │
    ├─ fetch('game-config.json')
    │   │
    │   ├─ SUCCESS → Parse JSON
    │   │           └─ gameConfig = config
    │   │
    │   └─ FAIL → gameConfig = getDefaultConfig()
    │
    └─ console.log('Game configuratie geladen')
```

---

## Decision Tree: getQuestionsForRound()

```
getQuestionsForRound(roundKey, defaultQuestions)
    │
    ├─ gameConfig === null?
    │   ├─ YES → return defaultQuestions
    │   └─ NO → continue
    │
    ├─ gameConfig[roundKey] defined?
    │   ├─ NO → return defaultQuestions
    │   └─ YES → continue
    │
    ├─ configQuestions is Array?
    │   ├─ NO → return defaultQuestions
    │   └─ YES → continue
    │
    ├─ configQuestions.length > 0?
    │   ├─ NO  → return defaultQuestions ✓
    │   └─ YES → continue
    │
    └─ configQuestions.length < defaultQuestions.length?
        ├─ YES → Combine:
        │        [configQuestions] + [standaard tot compleet]
        │        return combined ✓
        │
        └─ NO  → return configQuestions ✓
```

---

## Data Flow: Upload Config

```
User selects file
    │
    ▼
File Input Change
    │
    ▼
uploadConfigBtn.click()
    │
    ├─ Check if file selected
    │
    ├─ uploadConfigFile(file)
    │   │
    │   ├─ FileReader.readAsText()
    │   │
    │   ├─ JSON.parse()
    │   │   │
    │   │   ├─ Valid? 
    │   │   │   ├─ YES → gameConfig = config
    │   │   │   │        configLoaded = true
    │   │   │   │        resolve()
    │   │   │   │
    │   │   │   └─ NO → reject(error)
    │   │   │           catch block executes
    │   │
    │   └─ Error? → alert("Invalid JSON")
    │
    ├─ Update configStatus display
    │   └─ "✓ Configuratie geladen: [name]"
    │
    └─ flash("Configuratie succesvol geladen!", 'good')
```

---

## Data Flow: Download Config

```
downloadConfigBtn.click()
    │
    ▼
downloadConfigFile()
    │
    ├─ Check gameConfig !== null
    │
    ├─ JSON.stringify(gameConfig, null, 2)
    │
    ├─ Create Blob
    │
    ├─ Create Object URL
    │
    ├─ Create <a> element
    │
    ├─ Set download attribute
    │   └─ "game-config-YYYY-MM-DD.json"
    │
    ├─ Append to body
    │
    ├─ Trigger click() → Download starts
    │
    ├─ Remove <a> element
    │
    ├─ Revoke Object URL
    │
    └─ flash("Configuratie gedownload!", 'good')
```

---

## Round Integration Points

```
All Rounds Use This Pattern:

setupXxxRound()
    │
    ├─ const questionsToUse = 
    │   getQuestionsForRound('roundKey', defaultQuestions)
    │
    ├─ if (questionsToUse length check fails)
    │   └─ flash("Error") + return
    │
    ├─ Process questions
    │   ├─ shuffleArray()
    │   ├─ Map to format
    │   └─ Set perRoundState.questions
    │
    └─ Game starts with correct questions!

Rounds Updated:
├─ round-3-6-9.js ✓
├─ round-opendeur.js ✓
├─ round-puzzel.js ✓
├─ round-galerij.js ✓
├─ round-collectiefgeheugen.js ✓
└─ round-finale.js ✓
```

---

## Config File Hierarchy

```
game-config.json (Project Level)
    │
    ├─ metadata
    │   ├─ name: "Custom Config"
    │   ├─ description: "..."
    │   └─ created: "2026-02-01"
    │
    ├─ threeSixNine: []
    │   └─ [{question, answers}]
    │
    ├─ opendeur: []
    │   └─ [{text, answers}]
    │
    ├─ puzzel: []
    │   └─ [{link, answers}]
    │
    ├─ galerij: []
    │   └─ [{theme, images}]
    │
    ├─ collectief: []
    │   └─ [{question, answers}]
    │
    └─ finale: []
        └─ [{question, answers}]
```

---

## Error Handling Flow

```
Any Config Operation
    │
    ├─ File not found?
    │   └─ console.warn() → Use default config
    │
    ├─ Invalid JSON?
    │   └─ JSON.parse() error → reject(error)
    │       → alert() to user
    │
    ├─ File read error?
    │   └─ FileReader.onerror → reject()
    │       → alert() to user
    │
    ├─ Element not found?
    │   └─ getElementById() returns null
    │       → listener won't attach
    │
    └─ Question count too low?
        └─ Length check fails → flash("Error")
            → Round doesn't start
```

---

## State Management

```
Global Variables:
├─ gameConfig (object/null)
│   └─ Holds current configuration
│
├─ configLoaded (boolean)
│   └─ Tracks if config was loaded
│
└─ Per Round: perRoundState
    └─ perRoundState.questions = questionsToUse
```

---

## Usage Timeline

```
TIME 0: Browser opens index.html
    └─ config-manager.js loads
    └─ loadGameConfig() attempts fetch
    └─ game-config.json loads or defaults to empty

TIME 1: Host sees "Configuratie" section
    └─ Ready to upload config

TIME 2: Host uploads game-config-example.json
    └─ uploadConfigFile(file)
    └─ gameConfig now has example questions
    └─ Status shows: "✓ Configuratie geladen"

TIME 3: Host clicks "Maak spel"
    └─ Game created with players

TIME 4: Host starts Round 1 (3-6-9)
    └─ setupThreeSixNineRound()
    └─ getQuestionsForRound('threeSixNine', Q_3_6_9)
    └─ Returns config questions (example.json)
    └─ Game uses those questions!

TIME 5: Host can download current config
    └─ Saves as game-config-2026-02-01.json
    └─ Can modify and re-upload later
```

---

## Integration Test Checklist

- [ ] config-manager.js loads first in index.html
- [ ] game-config.json exists (can be empty)
- [ ] getQuestionsForRound() called in each round setup
- [ ] Upload button triggers uploadConfigFile()
- [ ] Download button triggers downloadConfigFile()
- [ ] Config status displays correctly
- [ ] Fallback works when config empty
- [ ] Invalid JSON shows error alert
- [ ] No console errors on load
- [ ] Web Socket still works (independent)

---

**Diagram created: 2026-02-01**
**Last updated: 2026-02-01**

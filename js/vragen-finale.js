// Vragen voor de finale ronde
// De twee overgebleven kandidaten krijgen vragen met 5 mogelijke antwoorden. 
// De kandidaat die dan de laagste score heeft, krijgt als eerste de vraag, daarna mag de andere kandidaat aanvullen.
// Voor elk goed antwoord worden er 20 seconden afgetrokken bij de score van de andere kandidaat.
// Als een kandidaat op 0 seconden komt, is die kandidaat af en wint de andere speler de finale.

const finaleVragen = [
    {
        question: 'Wat weet jij van de piranha?',
        answers: [
            'Vis',
            'Zuid-Amerika',
            'Carnivoor',
            'Scherpe tanden',
            'Zoet water'
        ]
    },
    {
        question: 'Wat weet jij over het sprookje Roodkapje?',
        answers: [
            'Gebroeders Grimm',
            'Wolf',
            'Grootmoeder',
            'Wat heeft u grote ...',
            'Zeg roodkapje waar ga je hene ...'
        ]
    },
    {
        question: 'Wat weet jij over de A2?',
        answers: [
            'Snelweg',
            'Amsterdam',
            'Maastricht',
            'Files',
            'Trajectcontrole'
        ]
    },
    {
        question: 'Welke muziekinstrumenten worden wereldwijd het meest bespeeld?',
        answers: [
            'Gitaar',
            'Piano',
            'Drum',
            'Viool',
            'Saxofoon'
        ]
    },
    {
        question: 'Wat weet jij over Will Smith?',
        answers: [
            'Amerikaan', 
            'Acteur',
            'King Richard',
            'Oscar',
            'The Fresh Prince of Bel-Air'
        ]
    },
    {
        question: 'Wat weet jij over Churchill?',
        answers: [
            'Winston',
            'Brits',
            'Premier',
            'Tweede Wereldoorlog',
            'Nobelprijs'
        ]
    },
    {
        question: 'Welke producten worden het vaakst gekocht bij de tax free winkels bij een luchthaven?',
        answers: [
            'Snoepgoed',
            'Frisdrank',
            'Parfum',
            'Alcohol',
            'Tabak'
        ]
    },
    {
        question: 'Wat weet jij over Dan Brown?',
        answers: [
            'Amerikaans',
            'Schrijver',
            'The Da Vinci Code',
            'Inferno',
            'Thrillers',
        ]
            
    },
    {
        question: 'Uit welke landen komen de meeste astronauten?',
        answers: [
            'Verenigde Staten',
            'Rusland',
            'China',
            'Japan',
            'Duitsland'
        ]
    },
    {
        question: 'Wat weet jij over AC/DC?',
        answers: [
            'Australisch',
            'Rockband',
            'Angus Young',
            'Highway to Hell',
            'Thunderstruck'
        ]
    },
    {
        question: 'Welke losstaande keukenapparaten worden het meest verkocht?',
        answers: [
            'Koffiemachine',
            'Mixer',
            'Airfryer',
            'Waterkoker',
            'Grill'
        ]
    },
    {
        question: 'Wat weet jij over de Tienkamp?',
        answers: [
            'Atletiek',
            'Olympische Spelen',
            'Decathlon',
            'Alleen door mannen',
            'Twee dagen'
        ]
    },
    {
        question: 'Wat weet jij over linzen?',
        answers: [
            'Peulvrucht',
            'Verschillende kleuren',
            'Soep',
            'Vegetarisch',
            'Dal'
        ]
    },
    {
        question: 'Wat weet jij over de filmserie Dune?',
        answers: [
            'Science fiction',
            'Tomothée Chalamet',
            'Zendaya',
            'Woestijn',
            'The spice'

        ]
    },
    {
        question: 'Wat weet jij over de Balalaika?',
        answers: [
            'Muziekinstrument',
            'Snaren',
            'Rusland',
            'Volksmuziek',
            'Driehoekige klankkast (soort gitaar)'
        ]
    },
    {
        question: 'Wat weet jij van de groente wortels?',
        answers: [
            'Peen',
            'Oranje',
            'Goed voor ogen',
            'Hutspot',
            'Sinterklaas'
        ]
    },
    {
        question: 'Wat weet jij van de FIFA?',
        anwers: [
            'Wereldvoetbalbond',
            'WK Voetbal',
            'Gianni Infantino',
            'Zwitserland',
            'Game'
        ]
    },
    {
        question: 'Wat weet jij van de LPF?',
        answers: [
            'Lijst Pim Fortuyn',
            'Veel zetels na moord',
            'Regering',
            'Mat Herren',
            'Immigratie/Integratie'
        ]
    },
    {
        question: 'Wat weet jij van Usher?',
        answers: [
            'Zanger',
            'Verenigde Staten',
            'R&B',
            'Yeah!',
            'Super Bowl'
        ]
    },
    {
        question:  'Wat weet jij van zeewier?',
        answers: [
            'Algen',
            'Zuurstofproductie (fotosynthese)',
            'Kelp',
            'Eetbaar',
            'Nori'
        ]
    },
    {
        question: 'Wat weet jij van Marco Kroon?',
        answers: [
            'Majoor',
            'Willems-orde',
            'Afghanistan',
            'Wildplassen/kikkerpak',
            'Ingrijpen bevrijdingsdag'
        ]
    },
    {
        question: 'Wat weet jij van Alcatraz?',
        answers: [
            'Gevangenis',
            'San Fransisco',
            'Eiland',
            'Escape from Alcatraz',
            'Toeristische attractie'
        ]
    },
    {
        question: 'Wat zijn de vijf meestverkochte producten van Apple?',
        answers: [
            'iPhone',
            'iPad',
            'MacBook',
            'AirPods',
            'Apple Watch'
            ]
    },
    {
        question: 'Wat weet je over de sportvrouw Biles?',
        answers: [
            'Simone',
            'Amerikaanse',
            'Turnster',
            'Olympische Spelen',
            'Wereldkampioen'
        ]
    },
    {
        question: "Er zijn vijf Aziatische landen die beginnen met een I. Welke zijn dat?",
        answers: [
            "India",
            "Indonesië",
            "Iran",
            "Irak",
            "Israël"
        ]
    },
    {
        question: "Wat weet je over Roxy Dekker?",
        answers: [
            "Zangeres",
            "Sugardaddy",
            "Satisfyer",
            "Popprijs",
            "TikTok"
        ]
    },
    {
        question: "Wat weet je van Gran Canaria?",
        answers: [
            "Spanje",
            "Eiland",
            "Las Palmas",
            "Vulkanisch",
            "Seniorenbestemming"
        ]
    },
    {
        question: "Wat weet jij van accijns?",
        answers: [
            "Belasting",
            "Brandstof",
            "Tabak",
            "Alcohol",
            "Gebruik ontmoedigen"
        ]
    },
    {
        question: "Wat weet jij over de pretzel?",
        answers: [
            "Broodje",
            "Duitsland",
            "Krakeling",
            "Zoutkorrels",
            "Verenigde Staten"
        ]
    },
    {
        question: "Wat weet jij over Aleksandr Loekasjenko?",
        answers: [
            "Wit-Rusland",
            "President",
            "Dictator",
            "Immuniteit",
            "Bondgenoot Rusland"
        ]
    },
    {
        question: "Wat weet jij van de eeland?",
        answers: [
            "Zoogdier",
            "Gewei",
            "Hertachtigen",
            "Elandtest",
            "Noordelijke gebieden"
        ]
    },
    {
        question: "Wat weet jij over Olivia Rodrigo?",
        answers: [
            "Zangeres",
            "Verenigde Staten",
            "Drivers License",
            "Actrice",
            "Streaming Records"
        ]
    },
    {
        question: "Wat weet jij van het TV-programma The Apprentice?",
        answers: [
            "Opvolger",
            "Verenigde Staten",
            "Donald Trump",
            "Afvalrace",
            "You're fired!"
        ]
    },
    {
        question: "Wat weet jij over de sombrero?",
        answers: [
            "Hoed",
            "Mexico",
            "Stro",
            "Zonbescherming",
            "Grote rand"
        ]
    },
    {
        question: "Wat zijn de vijf grootste Amerikaanse staten die beginnen met de letter 'M'?",
        answers: [
            "Michigan",
            "Massachusetts",
            "Missouri",
            "Maryland",
            "Minnesota"
        ]   
    },
    {
        question: "Wat zijn de vijf grootste Amerikaanse staten die beginnen met de letter 'N'?",
        answers: [
            "New York",
            "North Carolina",
            "New Jersey",
            "Nevada",
            "New Mexico"
        ]
    },
    {
        question: "Wat zijn de vijf Europese landen die beginnen met de letter 'S'?",
        answers: [
            "Spanje",
            "San Marino",
            "Slovenië",
            "Servië",
            "Slowakije"
        ]
    },
    {
        question: "Wat weet jij over de iPad?",
        answers: [
            "Touchscreen",
            "Apple",
            "Tablet",
            "Hype",
            "iOS"
        ]
    },
    

];


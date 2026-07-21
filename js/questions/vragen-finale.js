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
    {
        question: "Wat weet u over de ziekte Anorexia Nervosa?",
        answers: [
            "Eetstoornis",
            "Mager",
            "Psychisch",
            "Ziektebeeld",
            "Boulimia"
        ]
    },
    {
        question: "Wat weet u over de man die Pistorius heet?",
        answers: [
            "Oscar",
            "Zuid-Afrika",
            "Reeva Steenkamp",
            "Blade runner",
            "Moord"
        ]
    },
    {
        question: "Wat weet u over Gerrit Komrij?",
        answers: [
            "Nederland",
            "Dichter",
            "Voor de mannen",
            "Overleden",
            "Dichter des Vaderlands"
        ]
    },
    {
        question: "Wie is Courtney Love?",
        answers: [
            "Zangeres",
            "Kurt Cobain",
            "Drugs",
            "Amerikaanse",
            "Hole"
        ]
    },
    {
        question: "Wat weet u over Griekenland?",
        answers: [
            "Eiland",
            "Acropolis",
            "Crisis",
            "Middellandse Zee",
            "Athene"
        ]
    },
    {
        question: "Wat weet u over Robert De Niro?",
        answers: [
            "Acteur",
            "Taxi Driver",
            "Amerikaan",
            "Oscar",
            "The Godfather Part II"
        ]
    },
    {
        question: "Wat weet u over Wagner?",
        answers: [
            "Richard",
            "Opera",
            "Duitser",
            "Nibelungenring",
            "Bayreuth"
        ]
    },
    {
        question: "Wat weet u over een G-plek?",
        answers: [
            "Orgasme",
            "Grafenberg",
            "Ligging",
            "Niet-clitoraal",
            "Vrouw"
        ]
    },
    {
        question: "Wat weet u over Goedele Liekens?",
        answers: [
            "Seksuologe",
            "Miss België",
            "Televisie",
            "Psychologe",
            "Vlaams"
        ]
    },
    {
        question: "Wat weet u over Haïti?",
        answers: [
            "Aardbeving",
            "Eiland",
            "Port-au-Prince",
            "Caraïbische Zee",
            "Voodoo"
        ]
    },
    {
        question: "Wat weet u over Pamela Anderson?",
        answers: [
            "Borsten",
            "Baywatch",
            "Video",
            "Tommy Lee",
            "Playboy"
        ]
    },
    {
        question: "Wat weet u over Thailand?",
        answers: [
            "Bangkok",
            "Sekstoerisme",
            "Bhumibol",
            "Siam",
            "Buddhisme"
        ]
    },
    {
        question: "Wat weet u over Isaac Newton?",
        answers: [
            "Isaac",
            "Brit",
            "Wetenschapper",
            "Zwaartekracht",
            "Appel"
        ]
    },
    {
        question: "Wat weet u over MTV?",
        answers: [
            "Amerikaans",
            "Music Television",
            "Videoclips",
            "Reality tv",
            "Music awards"
        ]
    },
    {
        question: "Wat weet u over Johnny Cash?",
        answers: [
            "Amerikaan",
            "Zanger",
            "Country",
            "Walk the line",
            "Man in Black"
        ]
    },
    {
        question: "Wat weet u over ijshockey?",
        answers: [
            "Puck",
            "Stick",
            "Beschermende kleding",
            "Canada",
            "Schaatsen"
        ]
    },
    {
        question: "Wat weet u over de jacuzzi?",
        answers: [
            "Bubbelbad",
            "Verwarmd",
            "Wellness (sauna)",
            "In de tuin",
            "Jets"
        ]
    },
    {
        question: "Wat weet je over de vulkaanuitbarsting in IJsland (2010)?",
        answers: [
            "Eyjafjallajökull",
            "Aswolk",
            "Vliegverkeer ontregeld",
            "IJsland",
            "Gletsjer"
        ]
    },
    {
        question: "Wat weet je over Antonio Vivaldi?",
        answers: [
            "De vier seizoenen",
            "Componist",
            "Viool",
            "Barok",
            "Italië"
        ]
    },
    {
        question: "Wat weet je over James Ensor?",
        answers: [
            "Kunstschilder",
            "Maskers",
            "Oostende",
            "Expressionisme",
            "België"
        ]
    },
    {
        question: "Wat weet je over Heinrich Himmler?",
        answers: [
            "SS",
            "Nazi",
            "Tweede Wereldoorlog",
            "Zelfmoord",
            "Holocaust"
        ]
    },
    {
        question: "Wat weet je over Professor Barabas?",
        answers: [
            "Suske en Wiske",
            "Teletijdmachine",
            "Uitvinder",
            "Willy Vandersteen",
            "Gyronef"
        ]
    },
    {
        question: "Wat weet je over 'Le Quatorze Juillet'?",
        answers: [
            "14 juli",
            "Franse nationale feestdag",
            "Bestorming van de Bastille",
            "1789",
            "Parijs"
        ]
    },
    {
        question: "Wat weet je over Bruce Springsteen?",
        answers: [
            "The Boss",
            "Amerikaan",
            "Born in the U.S.A.",
            "Rockzanger",
            "E Street Band"
        ]
    },
    {
        question: "Wat weet je over Homeros?",
        answers: [
            "Ilias",
            "Odyssee",
            "Griekenland",
            "Dichter",
            "Troje"
        ]
    },
    {
        question: "Wat weet je over de Dow Jones?",
        answers: [
            "Beurs",
            "Aandelenindex",
            "New York",
            "Wall Street",
            "Industrieel gemiddelde"
        ]
    },
    {
        question: "Wat weet je over Michael Bloomberg?",
        answers: [
            "Burgemeester",
            "New York",
            "Zakenman",
            "Democraat",
            "Miljardair"
        ]
    },
    {
        question: "Wat weet je over diabetes?",
        answers: [
            "Insuline",
            "Suikerziekte",
            "Alvleesklier",
            "Spuiten",
            "Glucose"
        ]
    },
    {
        question: "Wat weet je over de Costa Concordia?",
        answers: [
            "Ramp",
            "Italië",
            "Kapitein Schettino",
            "Cruiseschip",
            "Kapseizen"
        ]
    },
    {
        question: "Wat weet je over de pauselijke zegen 'Urbi et Orbi'?",
        answers: [
            "Rome",
            "Paus",
            "Sint-Pietersplein",
            "Kerstmis of Pasen",
            "Stad en wereld"
        ]
    },
    {
        question: "Wat weet je over de bende van Al Capone?",
        answers: [
            "Chicago",
            "Maffia",
            "Drooglegging",
            "Gangster",
            "Belastingontduiking"
        ]
    },
    {
        question: "Wat weet je over Nelson Mandela?",
        answers: [
            "Zuid-Afrika",
            "Apartheid",
            "Robbeneiland",
            "President",
            "Madiba"
        ]
    },
    {
        question: "Wat weet je over de Titanic?",
        answers: [
            "Ijsberg",
            "1912",
            "Onzinkbaar",
            "Leonardo DiCaprio",
            "Atlantische Oceaan"
        ]
    },
    {
        question: "Wat weet je over het Vaticaan?",
        answers: [
            "Paus",
            "Rome",
            "Kleinste land",
            "Katholiek",
            "Sint-Pietersbasiliek"
        ]
    },
    {
        question: "Wat weet je over de Tour de France?",
        answers: [
            "Wielrennen",
            "Frankrijk",
            "Gele trui",
            "Parijs",
            "Champs-Élysées"
        ]
    },
    {
        question: "Wat weet je over de Berlijnse Muur?",
        answers: [
            "Duitsland",
            "Koude Oorlog",
            "1989",
            "IJzeren Gordijn",
            "Oost en West"
        ]
    },
    {
        question: "Wat weet je over de Olympische Spelen?",
        answers: [
            "Griekenland",
            "Vijf ringen",
            "Goud",
            "Sportevenement",
            "Zomer en Winter"
        ]
    },
    {
        question: "Wat weet je over de Mona Lisa?",
        answers: [
            "Leonardo da Vinci",
            "Louvre",
            "Glimlach",
            "Schilderij",
            "Parijs"
        ]
    },
    {
        question: "Wat weet je over de maanlanding?",
        answers: [
            "1969",
            "Neil Armstrong",
            "Apollo 11",
            "NASA",
            "Buzz Aldrin"
        ]
    },
    {
        question: "Wat weet je over de Rode Zee?",
        answers: [
            "Egypte",
            "Zout water",
            "Duiken",
            "Mozes",
            "Midden-Oosten"
        ]
    },
    {
        question: "Wat weet je over de Euro?",
        answers: [
            "Munteenheid",
            "Europa",
            "ECB",
            "Bankbiljetten",
            "Muntunie"
        ]
    },
    {
        question: "Wat weet je over de Sahara?",
        answers: [
            "Woestijn",
            "Afrika",
            "Zand",
            "Warmte",
            "Kamelen"
        ]
    },
    {
        question: "Wat weet je over de Nobelprijs?",
        answers: [
            "Alfred Nobel",
            "Zweden",
            "Vrede",
            "Wetenschap",
            "Onderscheiding"
        ]
    },
    {
        question: "Wat weet je over de Amazonerivier?",
        answers: [
            "Brazilië",
            "Regenwoud",
            "Zuid-Amerika",
            "Grootste rivier",
            "Piranha's"
        ]
    },
    {
        question: "Wat weet je over de Rolling Stones?",
        answers: [
            "Mick Jagger",
            "Rockband",
            "Engeland",
            "Tong-logo",
            "Keith Richards"
        ]
    },
    {
        question: "Wat weet je over de Grand Canyon?",
        answers: [
            "Verenigde Staten",
            "Arizona",
            "Colorado rivier",
            "Nationale parken",
            "Erosie"
        ]
    },
    {
        question: "Wat weet je over de Nobelprijs voor de Vrede?",
        answers: [
            "Oslo",
            "Onderscheiding",
            "Internationaal",
            "Vrede",
            "Noorwegen"
        ]
    },
    {
        question: "Wat weet je over de FBI?",
        answers: [
            "Amerika",
            "Recherche",
            "Federal Bureau of Investigation",
            "Washington",
            "Kash Patel"
        ]
    },
    {
        question: "Wat weet je over de film 'The Godfather'?",
        answers: [
            "Maffia",
            "Marlon Brando",
            "Francis Ford Coppola",
            "Don Corleone",
            "Al Pacino"
        ]
    },
    {
        question: "Wat weet je over de Statue of Liberty?",
        answers: [
            "New York",
            "Frankrijk",
            "Vrijheidsbeeld",
            "Fakkel",
            "Parijs"
        ]
    },
    {
        question: "Wat weet je over de Eerste Wereldoorlog?",
        answers: [
            "Loopgraven",
            "1914-1918",
            "Duitsland",
            "Wapenstilstand",
            "Ieper"
        ]
    },
    {
        question: "Wat weet je over de Mount Everest?",
        answers: [
            "Hoogste berg",
            "Nepal",
            "Himalaya",
            "Sherpa's",
            "Edmund Hillary"
        ]
    },
    

];


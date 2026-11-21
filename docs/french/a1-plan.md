# French A1 course plan (LevelUp `fr-a1`)

Goal: a complete CEFR A1 French course in the app, next to German A1, that covers every point of the syllabus outline (`a1-syllabus-outline.md`, from simplyfrench.in) and prepares for the **DELF A1** exam. Standard metropolitan French, English explanations, a Latin-letter and a Devanagari (Hindi) pronunciation hint for every word, neural audio for everything that is read aloud.

All study material is original and lives in the repo:

| What | Where |
|---|---|
| Words (by theme) | `content/fr-a1/words/NN-<theme>.md` |
| Grammar chapters | `content/fr-a1/grammar/NN.md` |
| Phrase topics | `content/fr-a1/phrases.md` |
| Lesson order | `content/fr-a1/path.md` |
| Build | `uv run tools/build_fr_content.py` → `app/data/fr-a1.json` + `tools/audio_manifest_fr.json` |
| Audio | `uv run tools/fetch_audio.py --lang fr` (edge-tts, `fr-FR-DeniseNeural`) → `app/audio/<id>.mp3` |

## Size (targets)

- **897 words** in 22 themes, 75 vocabulary lessons of ~12 words. Every word: French, English, type, theme, gender + plural for nouns (feminine form for adjectives, jobs and nationalities), verb forms for verbs, 2 example sentences with English, pronunciation hints.
- **23 grammar chapters** (reader + practice questions, long chapters split into parts automatically).
- **16 phrase topics** (264 phrases) with registers marked **(polite)** = vous and **(friends)** = tu.
- About 12 weeks at ~1 lesson a day (the app's own pace and daily goal adapt to the learner's dates).

## Syllabus coverage

### Can-do goals → where
| Can-do | Words | Grammar | Phrases |
|---|---|---|---|
| Greet and introduce yourself | greetings, people | 2, 3, 4 | greetings, introductions |
| Say where you live | people, countries, town | 17 | introductions, personal info |
| Describe your family | family | 13, 12 | family & hobbies |
| Likes and dislikes | hobbies, food | 4, 9, 23 | likes & opinions |
| Simple shopping | shopping, food, numbers | 8, 14, 15, 18 | shopping, café |
| Tell the time and date | time, calendar | 16 | time & appointments |
| Accept and refuse politely | greetings | 18 | inviting, accepting, refusing |
| Understand simple notices and posters | town, travel, classroom | 19 (imperative), 9 (interdit / ne … pas) | instructions & notices |
| Fill in basic forms | people (nom, prénom, adresse, date de naissance …) | 15, 16 | personal info |
| Write postcards and messages | all | 23 | writing messages, emails, postcards |

### Grammar points → chapters
| Syllabus point | Ch |
|---|---|
| Pronunciation, alphabet, spelling your name | 1 |
| Personal pronouns, tu / vous | 2 |
| Present tense: être, avoir | 3 |
| Present tense: -er verbs | 4 |
| Present tense: irregular verbs (aller, faire, venir, prendre, vouloir, pouvoir, -ir / -re) | 5 |
| Gender and number of nouns; professions (masculine / feminine, no article after être) | 6 |
| Definite and indefinite articles (le / la / l' / les, un / une / des) | 7 |
| Countable / uncountable nouns: the partitive; expressions of quantity | 8 |
| Affirmative and negative sentences (ne … pas, pas de, ne … jamais / rien / plus) | 9 |
| Asking questions; question words | 10 |
| "It is / this is / here is / there is": c'est, il est, voici, voilà, il y a | 11 |
| Adjective agreement and position; descriptive words | 12 |
| Possession: possessive adjectives, de, à moi | 13 |
| Demonstrative adjectives (ce, cet, cette, ces) | 14 |
| Numbers, prices, age, phone numbers | 15 |
| Time and date expressions | 16 |
| Place and location: à / en / au / aux, chez, prepositions of place, au / du | 17 |
| Polite requests and wants: je voudrais, pouvoir, vouloir; accepting / refusing | 18 |
| Basic instructions and advice: the imperative, il faut | 19 |
| Weather expressions (il fait, il pleut, il neige) | 20 |
| Reflexive verbs and the daily routine (s'appeler, se lever) | 21 |
| Talking about plans and the past: futur proche, a first passé composé (DELF A1 uses both) | 22 |
| Basic connectors; writing an informal letter, a postcard, an email | 23 |

### Sociocultural → where
Greetings and introductions (phrases, Ch 2) · politeness and etiquette, bises, Madame / Monsieur (phrases tips) · tu vs vous (Ch 2, every phrase marked polite / friends) · wants and polite requests (Ch 18, phrases) · informal letter, postcard, email (Ch 23, writing phrases).

### Vocabulary themes → word files
| # | Theme (file) | Syllabus themes |
|---|---|---|
| 01 | Numbers | numbers |
| 02 | Greetings & politeness | (speaking functions) |
| 03 | People & personal details | names, place of residence, marital status, contact details, forms |
| 04 | Countries, cities & nationalities | nationalities, countries and cities |
| 05 | Family | family |
| 06 | Jobs & work | professions |
| 07 | Describing people & things | descriptive words |
| 08 | Colours | colours |
| 09 | Days, months, seasons | days of the week, seasons, time and dates |
| 10 | Time & how often | time and dates |
| 11 | Classroom & belongings | classroom objects, personal belongings |
| 12 | Home | place of residence |
| 13 | Food & drink | (shopping, café) |
| 14 | Shopping, money & clothes | prices and shopping |
| 15 | Town, places & directions | places |
| 16 | Transport & travel | places |
| 17 | Hobbies & free time | hobbies |
| 18 | Weather & nature | weather and climate, seasons |
| 19 | Body & health | (services) |
| 20 | Everyday verbs | daily routine |
| 21 | Question words & pronouns | (asking for information) |
| 22 | Small words: prepositions, connectors, adverbs | basic connectors, location |
The alphabet and names are taught in Ch 1 (letter names with audio, spelling questions).

### Speaking functions → phrase topics (16)
| Phrase topic | Speaking functions |
|---|---|
| Greetings and saying goodbye | greeting and saying goodbye |
| Polite basics | politeness, thanks, apologies |
| When you don't understand | asking for clarification, spelling |
| Introducing yourself and others | introducing yourself and others, age, nationality, profession |
| Personal information and forms | exchanging personal information, contact details, spelling your name |
| Family and hobbies | family and hobbies, daily routine |
| Likes, opinions, agreeing and disagreeing | likes / dislikes, agreeing or disagreeing |
| Describing people and things | describing people and objects, ownership |
| Shopping and prices | prices, quantity, ownership |
| At the café and restaurant | enquiring about services, polite requests |
| Time, dates and appointments | time and dates |
| Places and directions | places and locations, simple directions |
| Services: hotel, post office, station, doctor | enquiring about services, asking for and giving information |
| Inviting, accepting and refusing | accepting or refusing politely |
| Instructions, advice and notices | basic instructions and advice, understanding notices |
| Weather and small talk; writing messages | weather, simple conversations, postcards / emails |

## Lesson order (12 weeks, `content/fr-a1/path.md`)
Each week mixes ~5–6 vocabulary lessons, 2 grammar chapters and 1–2 phrase topics, in this order (the app spreads items so a topic never repeats back to back):

1. Ch 1 sounds and alphabet (short parts spread over the first weeks) · numbers 0–20 · greetings · Ch 2 pronouns and tu / vous · phrases: greetings, polite basics, when you don't understand.
2. Ch 3 être / avoir · Ch 4 -er verbs · people and personal details · countries and nationalities · phrases: introducing yourself, personal information.
3. Ch 6 gender, professions · Ch 7 articles · family · jobs · numbers to 100 · phrases: family and hobbies.
4. Ch 10 questions · Ch 11 c'est / il y a · classroom and belongings · question words · Ch 15 numbers, prices, age.
5. Ch 12 adjectives · Ch 9 negation · describing words · colours · home · phrases: describing people and things.
6. Ch 5 irregular verbs · Ch 16 time and dates · days / months · time words · everyday verbs · phrases: time and appointments.
7. Ch 13 possessives · Ch 8 partitive and quantities · food and drink · phrases: café and restaurant.
8. Ch 14 demonstratives · Ch 18 polite requests · shopping and clothes · phrases: shopping.
9. Ch 17 places · Ch 19 imperative · town and directions · transport · phrases: directions, instructions and notices.
10. Ch 20 weather · Ch 21 reflexive verbs · weather · hobbies · body and health · phrases: likes and opinions, services.
11. Ch 22 futur proche / passé composé · Ch 23 connectors and writing · small words · phrases: inviting / accepting / refusing, weather and messages.
12. DELF A1 practice (see below), reviews, rest.

## DELF A1 exam overview (approximate)

Figures below are from general knowledge of the DELF A1 "tout public" exam, **not verified against the official page**: France Éducation international's site (france-education-international.fr, DELF A1) blocked automated reading on 2026-11-21. Check the official page or your exam centre before the exam.

| Part | What you do | Time (approx.) | Points |
|---|---|---|---|
| Compréhension de l'oral (listening) | 3–4 short recordings (announcements, messages, dialogues), each played twice; tick answers | ~20 min | /25 |
| Compréhension des écrits (reading) | 4–5 short texts (notices, messages, a simple letter, an ad); answer questions | ~30 min | /25 |
| Production écrite (writing) | fill in a form; write a short message / postcard (~40–50 words) | ~30 min | /25 |
| Production orale (speaking) | 1 guided interview (about you), 2 exchange of information (questions from word cards), 3 role-play (buying something with play money / prices); ~10 min preparation for parts 2–3 | 5–7 min | /25 |

- Total **/100**. Pass: **50/100**, with **at least 5/25 in each part**.
- The three written parts are taken together (about 1 h 20); the speaking test is separate.
- In the speaking interview the examiner uses **vous**; in role-plays you may be asked to use tu or vous: follow the card.

### How the app prepares each part
- Listening: every word, example and phrase has audio; "What do you hear?" and "What does this mean?" listening steps; Ch 1 listening questions.
- Reading: example sentences, notices and instructions phrases (Ch 19), the grammar reader.
- Writing: form words (nom, prénom, date de naissance, adresse …), Ch 23 postcard / email / message models, typing exercises with accent help.
- Speaking: "Say it in French" (build or type whole phrases) and 🎤 Speak it (fr-FR speech recognition) for phrases; introductions, questions and shopping role-play phrases.

## Pronunciation hints
- Latin hint, last syllable in CAPITALS (French stress falls on the last syllable): bonjour = bohñ-ZHOOR.
- Nasal vowels: **ahñ** = an / en (France = FRAHÑS), **ohñ** = on (bon = BOHÑ), **añ** = in / ain / un (vin = VAÑ). **ü** = French u (say "ee" with round lips), **uh** = the soft e / eu (le = LUH, deux = DUH), **zh** = the s of "measure" (je = ZHUH), **r** = soft throat r.
- The Hindi (Devanagari) hint is made from the Latin hint by the build script (nasal = anusvara: bon = बों).

## Built (2026-11-21)
897 words · 23 grammar chapters (Ch 1 in 8 short parts with audio and listening questions) · 16 phrase topics / 264 phrases · 114 path items (151 once long chapters are split into parts) · 2,944 audio clips (fr-FR-DeniseNeural).

## Checks
- The build refuses to write the JSON when a noun has no gender / article, a word has fewer than 2 examples, a question has no answer, or a path item is missing.
- Accuracy pass: genders and agreements, accents, elision (l', j', qu'), liaison noted in hints where it matters.

# German A1 roadmap v2: situation first

Status: **built 2026-11-24 on the working tree, not deployed** (see "Build status" below; the sections after it are the original proposal, kept for reasoning). It replaces the remap options in `docs/decisions/feedback-decisions-2026-11-24.md` §3 (report 0bf8) once you approve it. Evidence behind the choices is in `docs/reviews/duolingo-lesson-flow-2026-11-24.md` and `duolingo-vs-levelup-track-2026-11-24.md` (not committed).

## Build status (2026-11-24)

Decisions taken: **schedule all 821 words** (not core-only), keep the 12-week frame as the reference calendar, **build all units before shipping**, **everyone restarts** (no migration; an online backup of all progress was taken first), and **write the missing grammar pieces**.

Built
- **34 situation units** (units 1-34). Unit 35 (mock exams) has no study items; use the existing review and practice features until exam item sets exist.
- **All 821 words placed** in exactly one unit (12-30 words each, 4-22 core), core words first and extras after (`content/de-a1/word_units.py`, longest-keyword match, the build fails on any unplaced or ambiguous word).
- **All 208 old phrases placed** (long topics split by situation) plus **97 new phrases** (`content/de-a1/units.py`); 305 phrases in 34 sections. 108 new audio clips fetched (de-de-KatjaNeural); audio is not in git, so rsync at ship time.
- **26 grammar chapters**: the 20 existing ones placed at their first-use unit, plus **six new** (g21 und/oder/mit/aber/denn, g22 accusative pronouns, g23 a little dative, g24 war/hatte, g25 werden, g26 polite requests) with practice questions (`content/de-a1/new_chapters.py`).
- **Generator:** `tools/build_de_units.py`, run as the last step of `tools/export_data.py` (one command: `uv run tools/export_data.py`, then `uv run tools/fetch_audio.py`).
- **App:** unit headers on the path (can-do goal, stage, 📖 Guidebook), a Guidebook sheet (key phrases with audio, grammar tips, start/continue), unit line on the Today card and item sheets, no topic re-spreading for unit content, a one-time progress reset (`roadmapReset`, `settings.roadmapV`), SW cache v79.
- **Tested** on the scratch server: all 106 path items start, the picker order (words, phrases, then the grammar tip), new chapters run to "Well done", the reset keeps gems and streak days and does not repeat.

Differences from the proposal (be aware)
- **Load:** with all words scheduled the simulated peak is about **54 cards a day vs 59 for the old plan** (core-only would be about 34), and the first weeks are heavier than before. In the app the real pace comes from each learner's own start and target dates (about 9 new words a day over 92 days, 12 a day over 68 days). So the gain is structure, not volume; the lever is a longer date. The reset moves a learner's target to today + 92 days unless it is already more than 84 days away.
- **Grammar is placed whole at the first-use unit** (the app still splits long chapters into parts). The "spread chapters across several units" and spiral revisit cards are not built.
- **Not built:** checkpoint (consolidation) days, spiral revisit cards, unit-35 mock exams and exam item sets, and the lesson-mechanics quick wins (combo colour on the bar, labelled mistakes round, listening skip that substitutes a text item, previous-lesson distractors).
- **Phrases:** units that had no phrase topic got 3-6 new phrases, not always the planned 5; unit 1 has 20 phrases (7 parts), the largest.

Ship checklist: rsync `app/audio/`, deploy (versioned tag), expect every learner's German A1 to reset once on first load; backup is `~/levelup-backups/progress-before-a1-reset-20261124-110732.tar.gz` (droplet and Mac).

## 1. Why change

- **Your first-hand experience:** word-list-first and grammar-first is not working; situation-first (Duolingo's way) works better.
- **The diagnosis we already made** (decisions §3): the daily load climbs about 2.7x over 12 weeks, the review pile grows 5x, grammar is lumpy and back-loaded, five verb lessons come in a row (60 verbs), and the late lessons are mostly non-core words (the core share falls from 75 % to 43 %).
- **What Duolingo does instead** (read across all 1,030 units): every unit is one real situation with a can-do goal; grammar is 1-3 tiny tips about phrases the learner has just met, revisited 3-6 times; a lesson is about 11 exercises, easy to hard, with production last.
- **What stays:** teach-before-test intro cards, the 60 % pass mark, SM-2 reviews, the exam phrase bank, "Say it", the 🎤 check, A1 %.

## 2. The idea in one line

Today: 63 topic word lists + 20 grammar chapters + 14 phrase topics, scheduled side by side by weights.
New: **35 units, each one situation**. A unit = a can-do goal + 5 key phrases + 12-16 core words + 1-3 grammar riders + 4 lessons + (every third unit) a checkpoint.

## 3. What to copy from Duolingo

**Copy into the curriculum (this roadmap)**
| What | Evidence | Verdict | Effort |
|---|---|---|---|
| One real-life situation per unit with a can-do goal | S1 unit titles ("Order at a café", "Introduce your family", "Ask for directions") | **Copy: the core of this plan** | M |
| Grammar as 1-3 short tips attached to phrases already met ("like English / unlike English") | 1.9 tips per unit in Sections 2-4 | **Copy** | S-M |
| A set of 5 key phrases per unit (audio, tap-to-translate, English line), shown before the unit and reused as the lesson's hard sentences | Guidebook; the hard stretch of lessons 2 and 3 reused its patterns (two items were verbatim guidebook phrases) | **Copy** | M |
| Spiral: re-teach each topic 3-6 times | gender in units 4 and 9, then S2 and S3; adjective endings in ~9 units | **Copy** (short "revisit" cards) | S |
| 4 lessons per unit, about 4 new words per lesson | Unit 1; lessons 2 and 3 | **Copy**: matches our 4-word parts, so no engine change | free |
| Stage titles with a can-do line and a CEFR tag | Sections page ("Hallo!", "A1") | **Copy light** (stage titles) | S |

**Copy into the lesson (small, independent of the roadmap; can ship any time)**
| What | Evidence | Verdict | Effort |
|---|---|---|---|
| Easy to hard inside a lesson; production (English to German) last, announced | "Let's make this a bit harder…" then HARD EXERCISE | **Copy** | M |
| Distractors drawn from the previous lesson's words | Lesson 3's options were lesson 2's words | **Copy** (built-in spaced review) | S |
| Labelled, free "fix your mistakes" round | "PREVIOUS MISTAKE" tag, "No energy needed!" | **Copy** | S |
| Combo shown on the progress bar (colour steps at 3, 5) | gold then orange bar | **Copy** | S |
| "Can't listen now" swaps in a text item and has Undo | listening skip | **Copy** (we delete the step today) | S |
| Review-lesson scorecard (tap a tile to reveal the answer) | finish screen | Later | M |
| A single proficiency chip in the header | German Score | Later (we have A1 %) | S |

**Do not copy:** placement tests as the gate to later sections, fake "course building" loader, social-proof lines, asking for permissions twice, hearts/energy, countdown events, "claim XP" ritual.
**Keep (we are better):** intro card before the test, pass mark, A1 % from memory health, exam phrase bank, "Say it", speaking check, transparent XP.

## 4. The unit recipe

**Before the unit (Guidebook sheet):** the can-do sentence, 5 key phrases (audio, tap a word to translate), 1-3 tip cards (≤ 120 words, each pointing back to a key phrase).

**Four lessons (parts) of 4 core words each:**
1. **Meet it:** 4 words + key phrases 1-2; intro cards, recognition (pick the picture / meaning). Short.
2. **Use it:** 4 new words, recombined with lesson 1's; sentences built from tiles.
3. **Apply the tip:** 4 new words; the tip shown in use; one listening item (skippable, replaced by a text item).
4. **Say it:** the last 4 words; **all 5 key phrases produced English to German** (hard stretch); capstone sentence; mistakes round. Pass mark 60 % as today.

**Checkpoint (every third unit, no new words):** a mixed recall of the last three units. This is the consolidation day the decisions doc asked for.
**Extras:** the 340 non-core words belong to units but are optional "extra words" cards (Words tab), not part of the pace.
**Step budget:** aim for ≤ 14 steps per part (today about 20-23). Measure first: we already record active time per part in `S.time`.

**Worked example, unit 16 "Order in a café or restaurant"** (words are real core words from our list; key phrases come from our "Ordering food and drink" topic):
- Can-do: order something to eat and drink and ask for the bill.
- Core words (candidates, 11 + 3 verbs): Kaffee, Tee, Milch, Wasser, Brot, Glas, Flasche, Restaurant, Frühstück, Rechnung, Obst; bestellen, zahlen, trinken.
- Key phrases (existing bank): *Die Speisekarte, bitte.* · *Was möchten Sie?* · *Ich hätte gern einen Tee, bitte.* · *Ich nehme die Suppe.* · *Die Rechnung, bitte.*
- Tips: **möchten + noun** (Ch 12 slice) and **und / oder / mit** (new, 40 words).
- Hard stretch: "A tea and a coffee, please." → *Einen Tee und einen Kaffee, bitte.*

## 5. The roadmap: 35 units in 6 stages

32 content units + 2 exam-skills units + 1 mock-exam unit. **481 core words** all placed (11-18 per unit, average 14), **340 extra words** placed with their unit as optional. Word pools are quotas from our existing 31 topics (the build step picks the actual words, see §10). "(extra)" = optional extras. Every one of the 14 existing phrase topics is used.


### Stage 1 First contact (weeks 1-2)

| # | Week | Situation (I can ...) | Core words (extra) | Word pools | Existing phrases it reuses | Grammar riders (existing chapters) | New to write |
|---|---|---|---|---|---|---|---|
| 1 | 1 | **Say hello and goodbye**: greet people and say goodbye, formally and informally | 13 (7) | greetings 10, times of day 3 | Greetings (25) | du / Sie (Ch 2) | tip du/Sie |
| 2 | 1 | **Be polite, ask for help**: say please, thank you, sorry; say I don't understand and ask someone to repeat | 12 (7) | greetings 9, exam & classroom 3 | Polite basics (17), When you don't understand (13) | none (formulas) | - |
| 3 | 1 | **Introduce yourself**: say my name, where I come from, where I live | 16 (14) | question words & pronouns 4, personal details 7, countries 5 | Introducing yourself (19) | sein (Ch 3), verb in second place (Ch 6 a) | - |
| 4 | 2 | **Spell and count to 20**: spell my name and count to 20 | 15 (2) | numbers 15 | new (from word examples) | alphabet table (Ch 1), numbers 0-20 (Ch 17 a) | key phrases |
| 5 | 2 | **Numbers to 100, phone numbers, age**: say phone numbers and my age, understand numbers | 16 (2) | numbers 15, question words & pronouns 1 | new | numbers and phone numbers (Ch 17 b) | key phrases |
| 6 | 2 | **Fill in a form, give personal details**: answer questions about myself and fill in a simple form | 16 (12) | question words & pronouns 4, personal details 10, countries 2 | Asking for and giving personal information (18) | W-questions (Ch 7 a) | - |

### Stage 2 People and home (weeks 3-4)

| # | Week | Situation (I can ...) | Core words (extra) | Word pools | Existing phrases it reuses | Grammar riders (existing chapters) | New to write |
|---|---|---|---|---|---|---|---|
| 7 | 3 | **Introduce your family**: name my family and say who is who | 16 (13) | family 12, question words & pronouns 4 | new | haben (Ch 3), mein / dein (Ch 11 a) | key phrases |
| 8 | 3 | **Describe people**: describe how people look and what they are like | 13 (13) | adjectives 6, family 7 | new | der / die / das (Ch 8 a), adjectives after sein | key phrases |
| 9 | 3 | **Describe things and colours**: describe objects: colour, size, quality | 14 (5) | adjectives 6, colours 8 | new | nicht + adjective (Ch 9 a), sehr / zu | key phrases |
| 10 | 3 | **Where you live**: describe my home and say what is in it | 15 (17) | home 13, question words & pronouns 2 | new | es gibt and plurals (Ch 8 b), in + place | key phrases |
| 11 | 4 | **Days of the week and parts of the day**: name the days and parts of the day, say on which day | 16 (2) | time words 2, weekdays 9, times of day 3, time units 2 | new | am + day (Ch 16 a, light) | key phrases |
| 12 | 4 | **Months, seasons, dates**: say a date and a birthday | 18 (5) | months 13, dates 3, seasons 2 | new | dates and ordinals (Ch 18) | key phrases |

### Stage 3 Time, food and money (weeks 4-7)

| # | Week | Situation (I can ...) | Core words (extra) | Word pools | Existing phrases it reuses | Grammar riders (existing chapters) | New to write |
|---|---|---|---|---|---|---|---|
| 13 | 4 | **Tell the time**: ask and say the time, give opening hours | 15 (6) | time words 7, clock time 5, time units 3 | new | telling the time (Ch 19) | key phrases |
| 14 | 5 | **Your daily routine (first verbs)**: say what I do in a day, in order | 12 (5) | verbs 6, linking words 2, time words 4 | new | regular verbs (Ch 4), time first = verb second (Ch 6 b) | key phrases |
| 15 | 5 | **Food and drink you like**: say what I like to eat and drink | 16 (17) | verbs 1, food & drink 12, linking words 1, question words & pronouns 2 | new | gern / mögen (Ch 20 a), essen / trinken vowel change (Ch 5 a) | key phrases |
| 16 | 5 | **Order in a café or restaurant**: order food, ask for the bill | 14 (15) | verbs 2, food & drink 11, linking words 1 | Ordering food and drink (23) | möchten (Ch 12 a), und / oder / mit | tip und/oder/mit |
| 17 | 6 | **Shop for food and clothes**: ask for things in a shop and say how much I want | 16 (23) | shopping & services 14, measures 2 | Shopping (15) | accusative with ein / kein (Ch 10 a) | - |
| 18 | 6 | **Prices and paying**: ask the price, understand it and pay | 15 (7) | shopping & services 7, linking words 1, numbers 5, currency 2 | new | prices (Ch 17 c), nicht / kein (Ch 9 b) | key phrases |
| 19 | 6 | **Post, bank and phone services**: ask for a service and make a polite request | 14 (10) | verbs 3, shopping & services 6, linking words 3, home 2 | Requests and offers (9, part) | können (Ch 12 b) | - |
| 20 | 7 | **Free time and hobbies**: say what I do in my free time and how often | 16 (19) | verbs 1, free time 14, linking words 1 | new | vowel-change verbs (Ch 5 b), gern | key phrases |

### Stage 4 Getting around (weeks 7-8)

| # | Week | Situation (I can ...) | Core words (extra) | Word pools | Existing phrases it reuses | Grammar riders (existing chapters) | New to write |
|---|---|---|---|---|---|---|---|
| 21 | 7 | **Places in town**: say where places are | 14 (11) | travel 4, linking words 2, town 8 | new | in / an / auf + place (Ch 16 b), yes/no questions (Ch 7 b) | key phrases |
| 22 | 7 | **Ask for and give directions**: ask the way and understand directions | 14 (14) | verbs 3, linking words 3, home 3, town 5 | Asking for and giving directions (15) | imperative (Ch 14), im / am / zum / zur (dative mini-chapter a) | dative mini-chapter |
| 23 | 8 | **Public transport and tickets**: buy a ticket and ask about times | 15 (15) | verbs 1, travel 12, time words 2 | Travel: tickets, trains and the hotel (11, part) | müssen / wollen (Ch 12 c), um ... Uhr | - |
| 24 | 8 | **Book a hotel and travel**: book a room and talk about a trip | 12 (11) | verbs 2, travel 8, linking words 2 | Travel (11, part) | separable verbs (Ch 13 a) | - |
| 25 | 8 | **Weather and seasons**: talk about the weather and ask about it | 13 (14) | linking words 2, adjectives 4, weather 7 | new | es ist + weather, comparison (Ch 20 b) | key phrases |
| 26 | 8 | **Make appointments**: agree a day and time | 12 (4) | verbs 3, linking words 2, time words 7 | Making appointments (14) | time prepositions (Ch 16 c) | - |

### Stage 5 Health, work and everyday life (weeks 9-10)

| # | Week | Situation (I can ...) | Core words (extra) | Word pools | Existing phrases it reuses | Grammar riders (existing chapters) | New to write |
|---|---|---|---|---|---|---|---|
| 27 | 9 | **At the doctor**: say what hurts, understand simple advice | 13 (12) | verbs 2, linking words 1, adjectives 3, body & health 7 | At the doctor and health (9) | mir / dir tut ... weh (dative mini-chapter b), reflexive pronouns | dative mini-chapter |
| 28 | 9 | **Jobs and the workplace**: say my job and ask about others' | 13 (14) | verbs 1, work & school 10, question words & pronouns 2 | new | professions without article, -in (Ch 8 c) | key phrases |
| 29 | 9 | **School and learning**: talk about studying and a class | 12 (11) | verbs 1, work & school 6, exam & classroom 5 | new | dieser / welcher (Ch 20 c) | key phrases |
| 30 | 10 | **What you did yesterday**: say what I did, in the past | 11 (5) | verbs 5, linking words 1, adjectives 3, time words 2 | new | Perfekt (Ch 15 a, b), war / hatte | tip war/hatte |
| 31 | 10 | **Phone calls and messages**: make a phone call and leave a message | 13 (4) | verbs 4, linking words 4, question words & pronouns 5 | On the phone (10) | polite requests (könnten Sie), separable verbs in commands (Ch 13 b) | - |
| 32 | 10 | **Invite, accept, refuse, small talk**: invite someone and say yes or no politely | 16 (13) | verbs 3, free time 6, linking words 3, adjectives 2, question words & pronouns 2 | Reacting and small talk (10), Requests and offers (9) | werden (future), adjective endings (Ch 20 d) | tip werden |

### Stage 6 Exam readiness (weeks 11-12)

| # | Week | Situation (I can ...) | Core words (extra) | Word pools | Existing phrases it reuses | Grammar riders (existing chapters) | New to write |
|---|---|---|---|---|---|---|---|
| 33 | 11 | **Exam skills: listening and reading**: handle notices, signs, short ads and announcements | 11 (6) | verbs 2, linking words 3, exam & classroom 6 | Exam & classroom words | exam practice | exam item sets |
| 34 | 11 | **Exam skills: writing and speaking**: write a form and a short message; speaking parts 1-3 | 14 (5) | verbs 2, linking words 4, question words & pronouns 5, exam & classroom 3 | Requests and offers (9) | connectors (und, aber, denn) | exam item sets |
| 35 | 11-12 | **Mock exams and final sweep**: sit a full mock exam and fix weak spots | 0 (0) | - | - | spiral revisit of all tips | mock papers |

Totals: 481 core words, 340 extras, 170 key phrases (34 units x 5: **75 reused from the existing 208 phrases**, **95 new**), about 37 tip cards (the 20 chapters cut into about 32 slices + 5 new, see §6).

## 6. Where each grammar chapter lands (spiral)

| Chapter | Units | Note |
|---|---|---|
| Ch 1 Pronunciation, alphabet | 4 | moved from week 5 to week 2 (spell your name) |
| Ch 2 du / Sie | 1 | |
| Ch 3 sein, haben | 3, 7 | |
| Ch 4 Present tense, regular | 14 | |
| Ch 5 Vowel-change verbs | 15, 20 | |
| Ch 6 Verb second | 3, 14 | |
| Ch 7 Questions | 6, 21 | |
| Ch 8 Nouns, articles, plurals, es gibt | 8, 10, 28 | |
| Ch 9 nicht / kein | 9, 18 | |
| Ch 10 Accusative and reflexive pronouns | 17, 27 | |
| Ch 11 Possessives | 7 | |
| Ch 12 Modal verbs | 16, 19, 23 | one or two modals at a time, not six in a week |
| Ch 13 Separable verbs | 24, 31 | |
| Ch 14 Imperative | 22 | |
| Ch 15 Perfekt | 30 | |
| Ch 16 Prepositions of time and place | 11, 21, 26 | |
| Ch 17 Numbers, prices, phones | 4, 5, 18 | |
| Ch 18 Dates | 12 | |
| Ch 19 Time | 13 | |
| Ch 20 Extras (gern, comparison, dieser/welcher, adjective endings) | 15, 25, 29, 32 | |

Slice letters (a, b, c) mark where a chapter is cut; the existing chapter parts (`splitGrammar`) are the starting point and are not verified to match.

**New tips to write (gaps vs today and vs Duolingo's A1):** a short **dative mini-chapter** in two slices (im / am / zum / zur / bei, then *mir / dir tut ... weh*), **war / hatte**, **werden** (future), **und / oder / mit** with *aber / denn*, **accusative pronouns** (*mich, dich, ihn, sie, es*), and a trimmed du / Sie tip.

## 7. Calendar and load

Template: **6 learning days + 1 checkpoint day per week.** Weeks 1-10 carry the 32 content units (about 1.9 learning days per unit); week 11 the two exam-skills units; weeks 11-12 mock exams and a sweep with **no new words**. The units stay fixed when a learner moves their target date; only the days per unit stretch.

Load check (simulation, all reviews graded Good, same spaced-repetition model for both, words only):

| Week | OLD new/day | OLD reviews/day | OLD cards/day | NEW new/day | NEW reviews/day | NEW cards/day |
|---|---|---|---|---|---|---|
| 1 | 8.6 | 7.4 | 16.0 | 6.2 | 6.2 | 12.5 |
| 2 | 6.3 | 15.2 | 21.5 | 7.2 | 13.4 | 20.6 |
| 3 | 9.1 | 15.0 | 24.1 | 6.7 | 13.9 | 20.6 |
| 4 | 9.1 | 25.6 | 34.7 | 7.5 | 20.4 | 27.9 |
| 5 | 11.4 | 26.8 | 38.2 | 6.5 | 21.1 | 27.6 |
| 6 | 8.0 | 28.6 | 36.6 | 6.9 | 20.0 | 26.9 |
| 7 | 6.9 | 24.2 | 31.1 | 6.7 | 21.0 | 27.7 |
| 8 | 9.7 | 27.3 | 37.0 | 6.1 | 19.3 | 25.4 |
| 9 | 9.7 | 32.8 | 42.5 | 5.8 | 22.6 | 28.3 |
| 10 | 10.9 | 34.8 | 45.7 | 5.8 | 25.4 | 31.2 |
| 11 | 15.4 | 42.9 | 58.3 | 3.6 | 22.4 | 26.0 |
| 12 | 12.1 | 46.8 | 58.9 | 0.0 | 16.5 | 16.5 |

Peak **58.9 to 31.2 cards a day**, and the curve flattens (25 to 31 cards a day from week 4 to week 10) and falls in the last weeks instead of climbing. Core words average **7.6 per learning day** (extras add 5.7 if a learner takes them all). Caveats: this model is simpler than the one behind the decisions doc (its absolute numbers are 20-40 % lower for the old plan), so read it as a comparison, not a forecast; phrases and grammar parts are not included; real learners grade some cards Again.

## 8. Exam alignment

The plan today treats the A1 exam with a speaking part 3 and exam admin tasks; this roadmap keeps that: the **exam phrase topics** (Requests and offers, appointments, phone, directions, forms) sit in units 6, 19, 22, 26, 31, 34; units 33-35 train listening, reading, writing and speaking as separate skills and end with mock papers. I have **not verified the exam's format or word list** (the todo "ask the Goethe-Institut about the A1 word list" still stands); check unit 33-34 against the official sample papers before writing them.

## 9. What to write (content effort)

| Item | Count | Source |
|---|---|---|
| Unit sheets (title, can-do, pools, riders) | 35 | this document |
| Key phrases | 170 (75 reused, 95 new) | existing phrase bank and the 1,653 word examples |
| Tip cards | about 37 (about 32 cut from existing chapters, 5 new) | existing chapters |
| Hard-stretch English-to-German sentences | 170 | derived from the key phrases |
| Capstone sentences | 34 | derived |
| Checkpoint mixes | 11 | automatic from the units |
| Exam item sets and 2 mock papers | units 33-35 | needs the real sample papers |

## 10. How it gets built

| Phase | What | Effort |
|---|---|---|
| P0 | Decide (this document) | you |
| P1 | **Quick wins that do not depend on the roadmap:** combo bar colour, labelled mistakes round, listening skip that substitutes and has Undo, previous-lesson distractors | S each |
| P2 | **Source files:** `content/de-a1/units.md` (unit list as in §5) and `tools/build_de_units.py`: assign every core word to exactly one unit by topic quota plus keyword and example rules; fail if a word is unplaced, a unit has fewer than 11 or more than 18 core words, or a phrase topic is unused. Write stage 1 (units 1-6) first as a pilot | M, then L for the content |
| P3 | **App:** a `unit` path kind (card with situation, can-do, 4 lesson dots, Guidebook button), the Guidebook sheet (phrase cards and tip cards reuse the existing sheets), unit sequencing per §4 | L |
| P4 | **Migration:** word ids do not change; mark a unit done when at least 80 % of its core words are learned; extras stay in Words; path ids change, so `S.parts` must be migrated (the learners are mid-path) | M |
| P5 | Later: scorecard, header chip, exam item sets | M |

Suggested order: P1 now (no risk), P2 for stage 1 behind a Settings switch with one new learner, then P3, P4 once stage 1 feels right.

## 11. Decisions I need from you

1. **Core-first?** Schedule the 481 core words and make the 340 extras optional (it halves the late load; it is "option 3" in the decisions doc, now built into the roadmap).
2. **12-week frame** (6 learning days + 1 checkpoint, exam units in week 11, mocks in week 12), or a free pace?
3. **Pilot:** build stage 1 (units 1-6, about 90 core words) first behind a switch, or all 35 units before shipping?
4. **Learners already mid-path** (Taha, Batul, you): migrate them (P4), or let them finish the old path and start new learners on the new one?
5. Should I write the **dative mini-chapter, war / hatte, werden, accusative pronouns** as part of P2?

## 12. Limits of this plan

- Which words go to which unit **inside** a topic (for example the 23 core food words across units 15 and 16) is decided by the build step; the table gives quotas, not final word lists.
- "Small linking words" (36 core) and "Everyday verbs" (42 core) have no natural situation; they are spread over many units and placed where they occur in that unit's key phrases.
- Duolingo's A1 is 70 units of roughly 16 words each (my estimate: 4 lessons x about 4 new words, seen on two lessons); this plan is 32 denser units. The checkpoint days and the 7.6 words a day are the safeguard against steepness, but only learners can confirm that.
- The load numbers are a simulation with all reviews graded Good.

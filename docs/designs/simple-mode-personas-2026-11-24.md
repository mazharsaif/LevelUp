# Simple mode: what five personas said (feedback 8f95, 2026-11-24)

Request: make the app easier; start in a simple mode and introduce complex features one by one. Five read-only subagents each judged the app as one persona. **They read the code and did not run the app**, so timings below are their recommendations, and a few claims (penalty sizes, defaults) were not re-checked by me.

Personas: busy parent (15 min a day, holiday), competitive gamer (22), anxious beginner (45), Goethe A1 exam candidate (visa, 12 weeks), less tech-savvy 62-year-old.

## Where all five agree
- The 15-step welcome tour is the biggest day-1 problem (profile, XP, gems, rank, quest, six tabs, bug button before any lesson). Cut to 3-4 steps.
- Day 1 core: Today with one "next lesson" card and a Start button, the core lesson steps, audio.
- Course switcher, bug button, export/import, offline audio are not for the first days.
- Quest Mode already has an "off" layout (`freeToday()`); it drops quests, penalties and the plan card but still shows rank and XP.

## Where they disagree (this decides the design)
| Persona | Wants early | Wants hidden or late |
|---|---|---|
| Parent / older learner | One card, two tabs (Today, Settings), plain words | Quests, gems, ranks, Party, tour, tab clutter |
| Anxious beginner | Safety, only-up numbers | Penalties, "slips", XP loss, mock exams, Party |
| Exam candidate | Target date, pace, Progress, review, mock papers | Gems, ranks, avatar, Party, themes |
| Gamer | XP, rank ladder, streak, daily quest, Party | Planning and admin; simple mode would bore them |

Rough unlock schedule (majority view): Day 1 Today + lesson + audio; Day 3 Words, review, streak, phrases; Day 7 Path, Progress, Guidebook, daily goal; Day 14+ grammar chapters, study helper, full quests, gems/ranks, speak-it, offline audio; Party and Hunter's Path only when asked.

## Things that can feel punishing (anxious persona, from code reading)
Missed-review XP penalty (-3 to -10 per missed day, shown red on Progress), "forgot" costs -0.5 XP per word, total XP can go down, memory warning "costing you N levels", tour text "skipped days cost a little XP".

## Plain-language swaps suggested
New quest to "Your next lesson"; Memory training to "Practise words you've learned"; XP/gems to "points" or hidden; Guidebook to "Read the explanation"; Again/Hard/Good/Easy to "I forgot / Hard / OK / Easy"; "Quest cleared" to "Well done".

## Design this points to (not built)
One question at setup, "How do you like to learn?", sets the starting layout:
1. **Calm** (parent, older, anxious): Quest Mode off, tabs Today + Words + Settings, no penalties shown, 3-step tour.
2. **Planner** (exam): pace, target date, Progress and review from day 1; gamification hidden.
3. **Game** (gamer): rank, streak, quest visible; tour trimmed to XP, rank, quest.

Common to all: tabs unlock with a short "New: Words" message (a reward, not an explanation), locked tabs may show their unlock day for the Game profile, and Settings has "Show everything now". Open question for the owner: unlock by days or by lessons finished.

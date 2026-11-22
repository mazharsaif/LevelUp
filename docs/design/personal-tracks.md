# Personal tracks: quests and dungeons for your own goals (plan)

Status: **built 22 Nov 2026** (release 2026.11.22.09). Code: `app/js/life.js` (rules), `lifeRoute()` and friends in `app/js/app.js` (screens), `app/data/life.json` (gate board), `native/.../widget/LifeWidget.kt` (widget, reminder).

**Shield rules as built (anti-abuse):** hold at most 2 · earned only, by clearing a D-rank gate (14 days) or higher (never bought, feedback 11-22) · one shield per gate per week · never two missed days in a row (the second one cracks) · never on hard-mode gates. Without a shield a miss **cracks** the run; a crack **heals by itself after 7 good days in a row** (2 good weeks for weekly targets), or at once by doing the penalty quest in System mode, or by paying 💎 40 (at most once every 14 days). Two misses in a row, or a miss while cracked, break the run.

LevelUp already turns *learning* into a Solo Leveling style game: daily quest, XP, levels, E → S ranks, streaks,
diamonds, gift boxes, parties and widgets. This plan adds **personal tracks**: goals the learner sets for their own
life ("30 days without porn", "1 book a week for a month", "gym 3 times a week") using the same system.

## 1. What similar apps do

| App | What it is | Ideas worth taking | What to avoid |
|---|---|---|---|
| [Solo Hunter: Level Up](https://apps.apple.com/us/app/-/id6758021041) | Solo Leveling style habit app | XP, gold and stat points per task; missed quests trigger a penalty; immunity tokens; workouts framed as dungeon raids; guilds | Penalties that feel like punishment for life |
| [SYSTEM — Habit Tracker](https://apps.apple.com/us/app/-/id6761079302) | Goals as quests, growth as stats | E → S rank, boss raid challenges, an HP and penalty engine | |
| [Quest Leveling](https://apps.apple.com/us/app/quest-leveling/id6744368718) | Daily training with a timer | Finish before time runs out or take a penalty; daily quests refresh | Timers that cause stress |
| [Solo Quest XP](https://apps.apple.com/app/id6755908321), [Solo Level : System](https://apps.apple.com/us/app/id6755756882) | Stats-based habit apps | Six life stats (Strength, Intelligence…) that grow with matching quests | Too many stats to care about |
| [SelfQuest](https://apps.apple.com/pl/app/selfquest/id6498150329) | RPG habit app | Dungeons that test the levelled-up hero; random side quests | |
| [Habitica](https://en.wikipedia.org/wiki/Habitica) | The classic RPG habit tracker | Three task types: **Habits** (+/−, any time), **Dailies** (scheduled; a miss costs HP; a full day earns a bonus), **To-Dos** (one-off); **Challenges** (themed task sets others made, with prizes); parties | Long task lists that become a chore |
| [QUITTR](https://screensdesign.com/showcase/quittr-quit-porn-now), [Fortify](https://apps.apple.com/us/app/-/id6739021562), [ByeLust](https://apps.apple.com/us/app/id6758082976) | Quit-porn apps | Streak counter, **panic button** (breathing, push-ups, grounding, the reasons you wrote down), private journal, content blocker | [Shaming](https://theweek.com/health/the-app-tackling-porn-addiction) the user at the moment of an urge |
| Duolingo ([INSEAD](https://knowledge.insead.edu/marketing/consumer-streaks-are-motivating-key-keeping-them-alive)) | Streak master | **Streak freeze** bought with in-app currency | |

What the research on streaks says:
- Streaks motivate, but a **broken streak demotivates** (Silverman & Barasch 2023, [summary](https://www.psychologytoday.com/us/blog/ulterior-motives/202306/how-broken-streaks-sap-motivation)). Resetting to zero after one slip makes people quit the goal and the app (the "what-the-hell effect", [example](https://dev.to/skaraz/why-your-habit-tracker-resets-you-to-zero-and-why-thats-psychologically-damaging-5cho)).
- One missed day barely affects habit forming; habits take weeks to months to become automatic (Lally et al., [secondhand summary](https://dev.to/22gstudios/streak-apps-taught-me-one-missed-day-undoes-six-weeks-the-science-says-it-doesnt-so-i-rebuilt-my-53ol)).
- **"Never miss twice"** ([Ness Labs](https://nesslabs.com/habit-trackers)) is the practical rule: one slip is fine, two in a row is the real danger.
- Too much gamification makes the streak more important than the habit ([The Decision Lab](https://thedecisionlab.com/fr-CA/insights/consumer-insights/streak-creep-the-perils-of-too-much-gamification)).

**Takeaway for LevelUp:** keep the Solo Leveling feel (gates, ranks, a System voice, penalties as *quests*), but make it
forgiving: shields instead of instant resets, "best run" and "clean days this month" next to the current run, and
support instead of shame on a slip.

## 2. The model: four kinds of track

Everything a person wants fits one of four shapes. The builder asks for the shape first, then 3–4 fields.

| Kind | Solo Leveling name | Example | Done when | Shown as |
|---|---|---|---|---|
| **Daily** | Daily quest | Read 20 min, 50 push-ups, meditate 10 min | Ticked (or the amount reached) on a scheduled day | Checkbox or a counter (10/50) |
| **Abstain** | Dungeon: *clean run* | No porn, no sugar, no social media after 22:00 | Each day you check in "still clean" | Clean days, current run, best run |
| **Target** | Raid | 4 books in 4 weeks, 100 km in a month, gym 3× a week | The amount is reached in the period | Progress bar, pace line |
| **Milestone** | Boss | Run a 10K, finish a course, pass the A1 exam | One thing by a date | Countdown + steps |

A **dungeon (gate)** is any track with a fixed length and a clear condition. You *enter* a gate on a day, and you *clear*
it or *fail* it. Gate rank comes from its length and difficulty:

| Gate | Length | Clear reward |
|---|---|---|
| E | 7 days | +50 XP, 💎 5 |
| D | 14 days | +100 XP, 💎 10 |
| C | 30 days | +250 XP, 💎 25, a gift box |
| B | 60 days | +500 XP, 💎 50, rare gift |
| A | 90 days | +900 XP, epic gift |
| S | 180 days | +2000 XP, legendary gift, title |

Daily tracks without an end date are fine too: they just have no gate rank.

### Forgiving rules (the default)
- **Shields 🛡** (like Duolingo's streak freeze): earned by clearing a gate (not bought; 💎 can heal a crack instead). One shield is used
  automatically on a missed or slipped day, so the run continues. Hard mode turns shields off.
- **Never miss twice:** one miss without a shield "cracks" the run (it shows ⚠ and the run continues); a second miss in a
  row breaks it. A broken run never erases history: "best run 23 days" and the calendar stay.
- **Gate failure** is a fail, not a reset: you keep the XP for the days you did, and "Re-enter the gate" starts a new run.

### Penalties, Solo Leveling style (opt-in "System mode")
In the anime, a missed daily quest sends you to the *penalty zone*. Here a missed day gives a **penalty quest** for the
next day (for example "20 push-ups" or "15 min reading", chosen when the track is made). Doing it removes the crack.
Penalties never take learning XP away, and they are off by default.

## 3. Sensitive goals (quitting porn and the like)
- **Private by default.** A private track never shows in Party, comparisons or bug reports. It can use a **neutral
  name and icon** on screen and on widgets ("Clean run 🛡" instead of the real goal).
- **Check-in, not detection.** The app only knows what the person says. The question is calm: "Still on track today?"
  with **Yes** / **I slipped**.
- **On a slip:** no red alarms and no shame. "That happens. Your best run is 23 days and you were clean 26 of the last
  30. Start the next run now." A shield is offered if one is left.
- **Urge SOS button** on the track (from the quit-porn apps): a 90-second breathing animation, the "why I'm doing
  this" note the person wrote when starting, and a quick physical task (20 push-ups, a cold glass of water, a walk).
  Logging an urge that passed earns a little XP ("urge defeated").
- A line with links to real help (a counsellor, a helpline) for anyone who feels it's more than a habit. LevelUp is
  not a medical tool and says so.

## 4. Templates ("gate board")
Ready-made gates so nobody has to think hard to start. Each one fills the builder; everything can be edited.

| Template | Kind | Gate | Stat |
|---|---|---|---|
| 30 days without porn | Abstain | C | Discipline |
| 1 book a week for a month | Target (4 books / 4 weeks) | C | Mind |
| 10 minutes of meditation, 30 days | Daily | C | Mind |
| Gym 3 times a week, 8 weeks | Target | B | Body |
| 10,000 steps, 21 days | Daily (amount) | D | Body |
| No sugar, 21 days | Abstain | D | Health |
| No social media after 22:00, 14 days | Abstain | D | Discipline |
| Wake up at 6:00, 21 days | Daily | D | Discipline |
| Journal every day, 30 days | Daily | C | Mind |
| Cold shower, 14 days | Daily | D | Discipline |
| Learn: 20 min of German a day, 30 days | Daily, ticked by LevelUp itself | C | Mind |

The last row links personal tracks to the courses: a day counts when the course's daily goal is reached.

## 5. Stats and level
Keep it small: **four stats**, each fed by the tracks tagged with it.

| Stat | Fed by |
|---|---|
| 💪 Body | Workouts, steps, sport |
| 🧠 Mind | Reading, learning, meditation, journaling |
| 🛡 Discipline | Abstain tracks, wake-up times, no-phone rules |
| ❤️ Health | Sleep, food, water |

- Personal XP feeds a **Hunter level** and a Hunter rank (E → S), shown on its own Hunter card.
- Total XP (learning plus personal) is shown on the profile and in Party, so both count.
- A radar chart on the Hunter card shows the four stats. It's a picture of balance, not a target.

## 6. Where it lives in the app
**Recommendation: a new course, "Hunter's Path" (personal quests)**, in the course picker next to German, French,
Maths and SE. It reuses what courses already have: its own state (`S` per course), its own home, Party, widgets and
backups. No server change is needed, because state stays one JSON blob per learner and course.

Screens:
- **Today (home):** "System: daily quests have arrived" with today's check-ins (one tap each), active gates with day
  N of M, and a cracked or at-risk warning in the evening (same 20:00 rule as the widgets).
- **Gate board:** the templates, plus "Create your own gate".
- **Track page:** calendar heatmap, current and best run, notes, an SOS button (abstain tracks), shields left, edit,
  archive.
- **Hunter card:** level, rank, the four stats as a radar, gates cleared, titles.

A small "Personal quests 2/3 ✓" line on the language courses' Today can come later, so people who study don't have to
switch courses to check in.

Data (inside the course state):
```js
S.tracks = { t1: { kind: "abstain" | "daily" | "target" | "milestone", title, icon, stat, private, alias,
  start: "2026-11-22", days: 30, schedule: [1,1,1,1,1,1,1] /* Mon–Sun */, amount: 50, unit: "push-ups",
  target: 4, period: "week", why: "…", penalty: "20 push-ups", hard: false,
  log: { "2026-11-22": 1 | 0.5 | "slip" | { n: 30 } }, urges: { "2026-11-22": 2 }, status: "active" | "cleared" | "failed" | "archived" } }
S.shields = 1; S.hunterXP = 0;
```

## 7. Widgets and the native app
The widgets already read one snapshot from the web app (`widgetSnapshot()`), so personal tracks fit in easily:
- **Personal quests widget:** today's check-ins with **tap to tick right on the home screen** (a Glance callback
  saves the tick in the app, and the web app applies it the next time it opens).
- **Gate widget:** "Day 12 / 30 · Clean run 🛡" with a ring (private tracks show their alias).
- **Reminders** (native only, needs the notification permission): one reminder time per track, plus "check in"
  at 21:00 if anything is open.

## 8. Party

**Built 22 Nov:** party gates (`/api/party-gates`): a gate the party runs together, starting the next day; **the whole team must survive** (one failed run fails it for all; all cleared = team bonus). Nudges (`/api/nudges`): one per person per gate per day, shown as a banner and as a notification in the native app (background check every 15 minutes).

- Share chosen tracks with your party (never private ones).
- **Party gates:** everyone enters the same gate ("No sugar, 21 days"), and the party sees who is still in and the
  group's clean days.

## 9. Build plan

| Phase | What | Size |
|---|---|---|
| 1. MVP | "Hunter's Path" course; daily, abstain and target tracks; builder with the 4 shapes; 10 templates; one-tap check-in; gates with clear/fail, XP, 💎, shields; slip flow with SOS; track calendar; privacy and aliases | 1–2 sessions |
| 2 | Milestone tracks; Hunter card with stats radar and titles; System mode with penalty quests; "Personal quests" line on language Today; course-linked track ("German 20 min a day") | 1 session |
| 3 | Widgets (check-in from the home screen, gate ring); native reminders | 1 session + native release |
| 4 | Party sharing and party gates | 1 session |

## 10. Decisions needed
1. **Where it lives:** a separate course "Hunter's Path" (recommended), or a panel inside every course?
2. **Default strictness:** forgiving (shields, never miss twice) with System mode opt-in (recommended), or strict
   Solo Leveling penalties by default?
3. **XP:** separate Hunter level for personal tracks with total XP shown together (recommended), or one shared level?
4. **Name:** "Hunter's Path", "Personal quests", "Gates", or something else?

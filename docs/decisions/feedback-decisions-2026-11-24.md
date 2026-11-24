# Feedback decisions, 24 Nov 2026

Seven open reports need a decision from Mazhar before anything is built. Research only: no code was changed, nothing committed or deployed. Effort: **S** under 1 h, **M** half a day, **L** 1-2 days. File references are to the repo as of 24 Nov (working tree, which includes uncommitted edits).

Method notes: survival numbers in section 1 and the load numbers in section 3 come from small simulations of the rules in `life.js` / `store.js`, not from real learner data (no real progress was read). Grammar part counts in section 3 are estimated from chapter text length (the app splits at load in the browser), so treat them as plus or minus 3 parts.

Summary table is at the end.

---

## 1. Should the high-rank gate durations be shortened? (20261123-051559-mazhar-bf7a)

**Report (mazhar, today / Daily quests):** "Should the high rank gates durations be shortened?"

### How it works today
`GATES` in `app/js/life.js:17`, rewards in `GATE_REWARD` (`life.js:18`), check-in XP `XP.day = 5` (`life.js:21`). Builder offers 7, 14, 21, 30, 60, 90, 180 days (`app.js` `lifeBuilder`); a length maps to the highest rank it reaches (21 days = D).

| Rank | Days | Clear XP | Clear 💎 | Check-in XP (5/day) | Total XP | XP per day | 🛡 on clear | 🛡 part-way |
|---|---|---|---|---|---|---|---|---|
| E | 7 | 50 | 5 | 35 | 85 | 12.1 | no | no |
| D | 14 (and 21) | 100 | 10 | 70 | 170 | 12.1 | yes | no |
| C | 30 | 250 | 25 | 150 | 400 | 13.3 | yes | at 14 and 28 good days |
| B | 60 | 500 | 50 | 300 | 800 | 13.3 | yes | at 14 and 28 |
| A | 90 | 900 | 80 | 450 | 1350 | 15.0 | yes | at 14 and 28 |
| S | 180 | 2000 | 150 | 900 | 2900 | 16.1 | yes | at 14 and 28 |

(Part-way shields: `MILE_DAYS = [14, 28]`, only gates of 28+ days, never on hard mode, only if you hold fewer than 2.) Hunter ranks need 720 XP (D), 3,720 (C), 11,220 (B), 26,220 (A), 47,470 (S) total (`hunterLevel`/`hunterRank`).

Failing rule (`settle()`, `life.js:150-175`): first unshielded miss cracks the run; a second miss in a row, or any miss while cracked, **fails the whole gate** (you keep daily XP, but not the clear reward). A crack heals after 7 good days.

### The problem
Reward per day is almost flat (12 to 16 XP/day), so a 180-day gate pays the same per day as a 7-day one but is far riskier. Chance of finishing, simulated with the real rules (p = chance you do the task on a given day; "0 shields" and "2 shields held at the start"):

| Gate | p=0.85, 0 / 2 shields | p=0.92, 0 / 2 shields | p=0.97, 0 / 2 shields |
|---|---|---|---|
| E 7 d | 72% / 92% | 90% / 99% | 98% / 100% |
| D 14 d | 43% / 78% | 74% / 95% | 95% / 100% |
| C 30 d | 13% / 41% | 48% / 82% | 88% / 99% |
| B 60 d | 2% / 6% | 22% / 47% | 76% / 95% |
| A 90 d | 0% / 1% | 10% / 23% | 65% / 87% |
| S 180 d | 0% / 0% | 1% / 2% | 42% / 60% |

A "realistic" learner: habit research (Lally et al. 2009) found a median of about 66 days to automaticity with large spread, and most people miss 1 day in 10 early on. At p=0.92 (about 1 miss a fortnight) only 10% would finish a 90-day gate and 1% a 180-day gate. You also only hold 2 shields and they come from clearing gates, so long gates are mainly a trap. Dropping a 100-day streak to nothing is the discouraging case the app tries to avoid elsewhere ("never miss twice" is the kind part, "fail the gate" is not).

### Options
1. **Keep lengths, add partial credit on failure.** A failed gate pays the reward of the rank for the days you survived (e.g. failing on day 75 of 90 pays B-rank reward at 50%). Pros: no content/UI change, honours the effort, keeps S as an aspiration. Cons: a bit more rule text; needs a pay-out line in `fail()`. Effort: **S-M**.
2. **Shorten the top ranks** (B 45, A 60, S 120). Pros: simple, higher finish rates (A at 60 days, p=0.92: 47% with shields). Cons: ranks lose the "legendary" feel; existing gates in progress keep old lengths, so two scales coexist; template lengths in `app/data/life.json` also change. Effort: **S** (+ content check).
3. **Forgiveness scales with length**: gates of 30+ days allow one extra crack per 30 days (or heal after 3 good days instead of 7). Pros: attacks the actual cause (two misses within 7-14 days); length stays. Cons: more complex rules; harder to explain. Effort: **M**.
4. **Leave it.** Pros: nothing to do. Cons: top gates remain near-unwinnable for normal humans.

### Recommendation
Option 1 now (partial credit on failure, paid at half the reward of the highest rank reached), no change to lengths. Revisit shortening only if nobody enters A/S gates after a few weeks (the data is in each learner's `tracks`).

### Question for Mazhar
**Keep the lengths 7/14/30/60/90/180 and pay half the reward of the highest rank reached when a gate fails (recommended), or shorten B/A/S to 45/60/120 instead? (A / B)**

---

## 2. Shields on short gates, working without shields, and the penalty quest (20261123-183743-mazhar-7df6, plus 20261123-183807-mazhar-ad20)

**Report 7df6 (mazhar, Hunter's Path today screen):** "What about healing shields on short 1 week gates. Maybe we work them without shields. Vs when is penalty quest used. Are both usable together"

**Report ad20 (mazhar, track screen "Glute Bride & Squats"):** "Cracked shield. Cracked shield bek h makes no sense". The attached screen shows a hard-mode 7-day E gate: "Day 2 / 7", "⚠ Cracked · heals after 7 more good days", a "🩹 HEAL ... · 💎 40" button and "You need 💎 40 (you have 0)".

### How it works today
Constants (`life.js:20`): `SHIELD_MAX 2`, `HEAL_COST 40`, `HEAL_BUY_DAYS 14` (one 💎 heal per learner per 14 days, across all gates: `h.healAt`), `SHIELD_TRACK_DAYS 7`, `HEAL_DAYS 7`, `HEAL_WEEKS 2`.

Order of checks for a missed slot (`settle()`, `life.js:160-172`):
1. Missed yesterday and it was not shielded: gate fails.
2. A shield is used if: not hard mode, you hold one, yesterday was not a miss, and none was used on this gate in the last 7 days. This check does **not** look at the crack state.
3. Otherwise, if already cracked: gate fails.
4. Otherwise: crack (`st.cracked = {at, heal: 0}`), and if System mode is on and the gate has penalty text, a penalty quest is queued for tomorrow (`pendingPen`).

Heals: a good day adds 1 to `cracked.heal`; at `HEAL_DAYS` the crack clears (`life.js:156`). Other ways: doing the penalty quest clears it at once and pays +3 XP (`penaltyDone`, `life.js:241`); paying 💎 40 clears it (`healCrack`, `life.js:262`). The clear check ignores the crack: a gate that reaches its last day cracked is still cleared (`life.js:173`).

Hard mode (`tr.hard`) only turns off shields (spending and the part-way ones). It does not make failing harder: it behaves exactly like a normal gate with zero shields, and still has cracks, heal days, 💎 heal and penalty quests.

### Interaction matrix (a missed day on an active day-gate)

| Situation when the miss is settled | Shield used? | Crack? | Penalty quest? | Heal routes afterwards | Result |
|---|---|---|---|---|---|
| Normal, shield usable, not cracked | Yes (-1 🛡) | No | No (only queued on a crack) | none needed | Run continues; a miss the next day cracks (does not fail) |
| Normal, no usable shield (0 held, or one used on this gate within 7 days), not cracked | No | Yes | Yes, if System mode ON and penalty text set | 7 good days; penalty quest (free, +3 XP); 💎 40 (once per 14 d) | Gate continues cracked |
| Normal, shield usable, **already cracked** | Yes | stays cracked, heal counter not advanced | No | as above | Covered; next miss fails |
| Normal, no shield, already cracked | No | - | - | - | **Gate fails** |
| Second miss in a row after an unshielded miss | irrelevant | - | - | - | **Gate fails** |
| Hard mode, any case | Never | same as "no shield" rows | same as "no shield" rows | same | First miss cracks, second fails (identical to normal with 0 shields) |
| Crack when days left in the gate are fewer than 7 (`HEAL_DAYS`) | - | Yes | as above | the 7-day timer can never finish; only penalty or 💎 | Crack stays to the end; still clears if no more misses |
| Weekly-target gate | slot is a week, so the 7-day limit always passes | crack after one missed week | as above | 2 good weeks (`HEAL_WEEKS`) | Same problem when under 2 weeks remain |
| Open-ended track (no days) | as normal | as normal | as normal | as normal | "Fail" becomes "run ends, new run starts" |
| Penalty quest ignored | - | - | stays on Today until done | - | No consequence at all |
| 💎 heal or natural heal while a penalty is pending | - | cleared | **still shown** (`pendingPen` not cleared by `healCrack` or natural heal, found in code) | - | Doing it later gives +3 XP and heals nothing |

**Can shield and penalty quest be used together?** They never stack: the shield is tried first, the penalty quest only exists after a crack, i.e. when no shield covered the miss. After a crack all three heal routes are open at once (wait, penalty, 💎).

### Why the 7-day hard gate in the screenshot can never heal
Crack on day 1 (shown on day 2), `HEAL_DAYS = 7`, days 2-7 leave 6 good days at most (5 if the miss was day 2). Crack on day k can only heal in time if the gate length minus k is at least 7:

| Gate | Cracks that can heal in time | Share of the gate where the timer is hopeless |
|---|---|---|
| 7 d | none | 100% |
| 14 d | day 1-7 | 50% |
| 30 d | day 1-23 | 23% |
| 60 d | day 1-53 | 12% |

Other defects on the same screen: the 💎 button is rendered (disabled) even with 0 diamonds and also when it would buy nothing; the text "heals after 7 more good days" promises something that cannot happen; and shields are blocked on hard gates while hard mode otherwise offers the same softness (crack, heal, penalty) as normal, so "hard" is mostly a label.

### Options (each can combine)
1. **Heal requirement = min(7, days left).** Cracked on a 7-day gate on day 1 would show "heals after 6 more good days", which is the end of the gate, i.e. pointless. Pros: honest wording, tiny change. Cons: still pointless on 7-day gates. Effort: **S**.
2. **No crack state on gates of 7 days or fewer.** Replace by a plain "1 slip allowed" counter; no heal timer, no heal button. Pros: removes the impossible heal on exactly the gates where it is hopeless. Cons: shorter gates lose the 💎 sink unless 💎 can "restore the slip". Effort: **S-M**.
3. **Reword the state** ("⚠ Cracked: one more miss ends the gate · N days left"; heal text only when a heal can still finish). Effort: **S**.
4. **Hide the heal button when it cannot heal or cannot be afforded**, show one line instead ("Need 💎 40, you have 0" / "Next heal 7 Dec"). Effort: **S**.
5. **Hard mode fails on the first miss.** Gives "hard" a real meaning, matches "no shields". Cons: reports from today's learners on hard gates (Mazhar's own) change behaviour mid-gate unless applied to new gates only. Effort: **S**.

### Recommended single ruleset
1. A miss is covered by a shield first (not hard mode), unchanged. **New:** gates of 7 days or fewer never consume a shield (shields are scarce and earned on D+ gates; a 7-day gate does not deserve one).
2. First uncovered miss = **crack** (one life lost). On gates of 7 days or fewer the state is called "1 slip used" and has no heal timer.
3. A crack heals after **min(7, days left after the crack day - 1)** good days, but if that is below 3 there is no timer (state text says "no more misses allowed"). Weekly gates: min(2, weeks left).
4. Heal routes after a crack, shown only when they work: penalty quest (System mode, free, +3 XP), 💎 40 (needs 💎, off the 14-day cooldown, at least 2 days left). Otherwise show a single grey line, not a disabled button. Clear `pendingPen` on any heal.
5. Penalty quest and shield are sequential, never together: no penalty when a shield covered the day. Documented on the shield sheet and Guide.
6. **Hard mode:** no shields, no 💎 heal, no timer heal, no penalty heal. First miss fails the gate. Reward bonus +25% XP (optional). Apply to hard gates created from now on.
7. Second miss in a row or any miss while cracked still fails the gate (unchanged).

Effort total: **M** (life.js about 25 lines, app.js text and healButton, Guide/shield sheet copy, a few checks with a `_test_user` gate).

### Question for Mazhar
**Do you accept the 7-point ruleset above (shields never spent on gates of 7 days or fewer, heal timer = min(7, days left) or none, heal button hidden when it cannot work, hard mode fails on the first miss for new gates)? Any rule you want different: (a) shields on 7-day gates yes or no, (b) hard mode first miss fails yes or no.**

---

## 3. The German plan needs remapping (20261123-183701-mazhar-0bf8)

**Report (mazhar):** "The german plan needs remapping. The learning curve steepens sharply and it's very hard to learn."

### How it works today
- Content: 821 words in 63 vocab lessons (45 lessons of 12 words, 17 of 16, one of 9), 20 grammar chapters, 14 phrase topics with 208 phrases (`app/data/content.json`, built by `tools/export_data.py`).
- Order: `export_data.py:356-410` sorts by the source book's day (`R.P`, one vocab lesson a day), grammar chapters on their first day, phrase topics on `PHRASE_DAY`, Ch 1 pushed to day 28 (`CH_DAY`). The app then spreads topics so they do not repeat back to back (`spreadPath`, `store.js:107`) and splits grammar chapters over 900 characters into parts (`splitGrammar`, 7 chapters).
- Parts: vocab lessons are parts of 4 words (`bitsOf`, `store.js:674`), phrases parts of 3, grammar chapter parts about 250-700 characters. Roughly 306 parts in total (estimate).
- Pace: `weekPlan()` (`store.js:731`) puts items on the calendar in proportion to **weights**: vocab 55%, grammar 30%, phrases 15% (`WEIGHTS`), by default 9 Nov 2026 to 31 Jan 2027 (83 days, 12 weeks). One 12-word lesson is 0.8% of the course, a phrase topic 1.07%, a grammar chapter 1.5%; the straight line moves 1.2% a day. Daily XP goal is auto: remaining XP / days left + a review allowance, about 25-30 XP a day for this span (project log 11-19).
- Intended pace in the source plan (`roadmap` in content.json, `goals`): 63 days of one vocab lesson a day (new material ends in week 9), then weeks 10-12 are mock exams and sweeps with **no new words**. The app stretches all new content over the full 12 weeks instead, leaving no consolidation weeks.

### The curve (simulation, plan dates as above, every review graded Good, no overdue backlog)

| Week | New words/day | New phrases (week) | Grammar parts (week) | Parts/day | Reviews due/day | Cards/day (new+phrases/7+reviews) | Cumulative words |
|---|---|---|---|---|---|---|---|
| 1 | 8.6 | 55 | 3 | 5.1 | 10 | 26 | 60 |
| 2 | 6.3 | 37 | 2 | 3.6 | 19 | 31 | 104 |
| 3 | 9.1 | 0 | 4 | 2.9 | 26 | 35 | 168 |
| 4 | 9.1 | 10 | 5 | 3.4 | 23 | 34 | 232 |
| 5 | 11.4 | 0 | 2 | 3.1 | 30 | 42 | 312 |
| 6 | 8.0 | 0 | 4 | 2.6 | 38 | 46 | 368 |
| 7 | 6.9 | 32 | 6 | 4.1 | 34 | 45 | 416 |
| 8 | 9.7 | 11 | 2 | 3.3 | 33 | 44 | 484 |
| 9 | 9.7 | 24 | 1 | 3.7 | 34 | 47 | 552 |
| 10 | 10.9 | 29 | 1 | 4.3 | 45 | 60 | 628 |
| 11 | 15.4 | 0 | 2 | 4.1 | 38 | 54 | 736 |
| 12 | 12.1 | 10 | 0 | 3.4 | 57 | 71 | 821 |

Cards per day (each # = 5), new items plus reviews:
```
wk1  #####·           26
wk2  ######·          31
wk3  #######          35
wk4  ######·          34
wk5  ########·        42
wk6  #########·       46
wk7  #########        45
wk8  ########·        44
wk9  #########·       47
wk10 ############     60
wk11 ##########·      54
wk12 ##############   71
```
Real learners grade some cards Again, so reviews are higher than this; max in the model is 89 reviews due on the last day (the review button caps one session at 20 cards, `app.js:284`).

### Where it steepens
1. **The review pile grows 5x** (10 to 57 a day) while new items stay at 9-15 a day; total daily cards go from 26 to 71 (2.7x). Nothing in the plan lightens as the pile grows. The ideal pace in the source (new words stop in week 9) is gone because the app spreads new words to the last day.
2. **Weeks 10-12 are the heaviest**: new words jump to 15.4 a day in week 11 because grammar and phrases are used up and the straight line then needs vocab-only lessons faster (weights make a vocab lesson only 0.8% of the course).
3. **Words get harder, and more are extras.** Nouns (need der/die/das) are 40% of words in lessons 1-21, 46% in 22-42, 61% in 43-63; entries with more than one word go 51%, 54%, 62%. The share flagged `core` falls 75%, 57%, 43% (core words per lesson: 12, 12, 9 ... down to 2-7 in the last third), so the late lessons are mostly non-core words yet cost the same effort. Single lessons are spikes: v21 (measures, average 21 characters), v36 (dates, 18.7), v50 (compass and countries, 16.4).
4. **Verb block in the middle**: lessons 37-41 are five lessons of 12 verbs each (60 verbs in a row), with the verb grammar (Ch 13 separable, Ch 14 imperative) sitting right on it.
5. **Grammar is lumpy and back-loaded the wrong way**: 21 of about 32 grammar parts fall in weeks 3-7 (up to 6 in week 7, which also adds Perfekt, Ch 15), and after week 8 there are 0-2 a week. Ch 17 (numbers and prices, 3 parts) comes on day 3 before pronouns and sein; Ch 10 (cases) and Ch 12 (modals) land in the same week 4.
6. **Daily lumpiness**: parts per day are 1 on 14 days, but 8 on 3 days and 11 on 2 days (week 1, phrase topic of 25 phrases and numbers in one day).

### Options for remapping
1. **Even-load scheduler (cap per day).** Replace the weight-based straight line in `weekPlan()` with load points: word 1, phrase 0.5, grammar part 4, cap about 14 points a day and at most 1 new grammar part a day; push overflow to the next day. Pros: removes the day spikes and the end rush; no content change; progress ids untouched. Cons: it lengthens the plan unless the date moves, because 1,029 words and phrases plus 32 grammar parts in 83 days already average 12.4 new items a day. Effort: **M** (store.js plus a check of paceCard/progress ETA).
2. **Reorder and rebalance content.** Edit `PHRASE_DAY`/`CH_DAY` and the day numbers in `export_data.py`: move Ch 17 behind Ch 3/4, move Ch 10 and Ch 12 apart, spread grammar so no week has more than 4 parts, move two or three phrase topics to weeks 9-12, break the five-verb-lesson block with noun/phrase lessons. Re-run the export, regenerate content.json (no audio needed). Pros: one-time data change, no new code, fixes grammar clumps. Cons: partial changes to the curve only (reviews still grow); must be checked against learners already mid-path (ids stable, so progress survives; their week labels shift). Effort: **S-M**.
3. **Core-first with an optional layer.** Schedule the 481 `core` words first and treat the other 340 as "extra" (listed in Words, own lessons later, no pace weight). Pros: halves the late load, effort goes to what the exam needs. Cons: content/UI work (lessons mix core and non-core words today, so lessons need re-cutting: path ids change, needs a progress migration). Effort: **L**.
4. **Consolidation days.** Add a "Consolidation" item after every 6 lessons: no new words, a mixed recall of that week's words (reuses `reviewSteps`). Pros: breathing room exactly where the pile grows, cheap content-wise. Cons: new path kind, ETA maths must treat it as a lesson. Effort: **M**.
5. **Slower pace (no code).** Move the target date (Settings). 31 Jan 2027 gives 12.4 new items a day; 15 Mar 2027 (125 days) gives 8.2; 30 Apr (172 days) gives 6.0. The auto goal and `weekPlan` re-spread automatically. Cons: later finish; does not fix the spikes or ordering. Effort: **S** (a default-date suggestion in the setup screen is optional).

### Recommendation
Do 2 (rebalance order, one export run) and 4 (consolidation days) together, and tell the learners option 5 is available today. Hold 1 until you see how 2 and 4 feel (they overlap), and put 3 on the todo list because it is the only one that cuts total effort. Before building, look at where Taha and Batul actually slow down (their `log` timestamps per part): this report did not read any real progress.

### Question for Mazhar
**Which do you want built: (A) rebalance order + consolidation days (recommended, about a day), (B) the even-load scheduler, (C) core-first re-cut (large), or (D) only slow the target date? And what is "steep" for you: the new material per day, or the growing review pile? (If the review pile, choose A or D.)**

---

## 4. Review XP can go negative (20261124-055240-mazhar-2682)

**Report (mazhar, German review done screen):** "Why did my xp drop by 1?" The screen showed "Again 3 · Hard 0 · Good 1 · Easy 0 ... 4 words reviewed -1 XP, 25% accuracy".

### How it works today
`startReview` in `app/js/lesson.js:995-1003`: `xp = round(0.2*(Good+Easy) - 0.5*Again + (recall rate >= 80% ? 1 : 0))` (`XPR`, `store.js:434`: recall 0.2, forgot -0.5, bonus 1). Hard gives 0 and counts as recalled for the rate. If the result is negative it is not added to the day's XP but stored as a penalty (`addPenalty`, `store.js:424`, reason "Low review score (25% recalled)"); `totalXP` subtracts penalties and floors at 0 (`store.js:423`). The daily XP used for the goal/streak is not reduced. The XP help sheet says "-1 per 2 forgotten" (`app.js:1633`). Separate rule: a day with due words and no review costs -3 XP (+1 per 10 overdue, max -10).

Your case: 0.2x1 - 0.5x3 = -1.3, no bonus (25%), rounds to -1.

| Session | XP |
|---|---|
| Again 3, Good 1 | -1 |
| Again 1, Good 0 | 0 (-0.5 rounds to -0) |
| Again 2, Good 2 | -1 |
| Again 2, Good 4 (67% recalled) | 0 |
| 20 cards, 5 Again 15 Good | +1 |
| 20 cards, all Good | +5 (4 + 1 bonus) |

### The problem
You are charged XP for doing the review of exactly the words you forgot. SM-2 already punishes forgetting by resetting the interval (that is the useful signal); the XP loss adds a second penalty and a reason to skip reviews on a bad day, while skipping costs -3 anyway. The "drop" reads as a bug because nothing on the done screen explains it.

### Options
1. **Floor each session at 0.** Pros: simplest, ends the surprise, keeps the +1 at 80% as the reward for doing well; the -3 missed-day penalty remains the real stick. Cons: no cost for sloppy "Again" tapping (nothing gained either). Effort: **S** (change one line, drop the `addPenalty` branch, edit XP_HELP and the summary).
2. **Keep negatives, explain them** on the done screen ("-1 XP: 3 forgotten words"). Pros: preserves the design. Cons: still punishes studying; the report stays valid. Effort: **S**.
3. **Soften the formula**: forgot -0.25, floor at -1 per session. Pros: smaller sting. Cons: still can go negative; more to explain. Effort: **S**.
4. **Reward only**: remove the negative term, add +0.2 per Hard too. Pros: positive framing. Cons: inflates XP, changes the auto daily goal calibration slightly. Effort: **S**.

### Recommendation
Option 1: floor each review session at 0. Update the XP sheet text ("0 for forgotten words") and keep the missed-day penalty. Penalties already logged are untouched.

### Question for Mazhar
**Floor review XP at 0 per session and keep only the -3 missed-day penalty (recommended), yes or no?**

---

## 5a. German <-> English translator (20261122-113455-batul-41ab, needs approval)

**Report (batul, Words tab):** "A section where I get the german to english translation for a word or sentence and vice versa". Status in `TODOS.md`: parked 11-22, needs approval (feedback from `batul` waits for you).

### How it works today
- Words tab lists learned words and phrases with audio and search over the 821 words and 208 phrases (`wordsView`, `app.js`), searchable by German or English. Nothing translates free text.
- Study helper: `POST /api/ask` (`server_fastapi/main.py:803`, `server_fastapi/ask.py`) calls GroqCloud `openai/gpt-oss-120b`, system prompt "ONE quick question about the card", refuses anything off the card, 4 sentences, 450 max tokens, cache by question, logs, per-user rate limit (1 per 2 s, 30 per hour), daily cap of 10 currently switched off (`LIMIT_ON`). The design doc (`docs/design/chatbot/README.md`) explicitly says "Do not add a tab: an empty chat invites off-topic use".
- Design rule that matters here: no help that gives away an answer before the learner answers. A translator on the Words tab (outside lessons) does not break that rule.

### Problem
Learners meet words and sentences that are not in the 821 words (menus, texts, homework) and leave the app. The existing helper cannot do it: it only answers about the open card.

### Options
1. **Local lookup only** (no model): search the app's own words and phrases both ways and show the best matches. Pros: free, instant, always correct, offline. Cons: does not translate sentences or unknown words, which is what Batul asked for. Effort: **S-M**.
2. **Translate mode on `/api/ask`** (recommended base): new `mode: "translate"` with its own short system prompt (translate only, give 1-2 variants, note gender/formal-informal, no chat), reusing the key, cache, rate limit, logging and 👍/🚩. UI: a "Translate" box at the top of the Words tab with a swap button. Pros: smallest build, same safeguards, answers cached (repeats are free). Cons: LLM accuracy (see below); needs its own prompt tests. Effort: **M**.
3. **Dedicated translation API** (DeepL / Google). Pros: better on idioms and long text. Cons: another key and account, per-character cost, no explanation of grammar, new vendor on the droplet. Effort: **M-L**.
4. **Link out** to Google Translate / dict.cc from the Words tab. Pros: 10 minutes. Cons: leaves the app, no audio or cards, no control. Effort: **S**.

### Cost and accuracy
- Cost: a translation call is about 200 input and 100 output tokens (short prompt, no card context); at gpt-oss-120b list prices (verify current Groq prices before relying: last known order of 0.15 USD per million input and 0.60-0.75 per million output tokens) that is about 0.0001 USD per call, so 10,000 translations a month is about 1 USD. Limit input to 200 characters.
- Accuracy: strong for everyday A1/A2 sentences and single words; weaker on idioms, dialect, regional words and the gender of rare nouns, and it can confidently invent. Mitigations: look up the word in the app's own list first (show "in your lessons" with the card), cap input to a sentence, keep temperature low, always show "AI translation, may be wrong" with 🚩 report.
- Scope: German courses only at first (French has its own prompts and audio); no audio for free text (clips are pre-generated; `edge-tts` is installed but not wired to arbitrary text) so show text only; signed-in learners only; shared daily limit with the helper.

### Recommendation
Approve option 2 with the local-first lookup from option 1 as the first result, German and French, text-only, 200-character limit, same quota and logging as the study helper, entry as a collapsible box on the Words tab (not a tab).

### Question for Mazhar
**Approve building a Words-tab translator on the existing Groq study helper (local lookup first, AI for the rest, 200-character limit)? (yes / no / link-out only)**

---

## 5b. Remove the Lessons tab (20261122-125128-batul-0eea, needs approval)

**Report (batul, Lessons screen "All lessons"):** "Remove Lessons Tab". Status: parked 11-22, needs approval.

### How it works today
- The bottom bar has seven tabs for the language courses (`app/index.html:33-40`): Today, Path, **Lessons**, Words, Progress, Party, Settings. On a phone width these are tight.
- `lessonsView()` (`app.js:1647`): "All lessons" list. Counts (done/total, vocab/grammar/phrases), a "How is XP measured?" link, filters All / To do / Done / Vocab / Grammar / Phrases, every lesson grouped by planned week with its icon, parts done, done date, score, XP earned, tap opens `itemSheet`.
- What depends on it: the route table entry `lessons: lessonsView` (`app.js:101`) and the tab link in `index.html`. The welcome tour (`app.js:2440-2444`) does not mention it. Native app tests only use the word "lessons" for counters, not this screen. Nothing else links to `#/lessons`. The XP explainer is also reachable from Today, Progress and Settings (`#xph` / `#xpmore`).
- What replaces its jobs: the Path tab shows the same items by week with rings and a "next" marker; in non-Quest mode it shows the skill map or order list. Not covered elsewhere: the **filters** (To do / Done / by kind), per-lesson **score, XP and done date**, and the all-in-one text list that is easier to scan than the winding path.

### Problem
It duplicates the Path tab and crowds the tab bar, but removing it loses the filters and per-lesson history.

### Options
1. **Remove the tab, keep the screen as a sub-page.** Delete the tab link; add "All lessons (list)" button on the Path/Skills page (and Progress) opening `#/lessons`. Pros: bar goes to 6 tabs, nothing lost. Cons: one more tap. Effort: **S**.
2. **Remove the tab and the screen.** Pros: simplest bar and code. Cons: loses filters and history; Path becomes the only index. Effort: **S**.
3. **Merge into Path**: add the filter chips and a List/Path toggle on the Path tab (as the SE tree has Map/Path). Pros: one place, no loss. Cons: Path view gets heavier; more testing in Quest and non-Quest modes. Effort: **M**.
4. **Keep it.** Effort: none.

### Recommendation
Option 1 (tab out, list reachable from Path and Progress). It answers Batul's report, loses nothing and is a 30-minute change.

### Question for Mazhar
**Remove the Lessons tab from the bottom bar and keep the list as a page opened from Path (recommended), remove it completely, or merge it into Path? (1 / 2 / 3)**

---

## Summary: answer these seven

| # | Report | Decision | Recommended answer | Effort |
|---|---|---|---|---|
| 1 | bf7a | Shorten high-rank gate lengths? | No: keep 7/14/30/60/90/180, pay half the reward of the highest rank reached when a gate fails | S-M |
| 2 | 7df6 + ad20 | Shield / crack / heal / penalty / hard ruleset | Accept the 7-rule set: no shield spend on gates of 7 days or fewer, heal timer = min(7, days left) or none, hide impossible or unaffordable heal button, shield and penalty never stack, hard mode fails on first miss (new gates), clear pending penalty on heal | M |
| 3 | 0bf8 | German plan remap | Rebalance order in `export_data.py` + consolidation days; tell learners they can slow the target date now; core-first re-cut on the todo list | S-M + M |
| 4 | 2682 | Negative review XP | Floor each review session at 0; keep the -3 missed-day penalty | S |
| 5a | batul 41ab | Translator | Approve: Words-tab box on the study-helper backend, local lookup first, 200-char limit, about 1 USD per 10k translations (verify price) | M |
| 5b | batul 0eea | Remove Lessons tab | Remove from bar, keep list as a page opened from Path | S |

Order of work if all approved: 4 (S), 5b (S), 2 (M), 1 (S-M), 3 (S-M + M), 5a (M).

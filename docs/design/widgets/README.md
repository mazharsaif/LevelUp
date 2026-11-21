# LevelUp home-screen widgets (design)

Design only. The widgets are built later in the native app (`native/`) with **Jetpack Glance**.

- `widgets.html` is one self-contained page (no network). It shows every widget, variant and state on phone home screens at real launcher cell sizes. Open it in a browser.
- `png/` holds the same mockups rendered with headless Chrome at 2× (one PNG per block on the page).

**Cell maths used.** The mockups use a 412 dp-wide phone with a 4 × 5 grid. One cell is about 95 × 118 dp, and the launcher adds 8 dp of padding, so a widget is n·95 − 16 by m·118 − 16 dp:

| Size | Mock size (dp) | Glance `SizeMode.Responsive` bucket |
|---|---|---|
| 1×1 | 79 × 102 | `DpSize(57.dp, 57.dp)` |
| 2×1 | 174 × 102 | `DpSize(130.dp, 57.dp)` |
| 4×1 | 364 × 102 | `DpSize(250.dp, 57.dp)` |
| 2×2 | 174 × 220 | `DpSize(130.dp, 160.dp)` |
| 4×2 | 364 × 220 | `DpSize(250.dp, 160.dp)` |
| 4×4 | 364 × 456 | `DpSize(250.dp, 330.dp)` |

Every widget is resizable (`resizeMode="horizontal|vertical"`). The layout jumps between these buckets, so text never has to scale smoothly. Real launchers differ by ±15 %. All rows that hold text are single-line with ellipsis, and the big numbers sit inside fixed-size boxes.

## Visual variants (all widgets)

| | A · Hunter | B · Calm | C · Material You |
|---|---|---|---|
| Matches | `theme-sl` | `theme-calm` | system (dynamic colour) |
| Surface | navy gradient, blue glow outline, corner brackets | warm paper (light) / slate (dark), flat | `GlanceTheme.colors` surface / secondaryContainer |
| Type | `sans-serif-condensed`, caps labels | `serif` headings, Roboto body | system (Google Sans / Roboto) |
| Accent | blue → purple with the aura | deep teal | primary of the wallpaper seed |
| Light/dark | always dark (as in the app) | both | both (follows the system) |

The variant should follow the learner's in-app theme (`settings.theme`). Add an option in widget configuration: "Match app theme / Material You".

**Fixed colours in every variant:**
- Articles: der = blue, die = red, das = green, plural = purple. These match `--m/--f/--n/--pl` in each theme.
- Rank letters: E grey, D green, C blue, B purple, A pink, S gold (`.rank.*`).
- Status colours: red = at risk or penalty, green/✓ = done, gold = S-Rank or rank-up.

## States (used by every data widget)

| State | When | Look |
|---|---|---|
| normal | data is fresh, goal not met yet | accent ring/bar, "9 h 40 m left" |
| goal reached | `xpToday ≥ xpGoal` (streak day banked) | green ✓ ring, "Quest cleared · +5 💎", streak +1, Start becomes "One more part" |
| streak at risk | evening (from 20:00, or 4 h before midnight) and the goal is not met, and `streak > 0` | red ring, 🌙 "Streak at risk · 2 h 20 m left", red **Save streak** button |
| offline / stale | `now − syncedAt > 2 h`, or the last refresh failed | content dimmed to 50 %, "⊘ 3 h ago" badge; tapping refreshes (and still deep-links) |
| not signed in | no session / guest with no data | lock, "Sign in to LevelUp", **Open LevelUp** |

The Rank, Review and Streak widgets add their own states: rank-up, all caught up, missed-review penalty and streak lost (listed below).

## WidgetSnapshot fields

The app writes one snapshot per course (Glance state or DataStore) after every XP change, review, sync and midnight rollover. Widgets read only this snapshot, never the network.

```kotlin
data class WidgetSnapshot(
  // meta
  val signedIn: Boolean, val userName: String?, val courseId: String,      // "de-a1", "fr-a1", "se", "math"
  val courseTitle: String, val courseType: String,                          // "language" | "tree"
  val questMode: Boolean,                                                   // false → no goal/streak/quest UI
  val syncedAt: Instant, val generatedAt: Instant, val theme: String,       // "sl" | "calm" | "classic"
  // today's quest
  val day: LocalDate, val xpToday: Int, val xpGoal: Int,                    // goalDay.xp (auto 20–300, frozen per day)
  val partsToday: Int, val partsGoal: Int,                                  // partsToday(), goalDay.p (1–8)
  val dueCount: Int, val fadingCount: Int,                                  // SM-2 due now; overdue/fading words
  val questCleared: Boolean, val diamonds: Int,
  val missedReviewPenalty: Int?,                                            // e.g. 10 if yesterday's reviews were missed (pen)
  // streak
  val streak: Int, val bestStreak: Int, val todayHit: Boolean,
  val last35Days: List<DayMark>,                                            // HIT | PARTIAL (some XP) | MISS | FUTURE, Monday-aligned
  val nextGiftAt: Int?,                                                     // 7/14/21/30/45/60/75/90/120/150/180/365
  // rank
  val level: Int, val a1Pct: Double, val rank: Char, val rankName: String,  // 'D', "Explorer"
  val rankFromPct: Int, val nextRank: Char?, val nextRankPct: Int?,         // 10, 'C', 25
  val aura: Float, val auraName: String,                                    // (lv-1)/99, "Awakening"
  val nextRankEta: String?, val rankUpPending: Boolean,                     // "~9 days"; true until the app shows the level-up screen
  // continue
  val next: NextPart?,
  // review preview
  val reviewPreview: List<WordCard>,                                        // first 4 due, in queue order
  val nextReviewAt: Instant?, val dueTomorrow: Int,
  // word of the day (works without sign-in: bundled content)
  val wotd: WordCard,
)
data class NextPart(val itemId: String, val kind: String,                   // vocab|grammar|phrases|skill
  val lessonNo: Int?, val title: String, val subtitle: String?,             // "Family" / "Algebra · skill 3"
  val part: Int, val parts: Int, val minutes: Int, val newWords: List<WordCard>)
data class WordCard(val id: String, val de: String, val article: String?, val gender: Char?, // m/f/n/p
  val en: String, val hint: String?, val plural: String?, val example: String?, val exampleEn: String?,
  val audioId: String?, val learned: Boolean, val lessonNo: Int?)
```

Mapping to web code: `goalDay`, `partsToday/partsGoal/remainingParts`, `dayCounts()`, `S.hit` (store.js), `level()`, `rank()`, `progress()`, `pace()` (store.js/app.js), `aura/auraName/STAGES` (hero.js), `RANK_INFO` (app.js), `nextPick()/planParts()/bitCount/bitsDone` (store.js), the SM-2 queue (reviews), and `content.json` words (`de, en, g, pl, hint, ex[0], a`).

## Deep links / tap targets

The `#/…` routes exist in the web app today. Rows marked **new** need an action in the native app (and, if wanted, the same hash in the PWA).

| Target | Link |
|---|---|
| Today | `levelup://today` (= `#/today`) |
| Ranks page | `levelup://ranks` (= `#/ranks`) |
| Start next part | **new** `levelup://start?item={itemId}&part={n}` (= `startItem(it, bit)`; grammar → `#/grammar/{id}`) |
| Start review | **new** `levelup://review` (opens the review session directly) |
| Review one card | **new** `levelup://review?word={id}` |
| Word detail | **new** `levelup://word/{id}` (Words page sheet) |
| Progress / activity | `levelup://progress` (= `#/progress`) |
| Skill tree part | `levelup://branch/{branch}` (= `#/branch/…`) + start part |
| Sign in | `levelup://login` |
| Play audio | in-widget `actionRunCallback<PlayAudio>(wordId)`: plays `app/audio/{a}.mp3` from the app's cache, without opening the app |
| Refresh | `actionRunCallback<Refresh>`: pulls the snapshot again |

## Widgets

### 1. Today's quest (`quest-*.png`)
- **Purpose:** the daily nudge. Shows the streak, XP today against the goal (ring), parts against the parts goal, and words due.
- **Sizes:** 2×1 (ring + streak), 4×1 (ring · XP to go + part segments · 🔥 · due), 2×2 (ring with parts/due chips), 4×2 (ring + the three quest rows as in the app's quest card + Continue button), 4×4 "Today" (adds next part with Start, Review/All ranks buttons, a rank line and the week strip).
- **Variants:** Hunter, Calm light/dark, You light/dark.
- **States:** all five (normal, goal reached, at risk, stale, signed out). 4×4 is shown in normal, at risk, reached and stale.
- **Data:** `xpToday, xpGoal, partsToday, partsGoal, dueCount, streak, questCleared, diamonds, day` (time left is computed on device), and on 4×4 also `next`, `level/rank/a1Pct`, `last35Days[−7..]`.
- **Taps:** body → Today. Continue/Start → start next part. Save streak → start next part. Review → review. All ranks → ranks.
- **Refresh:** after every XP change (the app pushes `updateAll`), at midnight (`AlarmManager` exact-or-inexact at 00:00 → new day, frozen goals), and at the evening at-risk switch (alarm at 20:00 when the goal is not met). No polling.
- **Glance:** the ring is a Bitmap drawn with Canvas (Glance's `CircularProgressIndicator` is indeterminate only); cache per 2 % step. Part segments = `Row` of `Box(weight)`. Quest rows = `Row`s with a checkbox drawable. The Hunter glow outline and brackets are one nine-patch/vector background. Hard: none.

### 2. Rank (`rank-*.png`)
- **Purpose:** identity and long-term pride. Shows the rank letter in its frame with the purple aura that grows with the level, the level, % of A1 and the bar to the next rank.
- **Sizes:** 2×1, 2×2 (emblem hero), 4×1, 4×2 (big emblem + name, level, % A1, bar with D 10 % → C 25 % ends, "C-Rank · Speaker in ~9 days", aura name).
- **States:** normal, **rank-up** ("✦ Rank up ✦" in gold, showing the new rank and its can-do line, until the app is opened), stale, signed out. The aura sheet shows E Lv 4, C Lv 31, A Lv 78 and S Lv 100.
- **Data:** `rank, rankName, level, a1Pct, rankFromPct, nextRank, nextRankPct, aura, auraName, nextRankEta, rankUpPending`, plus the `RANK_INFO.can` line for rank-up.
- **Taps:** → `#/ranks`.
- **Refresh:** when level or a1Pct changes (lesson finish, review session end, daily fading at midnight).
- **Glance:** the emblem is a **pre-rendered bitmap** (6 ranks × 6 aura steps × 3 variants, generated once from an SVG, or drawn on a Canvas at runtime). No blur or animation at runtime. Only the static halo/particles in the image. The S-Rank bar is gold.

### 3. Continue (`continue-*.png`)
- **Purpose:** one tap from home screen into the next lesson part (`nextPick()`, alternating lessons), plus a Review N button.
- **Sizes:** 2×1 (title, segments, round ▶), 4×1 (kind tile, "Lesson 15 · part 2 of 3", Start), 2×2 (title, part, segments, full-width Start, Review link), 4×2 (adds the new words with article colours, Start part N + Review N).
- **Courses:** language lessons (vocab "Aa", grammar "§", phrases "💬") and skill-tree courses (Maths "∑", SE "</>", shown as "Algebra · skill 3 · part 1 of 3").
- **States:** normal, goal reached ("one more?"), at risk (red Start = "Save streak"), stale (Start still works, the app syncs on open), signed out.
- **Data:** `next{itemId, kind, lessonNo, title, subtitle, part, parts, minutes, newWords}`, `dueCount`, `courseTitle`, `questCleared`, plus the at-risk inputs.
- **Taps:** Start → `start?item=&part=`. Review → review. Body → Today (or `#/branch/…` for tree courses).
- **Refresh:** after each finished part (`setNextHook`) and on course switch.
- **Glance:** simple. Kind tile = `Box` with text.

### 4. Review due (`review-*.png`)
- **Purpose:** keeps spaced repetition on time (overdue words fade and missed days cost XP).
- **Sizes:** 2×1 (count + round button), 4×1 (count ring, first due word "die Abfahrt = ?", Review), 2×2 (big count, "3 fading", Review now), 4×2 (flash card with audio + the next three words as chips + Review all).
- **Inline quick review (4×2, optional):** tap the card → meaning shows → Again / Hard / Good / Easy buttons grade it in place with `actionRunCallback` (writes to the local SM-2 store, +1 XP, next card). This is the stretch goal. The rest only deep-links.
- **States:** words due, answer shown, **all caught up** (✓, "Next review in 3 h · 6 due tomorrow", Practice weak words), **missed-review penalty** (red, "Missed yesterday · −10 XP"), stale, signed out.
- **Data:** `dueCount, fadingCount, reviewPreview[0..3], nextReviewAt, dueTomorrow, missedReviewPenalty`.
- **Taps:** → review (or `review?word=` for the card). Speaker → PlayAudio callback.
- **Refresh:** after reviews, at `nextReviewAt` (one alarm), at midnight.
- **Glance:** the inline review needs `GlanceStateDefinition` per widget, with the current card and a revealed flag. Keep the grading logic in a shared repository so it is identical to the in-app session.

### 5. Streak calendar (`streak-*.png`)
- **Purpose:** shows the chain of goal days (streak = days the daily XP goal was hit, `S.hit`).
- **Sizes:** 2×1 (🔥 + 7 bars), 4×1 (🔥 + Mon-start week with ✓ circles), 2×2 (big 🔥 12, week dots, 🎁 next gift), 4×2 (🔥, best, gift + 5-week Monday-aligned grid like Progress → 📅 Activity; lighter cell = some XP but goal not hit).
- **States:** today not yet hit (outlined today), today done, at risk (red "!" today), **streak lost** (grey 🔥 0, "Start a new streak today", goal-day count), stale, signed out.
- **Data:** `streak, bestStreak, todayHit, last35Days, nextGiftAt, diamonds`.
- **Taps:** → `#/progress` (activity calendar). The at-risk state → start next part.
- **Refresh:** at goal hit, midnight, and the evening at-risk alarm.
- **Glance:** 35 `Box` cells in 5 `Row`s. That is within RemoteViews limits, but keep it to one view per cell (no nested text). Week labels are a single `Row` of `Text`.

### 6. Word of the day (`word-*.png`)
- **Purpose:** a light daily touch with the language, even on days the app isn't opened.
- **Sizes:** 2×1, 4×1, 2×2 (article in its colour on top, word, English, hint, play button), 4×2 (word with article colour, gender, plural, example sentence + English, Learn it/Review it, Next ›).
- **Variants:** all three. Article colour strip on the left edge. French course words work too ("la capitale").
- **States:** new word ("New · Lesson 41", Learn it), learned word ("Learned ✓", Review it). No stale or signed-out state is needed: it runs from bundled `content.json`, and falls back to any core word when signed out.
- **Data:** `wotd{de, article, gender, en, hint, plural, example, exampleEn, audioId, learned, lessonNo}`. Picked by `hash(date + userId) % words` (prefer learned words that are due soon, otherwise the next lesson's words, so it is a teaser).
- **Taps:** play → PlayAudio (no app open). Body → `word/{id}`. Next → callback that picks another word for today.
- **Refresh:** once a day (midnight alarm or a `WorkManager` daily job).
- **Glance:** easy. The audio clip must be in local storage (the native app caches `app/audio`).

### 7. Extras (`extras-*.png`)
- **Glance strip 4×1:** transparent, text straight on the wallpaper, like Google's At a Glance: "Sat 21 Nov / 🔥 12 · 72 XP to go · 14 words due". Evening state: "Streak at risk · 2 h 20 m left". Cleared and stale states too. Text colour flips with wallpaper brightness (`GlanceTheme` onSurface or a `WallpaperColors.HINT_SUPPORTS_DARK_TEXT` check). Note: third-party apps can't add to Google's At a Glance, and phones have no third-party lock-screen widgets, so this home-screen strip is the realistic version.
- **1×1 icon ring:** the app icon's ring filled to today's XP %, with 🔥/⚠/✓ in the middle and the streak count below. Tap → Today.
- **2×1 quick actions:** two tiles, ▶ Part 2/3 (start next) and ⟳ 14 due (review).

## Glance feasibility summary

- **Fine as-is:** text, rows/columns, rounded backgrounds (`cornerRadius`, API 31+; use a background drawable below 31), `LinearProgressIndicator` for bars, images, `actionStartActivity` with deep-link intents, `actionRunCallback`, dynamic colours via `GlanceTheme`.
- **Needs bitmaps:** progress rings and rank emblems with aura. Draw them with Canvas into a Bitmap, or ship pre-rendered PNGs. Keep each bitmap small (≤ 2× the dp size) to stay under the RemoteViews memory limit.
- **Hunter glow and corner brackets:** one static nine-patch or layer-list drawable per state colour (blue, red, gold). No blur at runtime.
- **Avoid:** animation (no pulsing aura, no particles), custom fonts (use the `sans-serif-condensed` / `serif` families), scrolling except `LazyColumn` (not needed here).
- **Updates:** push from the app (`GlanceAppWidget.updateAll`) on every state change, plus three alarms: midnight rollover, evening at-risk (20:00 if the goal is not met) and next-review-due. Add a `WorkManager` 1 h periodic sync only to mark data stale or refresh from the server when the learner uses the web app on another device.
- **Multi-course:** the widget configuration activity picks the course (default = current course). Store `courseId` in the widget's Glance state.
- **Quest Mode off:** the quest, streak and at-risk widgets show "Quest Mode is off" with a link to Settings. Rank, Continue, Review and Word still work.

## Recommended top 3 to build first

1. **Today's quest (4×2, with 2×2 and 4×1 buckets).** It carries the whole daily loop (XP, parts, streak, due) and the streak-at-risk evening state, which is the single biggest retention lever. Its snapshot (quest + streak fields) also feeds the glance strip, the 1×1 ring and the streak widget, so building it first builds most of the data plumbing.
2. **Continue (4×1 / 4×2).** It turns the widget into the fastest way into a lesson part (one tap → `start?item=&part=`), works for every course including Maths and SE, and is simple in Glance (no bitmaps).
3. **Review due (2×2 / 4×1), deep-link first, inline quick review later.** Overdue words fade and missed review days cost XP, so a visible due count prevents real loss. The deep-link version is cheap. The inline 4×2 review can follow once the SM-2 repository is shared.

Next after that: **Rank 2×2**, which needs the emblem bitmaps but is cheap once they exist and is good for motivation. Then Word of the day, then the streak calendar (much of it is already inside the 4×4 Today).

## Regenerating the PNGs

Render with headless Chrome via puppeteer-core. The script lives outside the repo. It loads `widgets.html`, screenshots every `.shot[data-shot]` element at deviceScaleFactor 2 into `png/<data-shot>.png`, and reports any widget whose content overflows its box.

# LevelUp todos

Two lists. **Mine** = Mazhar's own todos and feedback (accounts `mazhar` / `taha`). **Others** = suggestions from other people, each with the suggester's name. Seeded from `PROJECT_LOG.md` Pending on 2026-11-23; the log keeps the technical notes, this file is the list. Move finished items to **Done** with a date.

## Mine (Mazhar)

### Feedback, later
- iOS app next to the download button (11-20)
- Chatbot for doubts (brainstorm with the user first)
- Typo / alternate-answer grading
- Story listening exercises (optional, zero reward; design in `docs/reviews/alpha2-2026-11-19.md`)
- Party join system: list parties, request to join, any member accepts, max 10, party tab

### Todos
- German plan remap (0bf8, decided 11-24: later): reviews/day grow ~10 → ~57 over 12 weeks; see `docs/decisions/feedback-decisions-2026-11-24.md` §3
- Gate board emblems (82bb): pick layout + variant from `docs/designs/gate-board-82bb-v2.html`, then build
- Translator (41ab, approved 11-24): designs in `docs/designs/translator-41ab.html`, then build
- Push notifications / reminders (11-15): Web Push for PWA; native app already has local notifications for nudges and Hunter reminders
- Alpha test 2 bugs B1–B6 (11-19), nothing fixed yet: grammar part passes at 0%, mid-lesson reload loses the lesson, Party table shows all users to any sign-up, … (see `docs/reviews/alpha2-2026-11-19.md`); also audible Ch 1 drills, progress-number fixes, content error table
- Alpha test 1 medium items (11-15): onboarding leads with "Create profile" + Playful/Plain theme + light theme; hero/aura visible on Today; diamonds purpose/shop + gift rarity; real review-summary screen; honest weekly gates; tune SR; reconcile ETA/pace math; rebalance early path; even card density + mobile code/table + search/bookmarks
- SE path exercises: build the exercise types per node, then fill the other 7 branches; gate "Learned" on them
- Concept checks for SE branches (only maths has them); maybe a branch-level "Foundation check"
- More practice types (order the flow, match the terms, fill the code); maths next branches (differential equations, econometrics)
- Decide whether XP / streak / diamonds should be global per learner (now per course)
- Confirm domain auto-renew (`levelrise.org`, `level-up.com.de`)
- Re-add the no-porn gate to Hunter's Path when wanted (taken off 11-23)
- Fetch droplet feedback: `tools/feedback.sh` (session-start fetch failed 11-23, droplet unreachable)
- Update the deck screenshots (new hero forms, Settings tab, auto goal, icon)
- Possible extra branches: VPNs / WireGuard / Tailscale, mkcert and local names
- Extend 🎤 Speak it to vocab
- Before going public/selling: regenerate audio with Azure; ask the Goethe-Institut about the A1 word list
- Native app not built yet: inline quick review in widgets, widget config screen, Hunter corner brackets, background sync
- Not deployed yet (11-21): Monte Carlo branch, native beta APK, Ranks page (check whether later deploys already carried them)

## Others (with the suggester)

| From | Suggestion | Status |
|---|---|---|
| batul | Flip cards without "Still learning / I knew it", meaning shown directly | needs approval (phrase flip cards done 11-21) |
| batul | "Wrong when right": Check is enabled after one tile (Say-it with only "Wie geht" placed) | needs approval (Check unlock fixed 11-21, re-verify) |
| batul | Translator: German ↔ English lookup for words and sentences | parked 11-22 |
| batul | Remove the Lessons tab | done 11-24 (not deployed) |

Rule: reports from `taha` / `mazhar` are implemented directly; others wait for Mazhar's approval.

## Done
- (move finished items here with the date)
- 2026-11-23: single live environment (dropped the dev/main two-instance idea); `_` developer accounts + `devaccounts.py`; test notifications to mazhar

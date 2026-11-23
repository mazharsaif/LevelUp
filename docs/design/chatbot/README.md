# LevelUp learning chatbot: design

Status: MVP built 2026-11-23 (server_fastapi/ask.py, app/js/ask.js): the `/api/ask` endpoint with cap, cache, logging and the answer lock; the 💡 Hint before answering, context chips after the feedback screen, "More about this" on teaching cards and "Explain simply" in the skill-tree reader. Not built yet: Save as note, the Ask & Notes screen, streaming. Setup: see PROJECT_LOG.md (Study helper). Mockups: open the `0N-*.html` files in a browser at phone width (390 px). Each has a Hunter (dark) and Calm (light) variant.

## Problem
Learners hit small doubts on the exact card in front of them and leave the app to search:
1. "Und du" vs "Und Ihnen" (on the card).
2. "bitte schön" vs "gern geschehen".
3. "Is Entschuldigung the same as apology?"

These are 2-4 sentence answers about one item. They are **not** open conversations. So the product is "ask about this card", not a chatbot tab. Backend: Groq `openai/gpt-oss-120b` behind our FastAPI, tight prompt, ~150-250 output tokens (see `prompt-and-api.md`).

## Rules that apply to every option
- **No cheating rule.** Before the learner answers a step: only a **Hint** (never reveals the answer, may be pre-written or generated with "do not reveal") and all other chips are visible but disabled. After the feedback screen (right or wrong): full help. Review/recall steps follow the same rule (help after rating is shown). The server enforces it too: the client sends `phase: "before" | "after"`, and for "before" the server uses the hint-only prompt and never sends the correct answer.
- **Free, capped.** 10 questions per learner per day (visible as "7 of 10 left today · free"). Gems would punish curiosity and add economy balancing; a cap controls cost. Retries after an error do not count. Cached answers (same item + same question) do not count either.
- **Always brief**, one optional example with its English. Every answer has 👍, 🚩 Report wrong, 📝 Save as note.
- Tap targets >= 44 px, theme variables only (same tokens as `styles.css`), reduced-motion removes the dots/slide animation, the sheet sits above the keyboard (use `visualViewport` height; input stays pinned to the bottom of the sheet), and the 🐞 tab stays beneath the scrim.

## Three options for the contextual entry point

**A. Floating "?" chip opening a bottom sheet.** A "?" button is always on the lesson screen. Tap: sheet with context header, chips and input.
- Good: always reachable, one pattern everywhere. Bad: competes with the 🐞 tab and the text-size button at the screen edge; invites tapping before answering (needs the lock rule everywhere); chips appear before the learner has feedback to ask about.

**B. Inline "Ask" row under the feedback card with suggestion chips (mockup 01).** After the answer the feedback bar shows 3 context chips (e.g. "Und du vs Und Ihnen?", "Why is this the answer?", "Example sentence") plus "Ask my own". Tap a chip: sheet opens and the answer arrives. Before answering the same row shows a dashed, disabled set with only "Give me a hint" active.
- Good: appears exactly when the learner is curious (after feedback), natural lock rule, chips remove typing on a phone (most doubts are one tap), no new floating element. Bad: not visible on steps without a feedback screen (flip/read cards need their own row, see below); adds height to a screen that is already full.

**C. "More info ⓘ" tidbit button giving one answer first (mockup 04 uses it for reader cards).** One tap, one pre-chosen question ("In plain words" / "What else should I know?"), answer appears inline under the card, then "Ask a follow-up" opens the chat.
- Good: lowest friction, cheapest (the one answer is cache-friendly, even pre-generated offline for popular items), feels like content not chat. Bad: only fits "explain this", not "compare X and Y" doubts (feedback 1 and 2), so it cannot be the only entry point.

| | A floating ? | B inline chips | C tidbit button |
|---|---|---|---|
| Answers feedback 1, 2, 3 | yes (typing) | yes (one tap) | partly |
| Cheat risk | high | low | low |
| Screen clutter | edge conflicts with 🐞 | one row | one button |
| Typing needed | often | rarely | never |
| Cost per use | uncontrolled | medium, cacheable | lowest, cacheable |
| Fits flip/read/listen steps | yes | needs a row | yes |
| Build effort | small | small-medium | smallest |

## Recommendation
**B for lesson steps, C for flip/read cards and the skill-tree reader, one shared bottom sheet for follow-ups.**
1. B suits the moment of doubt (the feedback screen) and makes the anti-cheat rule a by-product: the row is locked until the answer exists.
2. Chips mean most questions cost one tap, which matters on a phone and keeps the model's scope narrow (better answers, more cache hits).
3. C covers read-only cards where there is no answer to wait for ("Explain simply" in the reader, "More about this word" on a flip card).
4. A is rejected: it fights the 🐞 tab and the text-size button, and begs to be used before answering.
5. One sheet component keeps the build small and theming uniform.

### MVP (build first)
- `POST /api/ask` + the sheet component + chips on the feedback bar (MC, typing, say, speak steps) + "Explain simply" on reader cards.
- Daily cap with counter, error/offline/cap states, 👍/🚩, response cache, logging.
- Chips are generated by the app from item data (no model call): "Why is this the answer?", "Example sentence", "Formal or informal?" (only when the item has a register tag), "X vs Y?" (when the app knows a similar item, e.g. distractor options; this is the Und du / Und Ihnen case).

### Later
- 📝 Save as note + per-word notes shown on the word detail and on the Ask & Notes screen.
- Streaming tokens (feels faster than 1-3 s of dots), pre-generated tidbits for the top ~200 doubts per course.
- Pick-a-word entry (standalone), spaced re-surfacing of saved notes in reviews.
- Weekly quality review of 🚩 reports from the logs.

## Standalone screen: verdict
**Do not add a tab.** An empty chat invites off-topic use, costs money, and the bot knows nothing about what the learner is looking at, which is its whole value. Add a small "Ask & Notes" screen (mockup 03) reached from Words and Settings that provides what the sheet cannot: pick any word or lesson to ask about (so it is pre-seeded with context), and the saved notes list. History is just "recent questions" and saved notes, not an endless transcript. Ship after the MVP, and only if the MVP's usage shows people save notes.

## Mockups
| File | Shows |
|---|---|
| `01-lesson-ask.html` | Step before answering (locked chips, hint only) and after feedback with the sheet (Und du / Und Ihnen), typing indicator, error retry; theme switch |
| `02-states.html` | Loading, error, daily cap reached, off-topic decline + offline banner (Calm) |
| `03-standalone.html` | Ask & Notes screen with word picker, saved notes, bitte schön / gern geschehen |
| `04-reader-card.html` | Reader card with "Explain simply" tidbit and Ask (Calm) |

## Open questions for the owner
- Daily cap of 10: right number? (Cost estimate in `prompt-and-api.md`.)
- Should the hint before answering be model-generated or only authored hints? MVP suggestion: authored where they exist, otherwise a canned "Look at the gender/ending/the speaker" hint.
- Should the learner's UI language (Hindi hints exist in the app) be offered for answers? Prompt supports a `ui_lang` field; default English.

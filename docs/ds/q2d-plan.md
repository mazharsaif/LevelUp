# Plan: "Question to Decision" track (Data Science course)

Source: four free AI Analyst Lab PDFs (in ~/Downloads, 11-26): *The Question-to-Decision Playbook* (41 pp, the master guide) and its three parts as separate guides: *From a Fuzzy Ask to a Sharp Question*, *Metrics That Matter*, *Land the Recommendation*. The playbook = the three parts almost word for word, about 14k unique words.

The guide `docs/guides/ds-q2d.md` keeps the original text where possible (shortened), with the NovaMart store example swapped for Parla, a made-up language app (user's choice, 11-26; no licence is stated in the PDFs). The About credits the source.

## Home
New tree `ds`, course `ds-basics` ("Data Science", now "Coming Soon") switched to `type: "tree"`, `content: "data/ds-path.json"`. First branch `q2d` ("Question to Decision", 🧭).

## Tree (3 columns; Q = question path, M = metric path)
| Row | col 0 | col 1 | col 2 |
|---|---|---|---|
| 0 | | 01 Analytics loop | |
| 1 | 02 Question ladder | | 05 Metric anatomy |
| 2 | 03 3-check test | | 06 Metric trees |
| 3 | 04 Pick & prioritise | | 07 Guardrails |
| 4 | | 08 North Star (← 04, 07) | |
| 5 | | 09 How deep to go | |
| 6 | 10 Sanity checks | | 12 Recommend & tailor |
| 7 | 11 Mix shift & confounds | | 13 Close the loop |
| 8 | | 14 Capstone, boss (← 11, 13) | |

Practice questions: 5–6 per skill (`tools/quiz_src/ds_q2d.py`), boss 10.

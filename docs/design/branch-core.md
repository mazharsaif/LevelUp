# Branch centre circle (feedback 11-23, "I never knew the central button was a how-to")

The circle in the middle of a skill-tree branch opens the branch's About page, but nothing said so.

| Option | What it is | Verdict |
|---|---|---|
| A. Look like a button | Pulsing ring until About has been opened once, an "ⓘ About" pill under the circle (always), the top-right About button turns blue until opened | **Shipped** |
| B. Say it once | A dashed hint line above the map: "New here? Tap the centre circle (or About)…", gone after About is opened; per branch and device (`a1.about.<course>.<branch>`) | **Shipped** (with A) |
| C. Make it compulsory | Open About automatically the first time a branch is opened | Not shipped: it covers the map every first visit and breaks the test flow; easy to add if wanted |
| D. Skill 0 | Turn the centre into an "About" node in the path with its own ring | Later: needs layout changes in the Path view |

# Question to Decision

## How to use this track

Getting the answer used to be the hard part of analytics. You needed SQL, a warehouse, a spare afternoon and often a data team with a two-week backlog. Now you can point an AI at a dataset and get a chart in ninety seconds. So the bottleneck moved. It is no longer "can we get the number". It is everything a number cannot do on its own: asking the right question, defining the number so it cannot lie to you, and turning the result into a decision someone acts on.

An AI will happily answer a bad question. It will compute a metric without ever asking what counts. It will never walk into a room and say "here is what we should do". That judgment is still yours, and it is the highest-leverage skill in the whole workflow. This track is a thinking system for it, in three parts: **sharpen the question**, **choose the metric that answers it**, and **land the recommendation**. About an hour of reading, 13 skills plus a capstone.

The text is adapted from the free AI Analyst Lab guides *The Question-to-Decision Playbook*, *From a Fuzzy Ask to a Sharp Question*, *Metrics That Matter* and *Land the Recommendation*, shortened, with the running example changed to a language app.

### Meet Parla (our running example)

**Parla** is a made-up language-learning app. It is past the startup stage but far from the biggest: roughly 200,000 accounts, about 50,000 people learning in a normal week. Lessons are free. It also sells a paid plan, **Parla Plus**: new members get a 7-day free trial, then choose a monthly or yearly plan. Plus members get offline lessons and no ads. A lot of the interesting questions at Parla are about whether Plus is worth the investment.

- The **funnel** is the path a learner walks: install, sign up, finish a first lesson, open the Plus payment screen, pay. Fewer people reach each step. **Conversion** means moving from one step to a later one. **Checkout conversion** is the share of payment-screen visits that end in a purchase: if 100 visits produce 8 purchases, it is 8%.
- A **segment** is a slice of your users: Android versus iOS, new versus returning, one sign-up source versus another.

Two people show up in the examples. **Nadia** is the product manager who owns Parla Plus; she drops most of the vague requests and sits in most of the rooms where decisions get made. **Sam** is the data scientist. This is the role you are learning to think like.

### What you will be able to do

| Skill | You can |
|---|---|
| The analytics loop | Name the seven steps and where the time should go |
| The question ladder | Climb from a vague ask to goal, decision, metric and hypothesis |
| The 3-check test | Score a question and upgrade a weak one |
| Pick & prioritise | Pick the best framing and decide what to answer this week |
| Metric anatomy | Write a metric spec two people would compute the same way |
| Metric trees | Break a number into drivers that rebuild it |
| Guardrail metrics | Protect what a change could quietly wreck |
| The North Star | Pick the one number that captures real customer value |
| How deep to go | Match the depth of the work to the stakes |
| Sanity checks | Pressure-test a result before you stake your name on it |
| Mix shift & confounds | Spot clean data that still lies |
| Recommend & tailor | Turn a finding into a 3-line ask for any room |
| Close the loop | Check whether the decision worked |
| Capstone | Run the whole loop on a new case |

### Order

Start with **The analytics loop**. Then two paths run side by side: the question path (ladder, 3-check, pick & prioritise) and the metric path (anatomy, trees, guardrails). They meet at **The North Star**. **How deep to go** opens the last stretch: one path checks the result (sanity checks, mix shift & confounds), the other delivers it (recommend & tailor, close the loop). The capstone needs both.

## 1. The analytics loop

Before any single tool, it helps to see the whole shape of a good analysis. Every solid piece of analytical work walks the same seven steps, and the best analysts spend most of their time on the first three.

### Seven steps

**Goal → Question → Metric → Analysis → Insight → Decision → Story**, then back to the start: *did it work?* (close the loop).

| Step | The question it answers |
|---|---|
| 1. Goal | What business outcome are we trying to achieve? |
| 2. Question | What do we need to learn to get there? |
| 3. Metric | What number tells us the answer? |
| 4. Analysis | Pull the data, run the query, build the chart |
| 5. Insight | What did we actually learn? |
| 6. Decision | What should we do differently? |
| 7. Story | Package the insight so it changes behaviour |

### Notice where the work is

Most people jump straight to step 4, the analysis, because that feels like doing something. The best analysts spend most of their time on steps 1 to 3: goal, question and metric. Get those three right and the analysis almost writes itself. Get them wrong and no amount of SQL, and no amount of AI, will save you.

A quick self-check: on your next request, notice how you split your time. If you spent twenty minutes on goal, question and metric and ten minutes on the rest, you walked the loop right. If you jumped straight to pulling data, you did the junior move.

### Each shortcut has a predictable cost

| Skip | And |
|---|---|
| The goal | You build a dashboard nobody uses |
| The question | You answer the literal ask, not the real one |
| The metric | Three teams report three different numbers |
| The insight | You hand over a table; they say "so what?" |
| The decision | The finding dies in a Slack thread |
| The story | The work stalls; engineering never ships it |
| Closing the loop | Nobody learns what actually worked |

### How this track maps onto the loop

Skills 2 to 4 live in steps 1 to 3, the front of the loop, where most wasted analysis is born and where AI is worst without you. Skills 5 to 8 go deep on step 3, the metric. Skills 9 to 13 cover steps 5 to 7 and the return arrow. Every closed loop hands you a sharper question than the one you started with, which is how analytical work compounds instead of resetting to zero every sprint.

### Self-check

1. Name the seven steps in order.
2. A team has a dashboard nobody opens. Which step was most likely skipped?
3. Which three steps deserve most of your time?

**Answers.** 1: Goal, Question, Metric, Analysis, Insight, Decision, Story. 2: The goal. 3: Goal, question and metric.

## 2. The question ladder

Vague requests are the normal state of the world. "Can you look at engagement?" "How's Plus doing?" "Something feels off with sign-ups." Your job is to climb from that fog to a question sharp enough to answer. The question ladder is how you climb, one rung at a time.

### Four rungs

| Rung | Ask |
|---|---|
| 1. Goal | What are we actually trying to achieve? |
| 2. Decision | What choice will this inform? |
| 3. Metric | What specific number tells us the answer? |
| 4. Hypothesis | What do we expect to find, and why? |

**Goal.** The outcome the stakeholder actually cares about, not "look at X". A real goal sounds like "increase how many Plus free trials turn into paying members, so the marketing spend pays off", not "pull some data on Plus".

**Decision.** The fork in the road. If the answer would not change any decision, the analysis usually is not worth doing right now. A decision sounds like "should we do A or B?" (A strong default, not an absolute ban: skill 4 covers the low-stakes questions worth parking rather than killing.)

**Metric.** A definition, not a concept. It names tables, segments and time windows. The word "engagement" fails this test. "How many free trials convert to paid, from the subscriptions table, broken down by acquisition channel (how the learner first found us: paid ads, app-store search, referral), over 90 days" passes.

**Hypothesis.** A prediction specific enough to be wrong. It names a segment, a mechanism and a direction. Without one, every result looks like noise and nothing looks surprising.

A note on the order: hypothesis comes last here, after the metric. Some analysts form a hypothesis earlier; both work. Metric-first suits the usual case, reacting to someone else's vague ask, where the smart first move is to pin down what is even measurable before you guess at the answer.

### The ladder in action

Nadia sends this: "Hey, can you look at Parla Plus engagement? Leadership wants an update."

That is a classic fuzzy ask. "Engagement" could mean ten things, and "an update" is not a decision. Before pulling a single row, Sam climbs the ladder.

- **Goal.** One clarifying question reveals it: leadership is deciding whether to keep investing in Plus-only features or pivot that effort into the free lessons. So the goal is: determine whether Plus features justify continued investment.
- **Decision.** Invest more in Plus features, for example making **Word Bank** (a button that saves a word to review later, like a bookmark) easier to find, versus redirecting those resources to the free experience.
- **Metric.** Not "engagement". Three concrete numbers, read together: how many Plus members use Word Bank; whether Word Bank users stick around longer than non-users after 30 days; and whether they complete more lessons.
- **Hypothesis.** Word Bank adoption is probably under 20% because the button is easy to miss, but members who use it likely retain better and learn more. If that is true, the answer is not "abandon Plus", it is "make the feature easier to find".

We started with "look at engagement" and ended with a testable prediction that points at a specific action.

### What skipping a rung costs, and three mistakes

| Skip | And |
|---|---|
| Goal | You optimise the wrong thing |
| Decision | Your work does not matter |
| Metric | You measure vibes |
| Hypothesis | You miss the surprises |

- **Skipping the decision rung.** Jumping from goal straight to metric feels productive, but it produces dashboards no one opens.
- **A hypothesis that cannot be wrong.** "Members are cancelling a lot" (often called **churn**: a customer stops paying or leaves) is a fact, not a hypothesis. Name the segment and the mechanism: "Cancellations are concentrated among members who signed up during a promotion and never used a Plus feature."
- **Metrics without tables.** "User engagement" means three different things to three analysts. Name the table, the segment and the window.

### Self-check

1. What is the job of the decision rung?
2. Rewrite "churn is high" as a hypothesis.

**Answers.** 1: It names the choice the answer will inform; if no answer would change a decision, the analysis usually isn't worth doing now. 2: For example: "Cancellations are concentrated among members who joined during the New Year promotion and never used a Plus feature."

## 3. The 3-check test

The ladder builds a question. The checklist validates it. Before you write a single query, run your question through three checks. A good analytical question passes all three.

### The three checks

| Check | Ask | The test |
|---|---|---|
| Decision-tied | What decision does this inform? | Can you finish "if the answer is X we do Y, if it is Z we do W"? |
| Data-grounded | Can I answer it with data that exists and is available now? | Name the behaviour, state or event it depends on, and confirm you can see it in time |
| Specific enough | How will I know when I'm done? | Can you sketch the chart, table or number before you start? |

| Check | Passes | Fails |
|---|---|---|
| Decision-tied | "Which courses have a first-week quit rate over 15%, so we decide whether to rewrite their first lessons or tighten ad targeting?" | "What is Parla's daily active user count?" |
| Data-grounded | "At which sign-up step do users drop off, by device?" | "What are users thinking when they leave the payment screen?" |
| Specific enough | "Do Plus members who use Word Bank have higher 90-day retention, by plan type?" | "How is Plus engagement?" |

The failing examples fail for concrete reasons. A daily active user count does not, on its own, tell anyone what to do. What users are "thinking" is a real question, but it is not in any behavioural database; it needs a survey or interview, a different method, not a query. And "how is engagement" has no finish line, so you could dig forever.

**Data-grounded quietly includes timing.** Data that will not exist for another month is not available data. A question can be perfectly framed and still be un-runnable today because the experiment has not gathered enough results, or the window you need has not closed. Ask not just "does this data exist?" but "can I see enough of it, now, to answer within my decision window?"

### Score it out of three

One point per check passed. A check can half-pass, when a question gestures at, say, a decision but does not name the options: score that half a point.

| Score | Meaning |
|---|---|
| 3 of 3 | Ready for analysis. Go build it |
| 2 of 3 | Fix the one failing check before you start |
| 1 of 3 | Needs a real rewrite |
| 0 of 3 | Start over and climb the ladder first |

### Bad, better, good

- **Quitting.** Bad (0): "How are our courses doing?" Better (2): "What is our quit rate?" Data-grounded and specific, but tied to no decision. Good (3): "Which courses have a first-week quit rate above 15%, and does it track with how the learner was acquired? The answer decides whether we rewrite those first lessons or tighten acquisition targeting."
- **An onboarding redesign.** Bad (1): "Do users like the new onboarding?" "Like" is not a behaviour you can observe. Better (2): "Are users engaging with the new onboarding?" "Engaging" is undefined. Good (3): "Do users in the new onboarding group finish a first lesson at a higher rate than the old group, by device, over the test period?"
- **Company health.** Bad (0): "Is Parla healthy?" Better (1): "What are our key metrics this quarter?" Good (3): "Based on this quarter's trends, should we prioritise reducing Plus cancellations or improving Android checkout conversion?"

### The quick upgrade formula

Staring at a weak question? Add three things: **a decision** ("...to determine whether we should do A or B"), **a specific metric** (replace engagement, performance, health with a named number), and **a time window and a comparison** ("...over the last N days, compared to a benchmark").

Before: "How's the onboarding redesign doing?" After: "Among users assigned to the new onboarding, what is the first-lesson completion rate versus the old flow, by device, over the test window, and does the lift justify a full rollout?"

The single most useful sentence template in this track:

> [specific metric or observation] + [timeframe or comparison] + so we can decide: [specific action]

Any question in that shape passes all three checks by construction. When you are stuck, fill in the blanks.

### A sharpening gallery

These span other industries on purpose; watch the shape of the rewrite, not the domain.

| Fuzzy | Sharp |
|---|---|
| "Our churn seems high, can you look into it?" | "Which segment drove the jump in cancellations in the last 4 weeks versus the prior 4, by plan tier and region, so we decide where to focus retention?" |
| "Why are sales down this month?" | "Did checkout conversion drop after the May redesign, and is it concentrated on mobile, so we decide whether to roll back the mobile flow?" |
| "Are fraud losses a problem?" | "Did the dispute rate exceed 0.9% for any product category last month, so we decide which categories need extra verification?" |
| "How are our ads performing?" | "Which paid channels took over 12 months to earn back what we spent to acquire this quarter's customers, so we decide where to cut spend before the budget locks?" |
| "Active users dropped 10%, what happened?" (interview) | "Before I dig in: is the drop sudden or gradual, week-over-week or year-over-year, and were there any launches, outages or holidays in that window?" |

### Self-check

1. Score "What do learners think of the new mascot?"
2. A strong question needs data from a test that ends next month. Which check does that touch?

**Answers.** 1: 0 of 3: no decision, not observable in behavioural data, no finish line. 2: Data-grounded (timing): grade it strong, but park it until the data exists.

## 4. Pick & prioritise

Often you do not have one vague question to sharpen. You have several plausible questions and have to pick the best framing. And once you have several good, sharp questions, you cannot answer them all this week. This skill handles both, then locks the winner on one page.

### The six questions exercise

List the candidate questions, grade each on the 3-check, choose the winner. It teaches something you feel more than you can be told: how much better a decision-forcing question is than the alternatives.

Lena, a designer, ran an onboarding test for two months, showing some new users a new onboarding flow and others the old one. Six questions get proposed:

| Question | Score | Why |
|---|---|---|
| 1. How many users went through the new onboarding? | 1 | A raw count; doesn't tell anyone whether to ship |
| 2. Is the new onboarding better than the old one? | 0.5 | "Better" by what? Half-gestures at a decision without naming one |
| 3. What is the first-lesson rate for new versus old, by device? | 2.5 | Strong on data and specificity, but asks for a chart, not a decision |
| 4. Are users happy with the new onboarding? | 0 | "Happy" isn't observable in the data (a fine survey question) |
| 5. Based on first-lesson rate, trial starts and day-7 retention by device, should we roll it out to everyone, keep iterating on Android, or revert? | 3 | Three options, three metrics; states the decision before the data |
| 6. What is the effect on 30-day retention? | 3, timing flag | Strong, but needs 30 more days of data: park it |

Winners state the decision explicitly. Losers skip it (1), hide it (2 and 4), or ask for a chart instead of a call (3). When several framings compete, reach for question 5's shape: name the options, name the metrics, and only then go to the data.

### The impact vs curiosity matrix

A question can be sharp, answerable and genuinely interesting, and still be a poor use of your time, because interesting is not the same as important. Two axes: **impact** (does the answer drive a decision?) and **curiosity** (how interesting is it to you?).

| | Low curiosity | High curiosity |
|---|---|---|
| **High impact** | Do later: important, not exciting. Automate it or answer in minutes | Do first: high value, answer now |
| **Low impact** | Skip: neither useful nor interesting. Ask what decision it serves | Be careful: fascinating, but may not drive action |

**Be careful** is the danger zone, where strong analysts lose a week to a beautiful analysis nobody uses. The rule: **high curiosity does not equal high impact.** Good analysts answer the two or three questions that move the business and can say clearly why the rest are parked. When your lead asks "why aren't you working on X?", your answer is the quadrant and the decision it is missing.

Sam gets eight questions this sprint and has time for two or three:

| Question | Impact | Curiosity | Quadrant |
|---|---|---|---|
| Which three courses should we retire based on quit rate? | High | High | Do first |
| What is the revenue impact of extending the Plus trial from 7 to 14 days? | High | High | Do first |
| What is our monthly Plus cancellation rate by acquisition channel? | High | High | Do first, but can wait if the retention roadmap isn't locked |
| What was the daily active user count last Tuesday? | High | Low | Do later: a five-minute lookup, or automate it |
| Do learners who study two or more languages have higher lifetime value? | Low | High | Be careful |
| Is app-store rating correlated with the number of languages studied? | Low | High | Be careful |
| Do users in different countries have different session patterns by device? | Low | High | Be careful |
| How many users have added a profile photo? | Low | Low | Skip |

Four ways people misuse it: **everything lands in Do first** (you have not sorted, you have panicked; force some into Be careful); **confusing interesting with high impact** (ask: if the answer is yes, what changes?); **forgetting effort is not on the grid** (a high-impact question can still be a two-week project, and two quick wins may beat it); **treating Do later like Skip** (someone is waiting on that number; just don't spend a week on it).

### The one-page question brief

Once your question is sharp, write it down. This locks the goalposts so they cannot quietly move mid-analysis.

- **Goal**: what does the business actually care about?
- **Decision**: what will we do differently once we know?
- **Metric**: which number, at what threshold, over what window, for which segment?
- **Hypothesis**: our best guess, specific enough to be wrong.
- **Rejection condition**: what result would change our mind? If nothing would, you are not testing, you are collecting backup for what you already believe.
- **Success**: the number or finding that ends the analysis.
- **Data status**: for each field, have it, partially have it, or missing. Two missing fields isn't a delay, it's a different project.
- **Sign-off**: who agreed this is the right question?

### Do it with AI in ninety seconds

Paste a prompt like this into any chat AI as your first message, then give it your vague question:

> You are the Question Quality Coach. Do NOT answer or analyse. First, score my question on the 3-check (decision-tied, data-grounded, specific enough) in one line. If it passes, say so and stop. If not, ask me ONE question at a time, only for the failed checks: "If you got a clear answer, what would you DO differently?", "What data realistically exists to answer this, now?", "How will you know you're done?" Then give 2–3 rewrites in the shape "[metric] + [timeframe or comparison] + so we can decide: [action]". For high stakes, ask what result would prove my hypothesis wrong, and which data fields I have, have partly, or lack.

If you give it a problem ("sign-ups dropped 12%") instead of a question, ask it to generate several candidate questions, score them and rank them, so you don't commit to the first framing you'd pick.

### Self-check

1. What shape do winning questions share?
2. Which quadrant holds "fascinating, but drives no decision"?

**Answers.** 1: They name the decision options and the specific metrics before going to the data. 2: Be careful.

## 5. Metric anatomy

Most teams do not have a measurement problem. They have too much measurement. A metric you have not defined carefully is not a fact. It is a vibe with a decimal point. An AI will happily compute "conversion rate" without ever asking what counts as a conversion, which is how two people end up reporting two different numbers for the same thing.

### Seven questions

Here is a sentence that sounds clear and is actually a trap: "Our checkout conversion rate is 8%." Eight percent of what? Over which days? Do refunded payments still count? Do users who never reached the payment screen count against you? Does someone who pays twice count once or twice? Every one of those choices moves the 8%. Until you pin them down, "conversion rate" is not a metric. It is a category of metrics that happen to share a name.

| # | Component | The question it answers |
|---|---|---|
| 1 | Name | What do you call it, specifically and unambiguously? |
| 2 | Numerator | What are you counting (the top of the fraction)? |
| 3 | Denominator | Out of what population (the bottom)? |
| 4 | Time window | Over what period: a fixed calendar month or a rolling last 30 days? |
| 5 | Inclusions | What counts? |
| 6 | Exclusions | What explicitly does not count? |
| 7 | Rationale | Why these choices and not others? |

### The test that catches every gap

> Could two people, each handed only your written spec and no other context, independently produce the exact same number?

If two careful analysts could reasonably compute different results, your spec has a hole. Almost every "why do our numbers disagree?" fire drill traces back to a metric that failed this test.

### The ambiguity, made concrete

Suppose the raw question is: on Android, what fraction of users convert? Decisions two analysts might silently make differently:

- **Denominator.** Every app open? Every user who finished a lesson? Or only visits that reached the payment screen? These give wildly different answers. A common, honest choice is visits that reached the payment screen, because that isolates the checkout step itself.
- **Numerator.** Purchases, sure. But do you subtract payments later refunded? A purchase refunded a week later was still a completed checkout, so most teams keep it in and track refunds separately.
- **Time window.** A rolling 28-day window (the last 28 days, recomputed each day) smooths out the fact that weekends and paydays look different from Tuesdays. A single calendar week is simpler but noisier.
- **Exclusions.** Bot traffic and Parla's own internal test accounts are not real learners. If you leave them in, you are measuring your own QA team.

Once Parla pins all seven, the metric stops being a vibe:

> **Name:** Android checkout conversion. **Numerator:** distinct Android payment-screen visits that resulted in a completed Plus purchase (refunds still count as purchases here). **Denominator:** distinct Android visits that reached the payment screen. **Time window:** rolling 28 days. **Inclusions:** monthly and yearly plans; trial and non-trial users. **Exclusions:** known bots and internal test accounts. **Rationale:** we want to isolate the payment step on Android, so the denominator starts at the payment screen, not at app open. Refunds are a separate quality issue, so we do not net them out.

With that spec, Parla can say something true and useful: Android checkout conversion sits around 6%, versus about 10% on iOS. That is a persistent, structural gap, not a bad week. With roughly 50,000 Android payment-screen visits a month, closing even part of it is real money. None of that sentence is sayable until the metric is defined, because "6% vs 10%" only means something if both numbers were computed the same way.

### The fill-in metric spec

Fill it out before you build anything, and keep it next to the analysis so the definition cannot quietly drift mid-project.

| Field | Your answer |
|---|---|
| Name | … |
| Numerator | … |
| Denominator | … |
| Time window (calendar or rolling?) | … |
| Inclusions | … |
| Exclusions | … |
| Rationale | … |
| Two-person test: could a peer, given only this, compute the same number? | yes / not yet |

A metric without a spec is just a number. The spec is what turns "8%" into something you can defend.

### Self-check

1. Why start the denominator at the payment screen?
2. State the two-person test.

**Answers.** 1: It isolates the checkout step itself, so the rate isn't diluted by people who never tried to pay. 2: Could two people, given only the written spec, independently compute the exact same number?

## 6. Metric trees

Once a metric is defined, the next question is almost always: why did it move, and what can I do about it? You cannot reach up and grab "revenue" directly. You move the things underneath it. A **metric tree** (also called driver decomposition) breaks a big number into the smaller numbers that mathematically add up or multiply to make it.

### Children must rebuild the parent

The rule that makes a tree a tree, and not just a list of related numbers: **at every level, the children must reconstruct the parent.** Multiply or add the drivers and you should get the number above them, within rounding. If not, you have written a vibe map, not a metric tree.

### A tree for Parla revenue

**Revenue = paying members × payments per member × average payment**

Read it as a sentence: revenue equals how many paying members you have, times how many payments each makes in the period (a monthly member pays up to 12 times a year, a yearly member once), times the average money per payment. Multiply the three and you get revenue back; the reconstruction test passes. For example, 20,000 members × 6 payments × $8 = $960,000.

Each driver can split one level further. Under paying members sit new members plus returning members retained. Under payments per member sits how long people stay. Under average payment sit the plan mix and discounts. Go as deep as you need to reach a number a person could actually own and move.

### Why the tree earns its keep

Over a year, Parla's Plus payments grew about 6×. On the face of it, a spectacular year; leadership wants to celebrate. The tree tells a colder story:

- **Paying members:** up enormously. Nearly all the 6× growth, roughly 99% of it, traces to this one driver. More people signed up.
- **Payments per member:** basically flat. Existing members did not stay longer.
- **Average payment:** down about 9%. More members came in on discounted plans.

Without the tree, "payments grew 6×" is a victory lap. With it, it is a warning: growth comes almost entirely from acquiring new people, while the two drivers that signal loyalty are flat and falling. Parla does not have a top-of-funnel problem. It has a retention and price problem hiding inside a good-looking headline. And the streak reminders, which exist precisely to bring people back, reach only about 3% of members: the obvious lever to pull.

### Three jobs, one mistake

- **Diagnosis.** When a number moves, the tree tells you which driver moved and which did not.
- **Focus.** It shows which lever has the most room to move.
- **Communication.** It explains a complicated number in one picture a non-analyst can follow.

The one mistake to avoid: **a driver that is just the parent wearing a disguise.** If your top metric is "active learners" and one driver is also "active learners", you renamed the number, not decomposed it. Every driver must be a genuinely different, smaller quantity you could measure and move on its own.

### Self-check

1. What makes a set of numbers a tree?
2. Members rise from 20,000 to 32,000 and average revenue per member falls from $8.00 to $7.50. What happens to revenue (per month)?

**Answers.** 1: The children must rebuild the parent when multiplied or added. 2: From $160,000 to $240,000: up 50%, driven by members (+60%) while each paid about 6% less.

## 7. Guardrail metrics

Every improvement is a trade. Make sign-up faster and you might let in more spam accounts. Lower a price and you might sell more plans at a loss. The number you are trying to move is your **success metric**. The numbers that must not get worse while you chase it are your **guardrail metrics**. Optimising a success metric without guardrails is how teams win the battle and lose the war.

### Success and guardrail

- **Success metric:** the one number this change is supposed to push in a good direction.
- **Guardrail metric:** a number that protects something you are not trying to change, and that you would roll the change back to defend.

A real guardrail passes an **independence test**: *if the feature works exactly as intended, the guardrail should not move.* If a metric moves in lockstep with your success metric whenever the feature works, it is not a guardrail. It is a **diagnostic**, a second read on the same thing. A true guardrail watches a different system, one your change could quietly damage as a side effect.

### A worked example at Parla

Parla wants more people to buy Plus, so it adds a cheaper **Plus Lite** plan at $4 a month next to the $8 plan. The success metric is checkout conversion. More people find a price they accept, so more people pay. Good. Now, what could this quietly wreck?

| Candidate | Verdict | Why |
|---|---|---|
| Average revenue per paying member | Guardrail | If the feature works, some people who would have paid $8 now pay $4. A side effect, not the goal. Roll back if it falls more than, say, 8% |
| Margin per member (revenue left after app-store fees and costs) | Guardrail | You can sell more plans and still make less money. Independent of conversion |
| 14-day refund rate | Guardrail | Protects the support and finance teams, who are not running this change. A cheap plan can mean more impulse buys and more refunds |
| Checkout conversion, yearly plan only | Fails | Re-measures the success metric on a slice: a diagnostic, not a guardrail |

A good guardrail set has two or three metrics, each protecting a different system (revenue quality, unit economics, operations), and at least one owned by a team that is not shipping the change. Left to themselves, teams pick guardrails that protect their own turf and miss the collateral damage next door.

### The confound this protects you from

Guardrails also keep you honest about what caused a win. Parla later shipped a new Android payment screen. Android conversion went from 6.0% before, to 6.5% with the redesign alone, then jumped to 9.5% during a Black Friday sale, then settled back to 6.5% once the sale ended. Read only the peak and you credit the design with a huge win. Watching the promotion calendar alongside the metric tells the truth: the redesign gave a small, real lift (6.0% to 6.5%), and the promotion did the rest. Never let one number take credit that belongs to something else. (Skill 13 returns to this episode.)

### Three ways guardrails go wrong

- **Inflation.** Twelve guardrails per feature means no guardrails, because nobody watches twelve numbers. Cap it at three.
- **No threshold.** "Monitor NPS" (Net Promoter Score, a survey of how likely customers are to recommend you) is not a guardrail. "Roll back if NPS drops more than 5 points" is. Every guardrail needs a numeric rule decided before you ship.
- **Home-team bias.** If every guardrail protects the team running the feature, you have not looked for the damage. Force at least one onto a team that is not in the room.

### Self-check

1. State the independence test.
2. Is "conversion on iOS only" a guardrail for a change meant to raise conversion?

**Answers.** 1: If the feature works exactly as intended, a real guardrail should not move. 2: No, it re-measures the success metric on a slice: a diagnostic.

## 8. The North Star

The first tools sharpen individual numbers. This one zooms all the way out. Of all the metrics you could track, which single one best captures whether customers are getting real value? That number is your **North Star metric**. Picking it well aligns a whole company; picking it badly means every decision underneath inherits the mistake.

### Vanity metrics

The most impressive-looking numbers are usually the worst North Stars. **Vanity metrics** go up and to the right and make everyone feel good without telling you whether a customer got value: total registered users, monthly revenue, daily logins. They can all rise while your product quietly stops working for people.

### Seven questions, four dealbreakers

1. Does it capture **customer value** (something the customer actually wanted)?
2. Does it reflect your **strategy** (the specific way you win)?
3. Is it a **leading** sign of success rather than a lagging result? (Leading moves before the money does; lagging only confirms what already happened.)
4. Can your team actually **move** it through the work they do?
5. Can a normal person understand it in one sentence?
6. Can you measure it reliably?
7. Is it **free of vanity** (hard to inflate without delivering value)?

Four are the real dealbreakers: **customer value, leading, movable, not vanity.** Miss any one and the metric is out, however well it scores on the rest.

The classic example: **daily active users** (DAU) counts how many people opened the app today. It looks like a health metric, but it is a headcount of logins, not value. Bots can inflate it; so can a confusing app that forces people to log in five times a day. It fails customer value and vanity, so it is out, even though it is easy to measure and understand. By contrast, Airbnb's **nights booked** is a real North Star: a booked night is genuine value, it leads revenue, the team can move it, and you cannot easily fake it.

### The North Star for Parla

| Candidate | Fails on | Verdict |
|---|---|---|
| Total registered users | Not value, easy to inflate | Vanity |
| Monthly revenue | Lagging, not leading | A result, not a North Star |
| Daily logins | Not value | Vanity |
| Weekly completed lessons | Passes all four | North Star |

Weekly completed lessons wins. A completed lesson is real value: a learner wanted to practise and did. It leads revenue instead of trailing it. Parla's product and content teams can genuinely move it. And you cannot fake one without actually doing the exercises. It reads in one sentence and is easy to measure.

### The inputs under the star

You cannot reach up and grab "weekly completed lessons" directly. Under every North Star sit three to five **input metrics**, the levers a team can actually pull. To check you have covered them, use **BDEF**:

| Kind | Question | Parla input |
|---|---|---|
| Breadth | How many customers? | New learners |
| Depth | How much does each one do? | Lessons started per session |
| Frequency | How often do they come back? | Sessions per learner per week |
| Efficiency | How reliably does it go through? | Lesson completion rate |

Move those four and the North Star follows. This is where the metric tree and the North Star shake hands: the North Star sits at the top of the tree, and its inputs are the first level of drivers. The inputs must be genuinely different from the North Star. If your North Star is weekly learners and one input is also "active learners", you renamed it. Pick a North Star that counts something happening (like lessons completed), and the levers underneath stay real.

### Self-check

1. Name the four dealbreakers.
2. Why is monthly revenue not a North Star?

**Answers.** 1: Customer value, leading, movable, free of vanity. 2: It is lagging: it confirms what already happened.

## 9. How deep to go

Most analysis dies one step before the finish line, and some of it dies from being done at the wrong depth. The biggest waste in analytics is not bad analysis. It is well-done analysis at the wrong depth: a full investigation into a number someone needed in two minutes, or a two-minute answer to a question worth six figures.

### The analysis continuum

The old binary of "reporting" versus "analysis" is too blunt. Work lives on a continuum, sorted by how often the same question comes up and how stable the logic behind it is: from **stable logic, repeated** to **changing logic, one-time**.

| Type of work | When you use it | Parla example |
|---|---|---|
| Number pull | Same question, same logic, one time | "How many lessons were completed last week?" |
| Monitoring report | Same question, same logic, on a schedule | The weekly Plus sign-ups dashboard |
| Proactive alert | Same metric, watched against a threshold | "Ping me if cancellations jump over 10%" |
| Initial exploration | New question, logic still unclear | "Payment support tickets just tripled; what happened?" |
| Deep-dive analysis | Complex question, spans weeks | "Why is Android checkout structurally worse, and what do we do?" |
| State of the business | Broad, first-time synthesis | The annual review for the board |

The rule that saves the most time: **if it is repeated and stable, automate it; save your brain for the work where the question keeps changing.** A number pull and a monitoring report should never eat an afternoon; AI can do almost all of that. Spend your judgment on the explorations and deep dives, where the logic is new and a human still has to decide what the pattern means.

### Depth is a dial, not a switch

1. **Just the number.** "Android checkout converts at 6%."
2. **Add a comparison.** "6% versus 10% on iOS." Now it means something.
3. **Add a segment.** "The gap holds across every month we have." Now it is structural.
4. **Add a cause.** "The payment step on Android is where learners drop." Now it is actionable.
5. **Add a recommendation.** "Simplify the Android payment step; the gap is worth roughly six figures a year." Now it is a decision.

Each rung costs more effort and is worth more. Nadia does not need a five-week deep dive to approve a two-day copy fix. She does need one before you ask engineering to rebuild checkout. Match the depth to the stakes before you start, and say so out loud: "this is a quick number pull" sets very different expectations than "give me a week".

### The support spike, placed on the continuum

On June 1, payment-problem support tickets at Parla tripled and stayed high for two weeks. That is not a number pull; nobody knows the logic yet. It starts as an initial exploration. An hour in, Sam finds the tickets come entirely from one version of the Android app (v2.3.0); everything else is flat. Now the question is answered and the work collapses back down the continuum, to a one-line recommendation: roll back v2.3.0.

You stop when the question is answered to the depth the decision requires, not when you run out of things you could look at.

### Self-check

1. Where is "ping me if day-7 retention drops below 35%"?
2. A finding has a number, a comparison and a segment. What two rungs are left?

**Answers.** 1: Proactive alert. 2: Add a cause, then add a recommendation.

## 10. Sanity checks

Before you build a recommendation on a result, pressure-test the result. AI makes this more important, not less, because it will hand you a confident, clean-looking number for a query that was subtly wrong, and it will never volunteer "by the way, this looks off". The mantra: **if you cannot explain why the number is what it is, do not trust it.**

### Five checks

| Check | Ask |
|---|---|
| 1. Volume | Is the sample big enough to mean anything? |
| 2. Range | Are the values inside believable bounds? |
| 3. Sum | Do the parts add up to the whole? |
| 4. Trend | Does the pattern match how the business actually works? |
| 5. Source | Is this even the right data for the question? |

### Each check, with a red flag

- **Volume.** A "44% conversion rate" for the Japanese course sounds amazing until you notice it is 4 purchases out of 9 visits. Nine visits is noise, not a rate. Before you trust any percentage, look at the raw counts underneath it.
- **Range.** An average payment of $1.9 million means someone left the test data in, or a currency is wrong. Real values live in a believable band; anything outside it is a bug until proven otherwise.
- **Sum.** If Android plus iOS plus web learners do not add up to total learners, a segment is missing or double-counted, and every per-segment number you were about to quote is suspect.
- **Trend.** If Plus sign-ups spike on a random Tuesday with no campaign behind it, that is usually a tracking glitch, not a miracle. Patterns should have a story you can tell.
- **Source.** A survey asking members if they "would recommend Parla" cannot tell you why people leave the payment screen. It is the wrong instrument for the question, however clean the data looks.

### The smell test

After the five checks, ask the oldest question in analytics: does this number pass the smell test? If someone told you a two-day copy change tripled revenue, you would not believe it, and you would be right. **Surprising results deserve more scrutiny than boring ones, not less.** A finding that survives the five checks and the smell test is one you can put your name on.

### Clean data that still lies

Volume, range and sum catch broken data. The dangerous errors come from data that is perfectly clean and still lying. Two patterns cause most of them, both inside the trend check: the average moved because the mix changed, and correlation that looks like cause. Skill 11 covers them.

**Pocket card.** Volume: raw counts big enough? (44% on 9 visits is noise). Range: values believable? (a $1.9M payment is a bug). Sum: parts add to the whole? Trend: does the pattern have a story? Source: right data for this question? Mix shift: did the average move only because the mix changed? Correlation: could a third thing drive both? Smell test: surprises get more scrutiny.

### Self-check

1. Segments add up to more than the total. What's likely?
2. Which check catches "the survey can't answer this"?

**Answers.** 1: Someone is double-counted (or a segment is defined twice). 2: Source.

## 11. Mix shift & confounds

Volume, range and sum catch broken data. The errors that fool smart people come from data that is perfectly clean and still lying. Two patterns cause most of them: an average that moved because the mix changed, and a correlation that looks like a cause.

### Trap 1: the mix changed, not the thing

In June, Parla's **activation rate** (the share of brand-new users who did something meaningful, like completing three lessons, in their first 7 days) fell from 30% to 24%. It looked like the product got worse. It had not. On June 1 marketing had launched a new TikTok ad channel, and TikTok brought a flood of lower-intent browsers. Every existing sign-up source held steady at its old rate. The company average dropped only because the mix of sources shifted toward the new, lower-converting one. This is a **mix shift**.

A small worked version, with two sources:

| Source | Rate before | Share before | Rate after | Share after |
|---|---|---|---|---|
| Existing sources | 33% | 85% | 33% | 50% |
| TikTok | 13% | 15% | 15% | 50% |

Before: 0.85 × 33% + 0.15 × 13% = 28.05% + 1.95% = 30%. After: 0.5 × 33% + 0.5 × 15% = 16.5% + 7.5% = 24%. TikTok even improved a little, existing sources held, and the total still fell 6 points.

### Simpson's paradox

When a mix shift flips the direction of the headline, it is called **Simpson's paradox**: every group improves (or holds), yet the total moves the other way, because the group sizes changed. Parla's satisfaction score did exactly this from one quarter to the next: it fell overall, even though both free users and Plus members individually got happier, because the user base tilted toward lower-scoring free users.

The fix is a reflex: **before you explain a moved average, break it out by segment.** If the segments did not move but the total did, your story is about the mix, not the product.

### Trap 2: correlation that looks like cause

Learners who use Word Bank buy Plus at about three times the rate of those who do not. That looks like a giant lever: push everyone to save words and triple your sales. But when Parla ran a proper **randomised test** (August 1 to September 30; half of learners shown Word Bank more prominently, half not), the real **lift** (the gain the feature actually caused) was small: 16.5% of the test group bought Plus versus 15.3% of the control. A difference of just over one point, only about 8% higher than the control's rate.

The 3× was almost entirely because high-intent learners, the ones already likely to buy, are also the ones who bother saving words. The button did not cause the buying; the intent caused both. Ask of any impressive gap: **could a third thing be driving both sides?** If the only evidence is that two things move together, the honest recommendation is "run a test", not "ship it everywhere".

### Confounds

A **confound** is an outside factor that could be the real cause of a result: a promotion, a holiday, an outage, a launch running at the same time. The Black Friday sale on top of the Android payment redesign (skill 7) is one. Keep the promotion and launch calendar next to any metric you report, and check it before you claim credit.

### Self-check

1. The total fell while every segment held. What happened?
2. Test 16.5%, control 15.3%. What is the lift in points and in percent?

**Answers.** 1: A mix shift: the group sizes changed toward a lower-rate segment. 2: 1.2 points; 1.2 ÷ 15.3 ≈ 8%.

## 12. Recommend & tailor

Now you have a result you trust. The job is to turn it into something a busy stakeholder can act on without reading your work. Stakeholders do not want more data. They want your recommendation. Then the same recommendation gets reshaped for whoever is in the room.

### The 3-line recommendation

| Line | Its job |
|---|---|
| 1. What we found | The finding, quantified |
| 2. What it means | The "so what", in business terms |
| 3. What to do | The specific action, with its expected value |

It compresses the classic story arc (context, tension, resolution) into something you can say out loud in fifteen seconds or drop into a Slack message.

- **What we found** has a number attached. Not "Android checkout has issues" but "Android checkout converts at 6% versus 10% on iOS". A finding without a number is an opinion.
- **What it means** translates the finding into money, users or risk, the language decisions are made in. This is the line most people skip, and skipping it is why they get "interesting" instead of "let's do it". Parla has roughly 50,000 Android payment-screen visits a month, so a 4-point gap is not a rounding error.
- **What to do** is a real ask: fund this, ship this, start this sprint. "We recommend further investigation" is not an ask. If you are not ready to say what to do, you are not ready to present.

### Weak and strong

**Weak:** "I looked at checkout conversion by platform. Android is lower than iOS. There's a chart attached showing the funnel by step. Let me know if you want me to dig further." This is a table with a sentence on top. It makes Nadia do all the work; most stakeholders won't, they'll say "thanks" and move on.

**Strong:**
- **What we found:** Android checkout converts at 6% versus 10% on iOS, and the gap holds every month, so it is structural, not a blip.
- **What it means:** at roughly 50,000 Android payment-screen visits a month, that gap is worth about six figures a year in lost sales. It is our single biggest conversion leak.
- **What to do:** rebuild the Android payment step, where learners drop most. Estimated two engineers for three weeks. If we close even half the gap it pays for itself in the first quarter.

Same analysis. The strong version states a decision, prices it and names the cost. Nadia can approve it in the meeting.

**Say what you do not know.** Naming uncertainty makes a recommendation stronger, because it shows you know where the risk is. "If we close even half the gap" is more credible than a flat promise of the whole thing. The goal is not to sound certain. It is to be worth acting on.

### The stakeholder communication matrix

| Audience | They care about | Format | Lead with |
|---|---|---|---|
| Executives | Business impact, return on the investment | 3 slides, bottom line first | The recommendation and the dollars |
| Product team | User impact, the trade-offs | 5 to 10 slides | The problem and the options |
| Engineering | Feasibility, scope, effort | A doc plus a working session | The requirements and level of effort |
| Data team | Method, whether it holds up | The full analysis | Your approach and how you validated it |

The Android finding, told four ways:

- **To the VP:** "Android checkout is leaving roughly six figures a year on the table. A three-week sprint recovers most of it. Recommend we start it this quarter."
- **To product:** "Android converts at 6% versus 10% on iOS. I see three ways to close it, with different effort and risk. I'd pick the payment-step rebuild; it has the best impact for the work."
- **To engineering:** "We want to collapse the Android payment step from three screens to one. Two engineers, about three weeks. Main risk is Google Play billing compatibility, which we should scope first."
- **To the data team:** "90 days of funnel data, about 50,000 Android payment-screen visits a month. Baseline 6.0%, iOS benchmark 10.0%. I segmented by device and month to confirm it's structural, not seasonal. Happy to walk through the query."

### The default rule

When in doubt, start with the shortest version the audience will accept. Nobody ever complained that a readout was too concise. The executive version is the hardest to write precisely because it is the shortest. And the matrix is about depth and framing, never about changing the finding: the number is the same for the VP and the data team. If you tell two audiences two different stories about what is true, you have left communication and entered spin.

### Self-check

1. Which line do most people skip?
2. What may change between audiences, and what may not?

**Answers.** 1: What it means. 2: Depth, format and the opening line may change; the finding may not.

## 13. Close the loop

The recommendation shipped. Most people stop here and never learn whether they were right. **Closing the loop** is the discipline of going back after the decision to check the outcome. It turns a one-time analysis into a track record, and, bluntly, it is how you build a promotion case: "I found a six-figure opportunity and the fix recovered most of it in year one" is a sentence you can only say if you went back and measured.

### The checklist

| At decision time | At follow-up |
|---|---|
| Document the decision that was made | Measure the actual impact |
| Define the success metric and its target | Compare it to what you predicted |
| Set a follow-up date | Write down what you learned |
| Assign an owner | Share the result with the same stakeholders |

The half everyone skips is the first. If you do not write down the target and the follow-up date at decision time, the follow-up never happens; there is always something more urgent. So book it the day the decision is made: "Android payment rebuild approved. Target: 6.0% to 8.0% conversion within 30 days of launch. I'll check on the 30th. I own it."

### Compare actual to predicted

The single most valuable step is comparing actual to predicted, because that is where your judgment improves. Parla's Android payment redesign launched on November 20. Measured carelessly, it would have fooled you badly:

| When | Android conversion | What was happening |
|---|---|---|
| Before launch | 6.0% | The old payment screen |
| Redesign live | 6.5% | New design, normal traffic |
| Nov 25 to Dec 1 | 9.5% | New design plus the Black Friday sale |
| After the sale | 6.5% | New design, normal traffic again |

"Close the loop" during Black Friday week and you would report a 3.5-point lift and credit the redesign for all of it. You would be wrong. The redesign was worth about half a point (6.0% to 6.5%, small but real). The big jump was the promotion, and it vanished when the sale ended. Closing the loop honestly means waiting for a clean window and separating what your change did from what else was going on. Sanity-checking a result and closing the loop are the same reflex applied at two different moments.

### The loop feeds the next question

The last checkbox, share the result, is not a courtesy. When Sam tells Nadia "we predicted a 2-point lift and got 0.5 from the design alone; the rest was the sale", the next analysis has started. The real question is now sharper: is a half-point structural lift worth the rebuild, and what would move the needle more? Every closed loop hands you a better question than the one you started with, and sends you back to the top of this track with a fuzzy ask that is already half sharp.

### The one-page recommendation brief

Fill this out before you present anything important:

- **The finding** (with a number): what did you actually find?
- **Sanity check passed?** Volume, range, sum, trend, source and the smell test; mix shift and correlation traps ruled out?
- **What it means:** the finding in money, users or risk.
- **The ask:** the action, its cost, and its expected value (as a range, honestly).
- **The audience version:** exec, product, engineering or data?
- **Success metric and target:** the number that will tell you it worked, and by when.
- **Follow-up date and owner.**

### Self-check

1. Which half of the checklist is usually skipped?
2. Why not measure during Black Friday week?

**Answers.** 1: The decision-time half: target, date and owner. 2: The sale is a confound that moves the metric by itself; you'd credit the redesign with the promotion's effect.

## 14. Capstone: run the whole loop

This capstone runs one new request through every skill. Try each step yourself before opening the answer. There is no single right wording; what matters is that each step does its job.

### The request

Nadia writes on Monday: "People seem to be quitting the Spanish course. Can you look into it before Thursday's planning meeting?"

What Sam knows: Spanish is Parla's biggest course. Week-4 retention for Spanish learners (the share still doing lessons four weeks after starting) fell from 30% to 26% over the last quarter. In the same quarter, marketing ran a large paid-ads campaign for Spanish in a new region.

### Step 1: sharpen the question

Climb the ladder (skill 2), then score your question (skill 3).

**Answers.** *Goal:* keep more Spanish learners learning past the first month. *Decision:* at Thursday's planning, fund a content fix for the Spanish course, or ask marketing to change the campaign's targeting (or both). *Metric:* Spanish week-4 retention, by sign-up channel and by the lesson where learners stopped, for learners who started last quarter. *Hypothesis:* part of the drop is the new ad traffic, which retains worse; and a specific early lesson causes extra quitting among all learners. *Rejection condition:* if retention fell equally in every channel and quitting is spread evenly across lessons, both ideas are wrong. "Which channels and which lessons explain the drop in Spanish week-4 retention this quarter, so we decide between fixing content and changing ad targeting?" scores 3.

### Step 2: pin the metric

Write a short spec (skill 5) and name one guardrail for whatever fix follows (skill 7).

**Answers.** *Numerator:* learners who started Spanish in the window and completed at least one lesson in their 4th week. *Denominator:* learners who started Spanish in the window and completed their first lesson. *Window:* start dates in the last full quarter. *Exclusions:* test accounts; learners who switched course (counted separately). *Rationale:* starting from the first completed lesson ignores people who only browsed. *Guardrail:* for a content change, Spanish lessons completed per learner must not fall; for a targeting change, new Spanish learners per week must not drop more than an agreed amount.

### Step 3: check the result

| Channel | Retention before | Share before | Retention after | Share after |
|---|---|---|---|---|
| Organic | 35% | 75% | 35% | 55% |
| Paid ads | 15% | 25% | 15% | 45% |

How much of the drop is mix shift? Also: within organic learners, lesson 6 (the past tense) has a 40% quit rate, against about 10% for other lessons, and it was 40% last quarter too. What does that tell you?

**Answers.** Before: 0.75 × 35% + 0.25 × 15% = 26.25% + 3.75% = 30%. After: 0.55 × 35% + 0.45 × 15% = 19.25% + 6.75% = 26%. The whole 4-point drop is mix shift: neither channel changed. Lesson 6 is a separate, older problem: it didn't cause this quarter's drop, but it is the biggest single leak in the course. Before quoting it, run the volume check (how many learners reach lesson 6?) and look for a confound (did lesson 6 change recently? It didn't).

### Step 4: recommend

Write the 3-line recommendation (skill 12) and pick a depth (skill 9).

**Answers.** *Found:* the drop in Spanish week-4 retention (30% to 26%) is entirely the new ad traffic, which retains at 15% against 35% for organic learners; neither group got worse. Separately, lesson 6 loses 40% of the learners who reach it, four times the usual rate. *Means:* the content didn't get worse, so a rewrite won't fix the headline; but lesson 6 is the biggest leak in our biggest course. *Do:* (1) ask marketing to judge the campaign on week-4 learners, not sign-ups; (2) split lesson 6 into two shorter lessons, about a week of content work. If 20,000 learners a quarter reach it, cutting the quit rate from 40% to 25% keeps about 3,000 more of them. The depth is an initial exploration that answered the question; no deep dive is needed for a one-week content change.

### Step 5: close the loop

Write the decision-time half of the checklist (skill 13).

**Answers.** *Decision:* split lesson 6; marketing reports week-4 learners per dollar. *Target:* lesson 6 quit rate from 40% to 25% within 30 days of release. *Follow-up:* 30 days after release, measured outside any promotion, with the channel split held constant so a mix shift can't fake a win. *Owner:* Sam. Then share the result with Nadia and marketing, and take the next, sharper question back to step 1.

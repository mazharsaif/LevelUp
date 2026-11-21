## How to use this track

**Monte Carlo Simulations** teaches you to answer questions about uncertainty by playing them out many times on a computer: how to build a simulation, how many runs it needs, how to make it faster, when to use it, and above all what goes wrong. It starts from zero: school maths (averages, percentages, squares and square roots) and basic Python are enough for the first skills. Every new word is explained when it first appears, and each skill starts with a short "Key word" table.

The track is a ramp. Skills 1 to 3 build intuition with coins, dice and a commute. Skills 4 to 6 add the working tools: error bars, faster sampling and the classic mistakes. Skills 7 to 9 reach university level, with the related methods, real industry uses and a full case study. By the end you should be able to design, run, check and defend a simulation at work. Plan on a bit over an hour of reading, plus the exercises.

| Key word | Plain meaning |
|---|---|
| Monte Carlo simulation | Answering a question by playing it out many times at random and averaging |
| Run | One random play-through |
| numpy | The Python library for fast arrays of numbers, used in every example |

### What you will be able to do

| After this track you can | Skill |
|---|---|
| Explain why random sampling estimates a number, and how fast the error shrinks | What Monte Carlo is |
| Turn a business or science question into a working simulation | Building a simulation |
| Seed, reproduce and parallelise runs correctly | Random numbers |
| Decide how many runs you need and report the uncertainty | How many runs? |
| Get the same accuracy with far fewer runs | Variance reduction |
| Spot the classic mistakes before they reach a slide | Mistakes & myths |
| Choose between simulation, a formula and the related methods | When to use it |
| Recognise Monte Carlo in finance, physics, graphics, trials and forecasts | Real-world uses |
| Take a real decision from question to recommendation, and pass the final test | Capstone case study |

### How the tree is laid out

The first skill is the core idea. The tree then splits: the left path is building the model, the right path is the random numbers that drive it. They join at "How many runs?". It splits again into making simulations efficient (left) and making them right (right), then into choosing methods and real uses, and ends with a capstone case study.

### Conventions

| Symbol or term | Meaning |
|---|---|
| N | number of simulation runs (trials) |
| x̂ or "estimate" | the average (or other statistic) over the N runs |
| MCSE | Monte Carlo standard error: the sampling error of the estimate |
| P50, P80 | the 50th and 80th percentiles of a simulated output |
| rng | a numpy random generator from `np.random.default_rng` |

Code is short numpy that you can paste and run (start each session with `import numpy as np`). Every number quoted in the text comes from running that code with the seed shown. Each skill ends with a self-check, and the answers are hidden behind a tap.

## 1. What Monte Carlo is

This skill explains the one idea behind every Monte Carlo simulation: when a question is hard to work out on paper, you can play it out many times at random and average the results. You only need school maths and a little Python.

| Key word | Plain meaning |
|---|---|
| Simulation | A program that plays out a situation, like a game of dice, so you can watch what happens |
| Run (or trial) | One play-through of the simulation |
| Random variable | A number whose value depends on chance, like the result of a die roll |
| Expected value | The long-run average of a random variable over very many tries |
| Standard deviation (SD) | How far a typical result lands from the average |
| Standard error | How far an average of many runs is likely to be from the true answer |

### Start with a coin

Suppose you want to know the chance that a coin lands heads, but you are not allowed to reason about it. You can still find out. Flip it and count.

Say you flip 10 times and get: H T H H T H H T H H. That is 7 heads out of 10, so your estimate is 7/10 = 0.7. Not great: the true answer is 0.5.

Now flip more. The more flips you make, the closer the share of heads gets to 0.5. A computer can "flip" millions of times in a second:

```python
import numpy as np
rng = np.random.default_rng(1)
for n in [10, 100, 10_000, 1_000_000]:
    flips = rng.integers(0, 2, n)
    print(n, flips.mean())
```

Each flip is 0 (tails) or 1 (heads), so the average of the flips is the share of heads. The output:

| Flips | Share of heads |
|---|---|
| 10 | 0.50 |
| 100 | 0.51 |
| 10,000 | 0.5002 |
| 1,000,000 | 0.500009 |

That is the whole method. **Monte Carlo = make random draws, compute the result of each, and average.** The rest of this track is about doing it well.

The line `rng = np.random.default_rng(1)` creates a random number generator. The `1` is a **seed**: it makes the "random" numbers the same every time you run the code, so you can check the output. Skill 3 explains seeds properly.

### Averages tell you probabilities and more

A die is a good next example. Roll it many times and average the numbers. The average settles near 3.5, because each face 1 to 6 is equally likely and (1 + 2 + 3 + 4 + 5 + 6)/6 = 3.5.

```python
rng = np.random.default_rng(5)
rolls = rng.integers(1, 7, 100_000)
print(rolls[:8])     # first 8 rolls
print(rolls.mean())  # near 3.5
six = rolls == 6     # True/False
print(six.mean())    # near 1/6
```

The first eight rolls are 5, 5, 1, 5, 3, 4, 4, 2. The average of all 100,000 is 3.498. The share of sixes is 0.167, close to the true 1/6.

Three ideas hide in this code:

- The die result is a **random variable**: a number that depends on chance.
- 3.5 is its **expected value**: the long-run average. Mathematicians write it E[X], read "the expected value of X". E[X] is not a value you expect on one roll (you can never roll 3.5). It is the average over very many rolls.
- `rolls == 6` gives True or False for each roll, which numpy counts as 1 or 0. A 0/1 variable like this is called an **indicator**. The average of an indicator is the share of times it was 1, which is a **probability**.

So one tool, averaging, answers "what is the typical value?" and "how likely is this event?". That is why Monte Carlo is so general.

Now a question that is a little harder by hand. In a board game you roll two dice and need 10 or more. How often does that happen?

```python
rng = np.random.default_rng(3)
d = rng.integers(1, 7, (100_000, 2))
total = d.sum(axis=1)
print((total >= 10).mean())
```

The simulation says 0.166. Counting by hand: 6 of the 36 equally likely pairs give 10 or more (4+6, 5+5, 6+4, 5+6, 6+5, 6+6), so the exact answer is 6/36 ≈ 0.167. Here you could count. In real problems with dozens of uncertain inputs you can't, but the simulation works the same way.

### Estimating π with darts

A classic example. Draw a square with sides of length 1, and a quarter circle of radius 1 inside it. The quarter circle covers π/4 of the square (about 78.5%). Throw darts at random into the square. The share that land inside the circle estimates π/4, so 4 × that share estimates π.

A point (x, y) is inside the circle when x² + y² ≤ 1.

```python
rng = np.random.default_rng(42)
n = 100_000
x = rng.random(n)
y = rng.random(n)
hit = (x*x + y*y) <= 1
est = 4 * hit.mean()
se = 4 * hit.std(ddof=1) / n**0.5
print(f"{est:.4f} ± {se:.4f}")
```

This prints `3.1378 ± 0.0052`. The true value 3.1416 is within that margin. The number after ± is the **standard error**, explained next. Note the shape of the answer: **an estimate and its likely error, never an estimate alone.**

In general, if each run produces a number f (a profit, a time, a 0/1 "did it happen"), the Monte Carlo estimate is the average of the N values of f. In symbols this estimates E[f(X)], "the long-run average of f". You will see that notation in later skills.

### How fast it gets accurate

Why does averaging work? The **law of large numbers** says that the average of many independent random results gets closer and closer to the expected value as you add more of them. Independent means one result does not affect the next, like separate coin flips.

How close? Two quantities answer that:

- The **standard deviation** (SD), written s, measures how spread out the single results are. For one die roll it is about 1.7: a typical roll lands about 1.7 away from 3.5.
- The **standard error** of the average measures how far the average of N results is likely to be from the truth. It is

```
standard error = s / √N
```

For 100,000 die rolls: 1.71 / √100,000 ≈ 0.0054. The average 3.498 is indeed within about 0.005 of 3.5. In simulation this is called the **Monte Carlo standard error** (MCSE). It is exactly the standard error of a sample mean from the statistics track: your N runs are the sample.

The **central limit theorem** adds one more fact: for large N, the average is spread around the truth in a bell-curve (normal) shape. So about 95% of the time the average lands within 1.96 standard errors of the truth. That gives the familiar 95% interval: estimate ± 1.96 × MCSE.

The √N is the catch. Here is the π example with more and more darts (seed 7):

| Darts N | π estimate | MCSE |
|---|---|---|
| 100 | 3.0800 | 0.1692 |
| 10,000 | 3.1620 | 0.0163 |
| 1,000,000 | 3.1437 | 0.0016 |

**100 times more runs give 10 times less error**, one more correct digit. Doubling the runs only cuts the error by about 29% (1/√2 ≈ 0.71). So if a result is too noisy, more runs is the slow fix. Skill 5 shows faster ones.

One good surprise: the error rate does not depend on how many uncertain inputs the model has. Trying every combination of 10 inputs at 10 values each needs 10¹⁰ evaluations. Monte Carlo's error is still s/√N with 2 inputs or 200. That is why simulation wins when many things are uncertain at once.

### Reporting a result

A simulation result is an estimate, so report it like one:

- **Give the estimate with its MCSE or a 95% interval**: "expected cost 41.2 days (MCSE 0.01)" or "P(late) = 0.58 ± 0.003". P(late) means "the probability of being late".
- **Round to the error.** With MCSE 0.0052, writing 3.13784 claims digits you do not have. Write 3.138 or 3.14.
- **Say what N and seed you used**, so anyone can repeat it.
- **Keep two kinds of uncertainty apart.** The MCSE measures only how well you computed the model's answer. It says nothing about whether the model is right. A model with wrong inputs gives a precisely computed wrong answer.

That last point is the most important sentence in this track. More runs shrink the computing error. They do nothing for a wrong model.

### Where the name comes from

The method was conceived at Los Alamos in 1946. Stanislaw Ulam, playing solitaire while recovering from an illness, wondered how often a game could be won, and realised that playing many random games was easier than the combinatorics. John von Neumann wrote the first plan for running it on an electronic computer (ENIAC) in a 1947 letter. Nicholas Metropolis suggested the name, after the Monte Carlo casino, and Metropolis and Ulam published "The Monte Carlo Method" in 1949. Random sampling to estimate numbers is older (Buffon's needle, 1777), but the computer made it a method.

### In plain words

To answer a question about chance, play it out at random many times and average the results. The average gets close to the true answer, and the error shrinks like 1 over the square root of the number of runs. Always report the error with the answer, and remember it says nothing about whether the model itself is right.

### Exercises

**Exercise 1. Watch the error shrink.** Estimate π with one million darts. Compute the running estimate after every dart, then print the error after 100, 10,000 and 1,000,000 darts. Multiply each error by √N. If the s/√N rule holds, that product should stay roughly constant, near the SD of one dart's result (4 × √(p(1 − p)) ≈ 1.64, with p = π/4).

**Answers.** With seed 1 the errors are 0.102, 0.0148 and 0.0016, and error × √N is 1.02, 1.48 and 1.60: roughly constant, as the rule predicts. Any single error is random, so expect the products to bounce around 1.6 rather than match it.

```python
rng = np.random.default_rng(1)
n = 1_000_000
p = rng.random((n, 2))
hit = (p**2).sum(1) <= 1
k = np.arange(1, n + 1)
run = 4 * np.cumsum(hit) / k
for m in (100, 10_000, n):
    err = abs(run[m-1] - np.pi)
    print(m, err, err * m**0.5)
```

**Exercise 2. An area with no simple formula.** Estimate the area under the curve e^(−x²) between x = 0 and x = 1. Draw 100,000 random numbers u between 0 and 1 and average e^(−u²). Report the estimate with its MCSE and compare with the true value 0.746824.

**Answers.** With seed 2 the estimate is 0.7463 with MCSE 0.0006, so the truth is within one standard error. Why it works: the area under a curve over [0, 1] equals the curve's average height, and averaging at random points estimates that average height.

```python
rng = np.random.default_rng(2)
n = 100_000
f = np.exp(-rng.random(n)**2)
est = f.mean()
se = f.std(ddof=1) / n**0.5
```

### Self-check

1. You flip a coin 20 times and get 13 heads. What is your estimate of P(heads)?
2. What is the expected value of one roll of a fair die, and can a single roll equal it?
3. An indicator is 1 when a project is late and 0 otherwise. Its average over 1,000 runs is 0.3. What does 0.3 mean?
4. To cut the standard error by 10 times, how many times more runs do you need?
5. Your simulation's MCSE is tiny. Does that mean the answer is right?

**Answers.** 1: 13/20 = 0.65. 2: 3.5; no, a die only shows whole numbers, so 3.5 is a long-run average, not a possible roll. 3: The estimated probability of being late is 30%. 4: 100 times, because the error shrinks with the square root of N. 5: No. It means the model's answer is computed precisely. Whether the model and its inputs are right is a separate question.

## 2. Building a simulation

This skill shows how to turn a real question into a working simulation, step by step: decide what you want to know, write down how things combine, describe what is uncertain, run it, read the results and check them. Most of the value, and most of the mistakes, come before any random number is drawn.

| Key word | Plain meaning |
|---|---|
| Distribution | The list of possible values of an uncertain quantity and how likely each one is |
| Uniform distribution | Every value in a range is equally likely, like a bus that comes at any moment in the next 10 minutes |
| Triangular distribution | Values between a minimum and a maximum, most likely near a chosen "most likely" value |
| Histogram | A bar chart of how often each range of results came up |
| Percentile (P80) | The value that 80% of runs come in at or below |
| Correlation | How strongly two quantities rise and fall together, from −1 to +1 |

### A first simulation: your commute

You leave home at 8:00 for a meeting at 8:35. How likely are you to be on time?

The trip has three parts:

- A 5-minute walk to the stop. This never changes.
- The wait for the bus: anywhere from 0 to 10 minutes, all equally likely. That is a **uniform** distribution.
- The ride: usually about 20 minutes, never under 15, up to 30 in heavy traffic. That is a **triangular** distribution with minimum 15, most likely 20 and maximum 30.

A quick guess with "typical" values says 5 + 5 + 20 = 30 minutes, so you would always make it. The simulation tells a different story:

```python
rng = np.random.default_rng(8)
n = 100_000
walk = 5  # minutes, fixed
wait = rng.uniform(0, 10, n)
ride = rng.triangular(15, 20, 30, n)
trip = walk + wait + ride
print(trip.mean())
print(np.percentile(trip, [50, 80]))
print((trip <= 35).mean())
```

| Result | Value |
|---|---|
| Average trip | 31.7 minutes |
| P50 (half of trips are shorter) | 31.6 minutes |
| P80 (80% of trips are shorter) | 35.3 minutes |
| Chance of arriving by 8:35 | 0.78 |
| Chance of the "typical" 30 minutes or less | 0.36 |

So you are late about one day in five. The typical-values guess misses because the ride can run 10 minutes long but only 5 short. Notice the pattern used in every simulation here: one array of 100,000 possible values per input, then the same arithmetic you would do for a single day.

### The seven steps

| Step | Question to answer | Typical output |
|---|---|---|
| 1. Question and metric | What decision does this support? What number decides it? | "P(launch by day 40)", "P80 cost" |
| 2. Model the system | How do the inputs combine into the output? | A function `outcome(inputs)` |
| 3. Input distributions | What is uncertain, and how uncertain? | One distribution per input |
| 4. Dependence | Which inputs move together? | Correlations or a copula |
| 5. Run N trials | How many, which seed? | Arrays of inputs and outputs |
| 6. Analyse | What does the output distribution say? | Mean, percentiles, P(target), drivers |
| 7. Validate | Does the model match known answers or history? | Checks, back-tests |

In the commute, step 1 was "chance of arriving by 8:35", step 2 was "walk + wait + ride", and step 3 was the uniform and triangular choices. Start from step 1. A simulation without a decision attached tends to grow forever. "Simulate our supply chain" is not a question; "how much safety stock keeps stock-outs below 2% of weeks" is.

### Modelling the system and choosing inputs

The model is ordinary code with no randomness in it: given one set of inputs, compute one outcome (a **deterministic** model). Write and test it with fixed inputs first, then make the inputs random. Keep it **vectorised**: each input is an array of N draws, and the model works on whole arrays at once, as `walk + wait + ride` did. In numpy this is often 100× faster than a Python loop over runs.

For each uncertain input, pick a distribution that matches what you actually know. Some new names appear here: a **lognormal** is a skewed shape for positive amounts, a **Poisson** counts events such as arrivals per hour, and a **Bernoulli** is a single yes/no event.

| What you have | Good choice | Notes |
|---|---|---|
| Lots of relevant data | Empirical (resample the data) or a fitted distribution | Resampling keeps real shape and tails |
| An expert's min, most likely, max | Triangular or PERT | PERT puts less weight on the extremes |
| A positive quantity that multiplies (prices, durations) | Lognormal | Right-skewed, never negative |
| Counts of rare events per period | Poisson | Arrivals, defects, claims |
| A yes/no event with a probability | Bernoulli | Risk events: "supplier fails, 10%" |
| Only a plausible range | Uniform | Honest when you know nothing more |
| Values with fat tails, where extremes are common (returns, losses) | Student-t, a bell shape with heavier tails | The normal bell curve underweights extremes |

Two cautions. Experts' "min" and "max" are usually too narrow, so ask for a P10 and P90 and widen if in doubt. And do not fit a fancy distribution to 15 data points: with little data, a simple shape and an honest range beat a precise-looking fit.

### Dependence between inputs

Back to the commute. On a rainy day the bus comes late **and** the ride is slow. Wait and ride move together. If you simulate them as unrelated, bad waits and bad rides rarely land on the same day, and the late tail looks smaller than it really is.

The same happens at work. Cost overruns in labour and materials share causes (scope creep, inflation). Ignoring that makes the total look safer than it is.

The simplest tool is a **correlation** between inputs. To give linked inputs any shapes you like, use a **Gaussian copula**. In plain words: draw pairs of linked bell-curve numbers, turn each into a "position" between 0 and 1 (its percentile), then read off the value at that same percentile in each input's own distribution. Two inputs that are both at their 90th percentile on the same run are "bad together". In code, `norm.cdf` turns a bell-curve number into its percentile, and a distribution's `ppf` turns a percentile back into a value.

```python
from scipy.stats import norm
cov = [[1, 0.7], [0.7, 1]]
z = rng.multivariate_normal(
    [0, 0], cov, n)
u = norm.cdf(z)  # linked uniforms
# then: x = dist.ppf(u[:, 0]), etc.
```

Each input keeps its own distribution, and they now rise and fall together (a correlation of 0.7 in z becomes about 0.69 after mapping to two triangular inputs). In a real crisis things fail together even more than a Gaussian copula allows, so risk work often uses a Student-t copula or a shared "bad market" shock that hits several inputs at once.

### A worked example: a project schedule

Now a work-sized version of the commute. A product launch has four tasks. Build and content run in parallel after design; testing follows. Each estimate is triangular (min, most likely, max) in days. The plan, using the most likely values, says 10 + max(20, 12) + 5 = **35 days**.

```python
import numpy as np
rng = np.random.default_rng(2026)
n = 100_000
tri = rng.triangular
a = tri(8, 10, 16, n)   # design
b = tri(15, 20, 35, n)  # build
c = tri(10, 12, 30, n)  # content
d = tri(4, 5, 9, n)     # test
total = a + np.maximum(b, c) + d
print(total.mean())
print(np.percentile(total, [50, 80]))
print((total <= 40).mean())
```

| Output | Value |
|---|---|
| Mean | 41.2 days (MCSE 0.014) |
| P50 | 40.9 days |
| P80 | 45.1 days |
| P(done by day 40) | 0.42 |
| P(done by day 35, the plan) | 0.07 |

The 35-day plan is met only about 7% of the time, the commute surprise again. Two effects cause it. The estimates are right-skewed (overruns are bigger than underruns), and the `max` of two parallel tasks is pushed up by whichever one is late. Even plugging each task's **mean** into the formula gives 40.7, still below the true mean of 41.2, because `max` is nonlinear. This is the flaw of averages, covered in the mistakes skill.

### Analysing the output

Look at the whole distribution, not just the mean:

- **Histogram** of the output: shape, skew, a long tail, a second peak.
- **Percentiles** (P10, P50, P80, P90): planning numbers. Commit to a P80 date, not the P50.
- **P(target)**: the probability of hitting a deadline or budget, with its MCSE.
- **Sensitivity**: which inputs drive the output? A quick measure is the **rank correlation** of each input with the output: replace every value by its rank (1st, 2nd, 3rd...) and correlate the ranks. Show it as a **tornado chart**, bars sorted by size.

```python
def rank(v):
    return v.argsort().argsort()
r = rank(total)
for v in (a, b, c, d):
    rc = np.corrcoef(rank(v), r)
    print(rc[0, 1])
```

Here build dominates (0.80), then design (0.36), test (0.22) and content (0.19). That tells you where better estimates or risk reduction pay off. Rank correlation is a screening tool: it misses interactions and depends on the input ranges you chose.

### Validating

Validation is the step most often skipped. Before trusting a simulation:

- **Test the deterministic core** with inputs whose answer you know (all tasks fixed at their mode must give 35).
- **Check a special case against a formula** (a sum of normals has a known mean and variance).
- **Back-test against history**: did past projects land inside the simulated P10 to P90 about 80% of the time? If 9 out of 10 finished beyond your P90, your inputs are too narrow.
- **Watch for impossible values**: negative durations, probabilities above 1, stock below zero.

### In plain words

Write the situation as ordinary code first, then replace each uncertain number with many random draws from a sensible distribution, and link inputs that move together. Read the whole spread of results, not one "typical" answer, and check the model against cases you already know.

### Exercises

**Exercise 1. Three tasks in a row.** A data pipeline project has three sequential tasks with triangular estimates (min, most likely, max): ingest (4, 5, 9), modelling (8, 10, 18) and reporting (2, 3, 6) days. The plan adds the most likely values: 18 days. Simulate 100,000 runs and report the P50, the P80 and the chance of meeting the 18-day plan.

**Answers.** With seed 3: P50 = 21.5 days, P80 = 23.9 days, and P(done in 18 days) = 0.06. The plan built from most likely values is met about one time in sixteen, because every estimate is skewed to the right.

```python
rng = np.random.default_rng(3)
n = 100_000
t = (rng.triangular(4, 5, 9, n)
     + rng.triangular(8, 10, 18, n)
     + rng.triangular(2, 3, 6, n))
print(np.percentile(t, [50, 80]))
print((t <= 18).mean())
```

**Exercise 2. Correlation moves the tail.** Labour cost is triangular (80, 100, 160) and materials (40, 50, 80), in thousands. Link them with a Gaussian copula at correlation 0, 0.5 and 0.9, and print the P90 of the total each time.

**Answers.** With seed 4 the P90 is 196.4, 201.9 and 205.8. The mean total does not change (correlation leaves each marginal alone), but the upper tail grows, so a budget set at an independent P90 is really closer to a P85 when costs move together. In scipy, `triang.ppf(u, c, loc, scale)` takes c = (mode − min)/(max − min).

```python
from scipy.stats import norm, triang
rng = np.random.default_rng(4)
n = 100_000
def p90(rho):
    C = [[1, rho], [rho, 1]]
    z = rng.multivariate_normal(
        [0, 0], C, n)
    u = norm.cdf(z)
    lab = triang.ppf(u[:, 0],
                     0.25, 80, 80)
    mat = triang.ppf(u[:, 1],
                     0.25, 40, 40)
    tot = lab + mat
    return np.percentile(tot, 90)
for rho in (0, 0.5, 0.9):
    print(rho, p90(rho))
```

### Self-check

1. In the commute, why does the "typical" 30-minute trip happen only 36% of the time?
2. Why should you write and test the model with fixed inputs before adding randomness?
3. An expert gives "best case 10, worst case 20 days". What two adjustments would you consider?
4. Labour and materials overruns are simulated independently, but both rise with scope creep. Is the simulated P90 total cost too high or too low?
5. In the schedule example, why is the mean of the total (41.2) above the total computed from the mean of each task (40.7)?
6. Which percentile is a better committed deadline, P50 or P80, and why?

**Answers.** 1: The ride can run 10 minutes long but only 5 short, so its average (21.7) is above its most likely value (20); add a random wait and most trips take longer than 30. 2: So that bugs in the logic are found with known answers, separately from randomness. 3: Ask for a most likely value (triangular or PERT) and widen the range, since stated extremes are usually too narrow; ask for a P10 and P90 instead. 4: Too low: positive correlation fattens the upper tail of a sum. 5: The total uses `max`, which is pushed up by whichever parallel task runs late, so averaging the inputs first misses that effect (the flaw of averages, skill 6). 6: P80: at P50 you miss half the time; P80 leaves a stated buffer for risk.

## 3. Random numbers done right

This skill covers where a simulation's randomness comes from: how a computer makes "random" numbers, how seeds make results repeatable, how to split work across several processors safely, and how to compare two options fairly. Mistakes here produce bugs that look like results.

| Key word | Plain meaning |
|---|---|
| Pseudo-random numbers | Numbers made by a fixed recipe that look random but can be replayed exactly |
| Generator | The object that hands out those numbers, `rng` in numpy |
| Seed | The starting number for the recipe; the same seed gives the same sequence |
| Stream | One generator's sequence of numbers |
| Worker | One of several processes or machines sharing a big simulation |
| Common random numbers | Feeding two scenarios the same random draws so they can be compared fairly |

### A shuffled deck you can replay

Imagine a card dealer who shuffles by a fixed, secret routine. Start from the same deck order and you get the same "random" deal every time. Start from a different order and you get a different deal. Watching only the cards, you cannot tell it from a fair shuffle.

A computer's random numbers work like that dealer. A **pseudo-random generator** is a recipe that turns a starting number, the **seed**, into a long sequence that looks random. Same seed, same sequence. That sounds like a weakness, but it is a feature: you can rerun a simulation and get exactly the same answer, which makes results checkable and bugs findable.

### Pseudo-random generators in numpy

In numpy, create one generator and ask it for numbers:

```python
import numpy as np
rng = np.random.default_rng(123)
u = rng.random(5)        # U(0, 1)
z = rng.normal(0, 1, 5)  # N(0, 1)
k = rng.poisson(3.0, 5)  # counts
```

`rng.random` gives numbers between 0 and 1, all equally likely. `rng.normal` gives bell-curve numbers, and `rng.poisson` gives counts. `default_rng` uses the PCG64 recipe. It is fast, passes strict statistical tests, and only repeats itself after 2¹²⁸ numbers, far more than any simulation uses. The older `np.random.seed()` with `np.random.rand()` uses one hidden generator shared by all code (Mersenne Twister). It still works, but any library call that also draws from it silently shifts your sequence. Pass an explicit `rng` object into every function that needs randomness instead.

Pseudo-random generators are for simulation, not security. For tokens and passwords use the `secrets` module.

### Seeds and reproducibility

| Situation | What to do |
|---|---|
| Exploring, no need to repeat | `default_rng()` with no seed (a fresh random seed from the operating system) |
| A result you will report | Fix a seed and record it with N and the code version |
| Tests of simulation code | Fixed seed, so a failure can be replayed |
| Checking a result is not a fluke | Rerun with several different seeds; results should agree within MCSE |

Recording the seed does not make a result true; it makes it **checkable**. If changing the seed moves your answer by more than about two MCSEs, either the MCSE is computed wrongly or the runs are not independent.

Never choose the seed by looking at the output. Trying seeds until the answer looks good is cherry-picking: it is p-hacking (trying analyses until one looks significant) with a random number generator. Pick the seed before running, and if you rerun, report all runs.

### Parallel runs need independent streams

Suppose four friends help you flip coins for an experiment, but all four secretly use the same pre-recorded list of flips. You collect four copies of one list and think you have four times the data. That is the bug in this section.

When you split N runs across workers, each worker needs its **own, independent** stream. The classic bug is giving every worker the same seed:

```python
bad = [np.random.default_rng(1)
       .random(3) for _ in range(2)]
# both arrays are identical
```

With 8 workers seeded the same, you run the same 1/8 of the simulation 8 times. The output looks smooth, the MCSE computed from all runs is √8 ≈ 2.8× too small, and nothing warns you. Seeds 1, 2, 3... per worker are better but not guaranteed independent for every generator.

The right way is `SeedSequence.spawn`, which derives statistically independent child seeds from one parent:

```python
from numpy.random import SeedSequence
ss = SeedSequence(2026)
kids = ss.spawn(4)
rngs = [np.random.default_rng(k)
        for k in kids]
```

Give `rngs[i]` (or `kids[i]`) to worker i. One recorded parent seed reproduces the whole parallel run. If you call `SeedSequence()` with no argument, read `ss.entropy` and save it: that number is your seed.

The same bug hides in other places: forked processes that inherit a copied generator state, a function that creates `default_rng(0)` internally on every call, or a batch job restarted with the same seed and appended to earlier results.

### Common random numbers

To test which of two running shoes is faster, you would not have one runner try shoe A on a calm day and shoe B in a storm. You would test both in the same weather, so the weather cancels out. Common random numbers do this for simulations.

Often the question is a **difference**: is policy B better than policy A? If you simulate A and B with independent random draws, the noise in both adds up. With **common random numbers** (CRN) you feed both scenarios the **same** random inputs. Their noise is then mostly shared and cancels in the difference.

Example: a shop sells an item for 10 that costs 6. Weekly demand is Poisson with mean 100. Should it stock 110 instead of 100?

```python
rng = np.random.default_rng(11)
n = 10_000
def profit(q, d):
    return 10*np.minimum(q, d) - 6*q
d1 = rng.poisson(100, n)
d2 = rng.poisson(100, n)
ind = (profit(110, d2)
       - profit(100, d1))
d = rng.poisson(100, n)
crn = profit(110, d) - profit(100, d)
```

| Method | Estimated gain from 110 | MCSE |
|---|---|---|
| Independent draws | −26.5 | 1.03 |
| Common random numbers | −28.4 | 0.40 |

Both say stocking 110 loses money (about 28 a week). CRN's error is 2.6× smaller, which would take about 6.6× more independent runs to match. The gain is largest when the scenarios respond to the inputs in similar ways, which is the usual case when comparing close alternatives.

To make CRN work in bigger models, keep the random inputs **synchronised**: draw all inputs up front, or give each source of randomness (demand, lead times, failures) its own stream, so a change in one scenario's logic does not shift which random number goes where.

### Testing your random setup

- **Seed sensitivity**: rerun with 5 seeds. Spread of the estimates should be about one MCSE.
- **Duplicate check in parallel runs**: no two workers' first draws should be equal.
- **Known-answer test**: simulate something with a closed form (mean of an exponential, P(Z > 1.96)) through your full pipeline.

### In plain words

Computer randomness is a replayable recipe started by a seed. Record the seed so anyone can repeat your result, give every worker its own independent stream, and when comparing options, feed them the same random draws so luck cancels out.

### Exercises

**Exercise 1. Spot the bug.** This code runs a simulation on four workers. What is wrong, and how do you fix it?

```python
def worker(n=10_000):
    rng = np.random.default_rng(0)
    return rng.normal(size=n).mean()
res = [worker() for _ in range(4)]
```

**Answers.** Every worker builds its generator from seed 0, so all four return the same number: you have 10,000 runs, not 40,000, and an MCSE computed as if there were 40,000 is half the true value. Pass each worker its own child seed from one `SeedSequence`; the fixed version returns four different results.

```python
from numpy.random import SeedSequence
def worker(seed, n=10_000):
    rng = np.random.default_rng(seed)
    return rng.normal(size=n).mean()
kids = SeedSequence(7).spawn(4)
res = [worker(k) for k in kids]
```

**Exercise 2. Fix the code.** A legacy script calls `np.random.seed(0)` once and then `np.random.normal(size=n)` inside `sim(n)`. A new library call between two `sim` calls changed the second result. Rewrite `sim` so its output depends only on the generator it is given.

**Answers.** Pass a generator in. Code that draws from a different generator can no longer shift your sequence, and the same seed gives the same result every time (the check prints `True`).

```python
def sim(rng, n):
    return rng.normal(size=n).mean()
rng = np.random.default_rng(0)
a = sim(rng, 1000)
other = np.random.default_rng(9)
_ = other.random()  # other code
rng2 = np.random.default_rng(0)
print(a == sim(rng2, 1000))
```

### Self-check

1. Why prefer passing an `rng` object into functions over calling `np.random.seed()` once at the top?
2. You run 10 workers with `default_rng(42)` each, 10,000 runs per worker, and report MCSE from all 100,000. What actually happened?
3. How do you give 16 workers independent streams while recording only one number?
4. You compare two staffing levels in a queue simulation. Why use common random numbers?
5. A colleague tried seeds 1 to 20 and reported the run where the new strategy won. What is wrong?

**Answers.** 1: A global state is shared with every other piece of code that draws from it, so the sequence can shift silently; an explicit generator is isolated and reproducible. 2: All 10 workers produced the same 10,000 runs, so there are only 10,000 distinct runs and the reported MCSE is about √10 ≈ 3.2× too small. 3: `SeedSequence(seed).spawn(16)` and one generator per child; record the parent seed. 4: The same arrivals and service times hit both scenarios, so the shared noise cancels and the difference is estimated with far fewer runs. 5: Choosing the seed by its result is cherry-picking; the reported "win" may be pure noise. Pick a seed first and report all runs.

## 4. How many runs?

This skill covers how to decide how many runs a simulation needs: how big the error is for averages, probabilities and percentiles, how to plan the number of runs for a precision you choose, how to read a convergence plot, and why rare events need far more runs than you expect.

| Key word | Plain meaning |
|---|---|
| Precision | How small the error is; "±0.01" is more precise than "±0.1" |
| Half-width | The ± part of an interval: estimate ± half-width |
| Pilot run | A small first run used to measure the spread before the real run |
| Tail | The far ends of a distribution, where rare extreme results live |
| Rare event | Something with a small probability, like 1 in 1,000 |
| Relative error | The error as a share of the estimate itself, e.g. 10% |

### Think of an opinion poll

A poll of 1,000 people gives a margin of about ±3 points. A poll of 4,000 gives about ±1.5. Pollsters know that quadrupling the sample halves the margin. A simulation is a poll of possible futures, and the same arithmetic decides how many runs you need. Skill 1 gave the rule: error = s/√N. This skill turns it around: pick the error you can live with, then solve for N.

### Error for a mean

For an estimated mean, the MCSE is s/√N, and a 95% interval is the estimate ± 1.96 × MCSE. Example: the mean of a lognormal (μ = 0, σ = 1), whose true value is e^0.5 ≈ 1.6487.

```python
rng = np.random.default_rng(3)
x = rng.lognormal(0, 1, 10_000)
n = len(x)
m = x.mean()
se = x.std(ddof=1) / n**0.5
print(m - 1.96*se, m + 1.96*se)
```

The estimate is 1.6503 with a 95% interval of 1.608 to 1.693, which contains the truth.

To **plan** N for a target half-width ε at 95%, run a small pilot to estimate s, then:

```
N = (1.96 × s / ε)²
```

Here s ≈ 2.16, so a ±0.01 answer needs about (1.96 × 2.16 / 0.01)² ≈ 180,000 runs. Plan from a pilot rather than guessing a round number like 10,000; the right N can be 100 or 100 million depending on s and ε.

A heavy-tailed output makes s large and unstable. If the outcome has extreme values (losses, insurance claims), the MCSE itself is noisy, and a few huge draws can move the mean. Check by comparing estimates across independent batches.

### Error for a probability

A probability estimate p̂ is the average of 0/1 outcomes, so s = √(p(1 − p)) and

```
MCSE = √(p̂(1 − p̂) / N)
```

The worst case is p = 0.5: with N = 10,000 the MCSE is 0.005, so about ±1 percentage point at 95%. That is a useful rule: **10,000 runs pins a probability to about ±1 point.**

If you see **zero** events in N runs, the estimate is 0 but the truth is not. The "rule of three" gives an approximate 95% upper bound of 3/N. Zero failures in 1,000 runs means p could still be as high as 0.3%.

### Error for a percentile

Percentiles (P80, P99, value at risk) do not have the s/√N formula. Two easy methods:

- **Order statistics**: the number of runs below the true q-th quantile is binomial(N, q). So the sorted outputs at ranks Nq ± 1.96√(Nq(1 − q)) bracket the quantile at about 95%.
- **Batches or bootstrap**: split the runs into 20 batches, compute the percentile in each, and use the spread across batches.

```python
xs = np.sort(x)
k = 0.9 * n
h = 1.96 * (n * 0.9 * 0.1)**0.5
lo, hi = int(k - h), int(k + h)
print(xs[int(k)], xs[lo], xs[hi])
```

For the same 10,000 lognormal draws, P90 is estimated as 3.69 (interval 3.54 to 3.80; truth 3.60), and P99 as 10.0 (interval 9.16 to 10.8; truth 10.24). The P99 interval is relatively much wider: only about 100 runs land beyond it, so the far tail is thinly sampled.

### Running-estimate plots

Plot the estimate against the number of runs so far:

```python
k = np.arange(1, n + 1)
run = np.cumsum(x) / k
```

For the lognormal, the running mean is 1.692 after 100 runs, 1.710 after 1,000 and 1.650 after 10,000. A healthy plot wanders and then settles into a band that narrows like 1/√N. Warning signs:

| What you see | Likely cause |
|---|---|
| Sudden jumps late in the run | Heavy tail: rare huge outcomes dominate the mean |
| Slow drift that never settles | Variance may be infinite, or a bug (time trend in the model) |
| Too smooth, too fast | Repeated random numbers or correlated runs |
| Settles, but on the wrong value | Model bias; more runs will not help |

A plot that settles shows the computation has converged. It does not show the answer is right.

### Rare events

Imagine looking for a 1-in-1,000 event by flipping through 1,000 runs. Often you see it once, sometimes zero or two or three times. One sighting more or less changes your estimate by 100%. To pin it down you need to see it many times, which means very many runs.

For a small probability, what matters is the **relative** error:

```
MCSE / p ≈ √((1 − p) / (N p))
         ≈ 1/√(N p)
```

That depends on N × p, the expected number of hits. For 10% relative error you need about 100 hits, so **N ≈ 100 / p**. For p = 0.001 that is 100,000 runs.

| Runs | Hits (p = 0.001, seed 8) | Estimate | Relative MCSE |
|---|---|---|---|
| 1,000 | 0 | 0 | undefined |
| 100,000 | 91 | 0.00091 | 10% |

For a one-in-a-million event, plain Monte Carlo needs about 100 million runs. That is why rare-event work uses importance sampling (next skill) or extreme value methods, not brute force.

### A practical procedure

Run a pilot, decide the precision the **decision** needs (if you are at P(late) = 80% and the choice flips at 50%, ±2 points is plenty), compute N with a margin, then report the estimate with its MCSE and rerun once with another seed. Precision beyond what the decision needs is wasted compute; precision below it is a coin toss dressed up as analysis.

### In plain words

Decide how precise the answer must be for the decision, measure the spread with a small pilot, and compute the runs from N = (1.96 × s / half-width)². Probabilities need about 10,000 runs for ±1 point, tails need more, and a rare event needs about 100 sightings, so roughly 100/p runs.

### Exercises

**Exercise 1. Plan N from a pilot.** Outcomes are exponential with mean 3 (so the true SD is 3). Run a 1,000-run pilot, use its SD to plan N for a 95% half-width of 0.02, run that N and check the half-width you actually get.

**Answers.** With seed 6 the pilot SD is low, so the plan says N = 72,856, and the achieved half-width is 0.0218, a little above target. The true SD would have asked for about 86,000. A pilot's SD is itself an estimate, so add a margin (say 20 to 50%) for skewed outputs.

```python
rng = np.random.default_rng(6)
x = rng.exponential(3.0, 1_000)
s = x.std(ddof=1)
N = int((1.96 * s / 0.02)**2) + 1
y = rng.exponential(3.0, N)
h = 1.96 * y.std(ddof=1) / N**0.5
print(N, y.mean(), h)
```

**Exercise 2. A rare event by brute force.** P(Z > 3) for a standard normal is 0.00135. How many runs give about 10% relative error? Run them and compare the estimate with the truth.

**Answers.** N ≈ 100/p ≈ 74,000. With seed 7 there are 80 hits, an estimate of 0.00108 with relative MCSE 11%. The truth is about two standard errors away: with only 80 hits, a 20% miss is unremarkable. For tighter answers on rarer events, use importance sampling (next skill).

```python
from scipy.stats import norm
p = norm.sf(3)
N = int(100 / p)
rng = np.random.default_rng(7)
hits = (rng.normal(size=N) > 3).sum()
ph = hits / N
rel = (ph*(1 - ph)/N)**.5 / ph
```

### Self-check

1. A pilot gives s = 50. How many runs for a 95% half-width of 1?
2. What is the MCSE of p̂ = 0.2 with N = 4,000?
3. Zero failures in 10,000 simulated years. What is an approximate 95% upper bound on the annual failure probability?
4. You need P(loss > threshold) ≈ 0.0002 to within 10% relative error. Roughly how many runs?
5. Why is a P99 estimate noisier than a P50 estimate from the same runs?

**Answers.** 1: (1.96 × 50 / 1)² ≈ 9,604, so about 10,000. 2: √(0.2 × 0.8 / 4,000) = √0.00004 ≈ 0.0063. 3: 3/10,000 = 0.0003. 4: About 100/p = 500,000 runs. 5: Only about 1% of the runs fall beyond the P99, so few runs inform it; around the P50 half of all runs do.

## 5. Variance reduction and smarter sampling

This skill covers ways to get the same accuracy from far fewer runs: antithetic variates, control variates, stratified and Latin hypercube sampling, quasi-Monte Carlo and importance sampling. Since the error is s/√N, cutting s by 10 is worth 100× more runs.

| Key word | Plain meaning |
|---|---|
| Variance | The SD squared; the "noise power" of a result |
| Estimator | The recipe that turns runs into an answer, e.g. "average the runs" |
| Unbiased | Right on average: the estimator neither over- nor undershoots in the long run |
| Stratify | Split the range into slices and sample each slice on purpose |
| Low-discrepancy sequence | Points placed to fill space evenly, not at random |
| Importance weight | A correction factor for sampling some outcomes more often than they really happen |

### Why smarter sampling helps

Pure random sampling is wasteful in a simple way: by chance, points clump in some places and leave gaps in others. A pollster who wants a fair picture of a country does not phone 1,000 random numbers and hope; she makes sure each region is represented. Every method in this skill is a version of that idea: put the samples where they teach you most, or pair them so their luck cancels, while keeping the answer right on average.

### The idea and a test problem

Every method here lowers the **variance of the estimator** while keeping it unbiased (or nearly so). Compare methods at **equal cost**: same number of model evaluations, same wall-clock time. A method that halves the variance but takes three times as long per run is a loss.

The test problem: estimate E[e^U] for U uniform on [0, 1]. The true answer is e − 1 = 1.71828, and the variance of a single plain draw is 0.242. Every snippet below uses N = 10,000 and `rng = np.random.default_rng(0)`.

```python
u = rng.random(n)
f = np.exp(u)          # plain
```

### Antithetic variates

For each draw u, also use its mirror 1 − u, and average the pair. If f is monotone, a high f(u) is paired with a low f(1 − u), and their errors partly cancel. For normal inputs the mirror of z is −z.

```python
anti = (f + np.exp(1 - u)) / 2
```

The variance per pair drops from 0.242 to 0.0039. A pair costs two evaluations, so at equal cost the gain is about 0.121 / 0.0039 ≈ 31×. The gain depends on the function: for a call option payoff, which is flat below the strike, it is only about 1.5× (exercise 1 below). If f is not monotone (say symmetric, like u(1 − u)), antithetics can even make things **worse**.

### Control variates

Find a quantity C that is computed from the same draws, is correlated with the output, and has a **known** mean. Then correct the estimate by how far C missed its mean:

```
estimate = mean(f + b × (C − E[C]))
b = −cov(f, C) / var(C)
```

Here C = U itself, with known mean 0.5:

```python
b = -np.cov(f, u)[0, 1] / u.var()
cv = f + b * (u - 0.5)
```

Variance drops from 0.242 to 0.0039 (about 62×) at almost no extra cost. In finance the classic control for a hard-to-price option is a similar option with a closed-form price (a geometric Asian option for an arithmetic Asian one). In operations, a control can be total demand, whose mean you know exactly. The better C tracks f, the bigger the gain: variance falls by a factor of 1 − ρ², where ρ is their correlation.

### Stratified and Latin hypercube sampling

Random draws clump by chance: some regions get too many points, others too few. **Stratified sampling** splits the input range into N equal strata and draws one point in each:

```python
k = np.arange(n)
strat = np.exp(
    (k + rng.random(n)) / n)
```

On this one-dimensional problem the estimate is 1.7182829, off by about 10⁻⁹. Plain sampling with the same N was off by 0.0009.

In many dimensions, full stratification needs too many cells. **Latin hypercube sampling** (LHS) stratifies each input separately: every one of the N strata of every input gets exactly one point, and the strata are shuffled across inputs. It removes most of the variance from the main effects of each input, which is often most of the total. It is common in engineering and risk tools. scipy has it as `scipy.stats.qmc.LatinHypercube`.

### Quasi-Monte Carlo

**Quasi-Monte Carlo** (QMC) replaces random points with **low-discrepancy sequences** (Sobol, Halton) that fill space far more evenly. For smooth integrands the error can fall close to 1/N instead of 1/√N.

```python
from scipy.stats import qmc
s = qmc.Sobol(d=2, scramble=True,
              seed=1).random(2**13)
h = (s**2).sum(1) <= 1
est = 4 * h.mean()
```

Estimating π with 8,192 points, repeated 50 times, the root mean squared error was 0.0020 for scrambled Sobol and 0.0161 for plain random points: about 8× smaller, worth roughly 60× more plain runs. Points to know:

- Use powers of 2 for Sobol sample sizes; scipy warns otherwise.
- **Scramble** the sequence, and repeat with several scrambles to get an error estimate. One unscrambled QMC run has no honest MCSE.
- Gains shrink when the function is discontinuous (like the π indicator) or when many inputs matter equally. They are largest when a few inputs dominate.

### Importance sampling for rare events

To estimate a rare probability, sample more often where the event happens, then correct with weights. Draw from a proposal density g instead of the true density p, and weight each draw by w = p(x)/g(x):

```python
from scipy.stats import norm
rng = np.random.default_rng(4)
n = 100_000
y = rng.normal(4, 1, n)  # shifted
w = norm.pdf(y) / norm.pdf(y, 4)
f = (y > 4) * w
est = f.mean()
```

The true value of P(Z > 4) is 3.167 × 10⁻⁵. Plain sampling with 100,000 draws saw just 1 hit (estimate 1 × 10⁻⁵). Importance sampling gives 3.154 × 10⁻⁵ with MCSE 0.021 × 10⁻⁵: under 1% relative error. To match that, plain sampling would need close to a billion draws.

Importance sampling is powerful and fragile. A proposal with **lighter tails** than the target can give weights that occasionally explode, so the estimate looks stable for a long time and then jumps. Check the weights: if a handful of draws carry most of the total weight, the proposal is poor.

### Which method when

| Method | Typical gain | Best for | Watch out |
|---|---|---|---|
| Antithetic variates | 1.5× to 30× | Monotone models, quick win | Can hurt if the model is not monotone |
| Control variates | Large if ρ is high | A related quantity with a known mean | Needs that known mean |
| Stratified or LHS | Large for main effects | Few dominant inputs, smooth models | Error estimate needs repeats |
| Quasi-Monte Carlo | Close to 1/N error | Smooth integrands, moderate dimension | Scramble and repeat for error bars |
| Importance sampling | Orders of magnitude | Rare events, tail risk | Weights can explode |
| Common random numbers | Large for differences | Comparing scenarios | Keep draws synchronised |

Try the cheap ones first: antithetics and a control variate are a few lines of code. Always measure the variance before and after; never assume a method helped.

### In plain words

You can beat the 1/√N grind by sampling cleverly: pair opposite draws, correct with a related quantity whose answer you know, spread points evenly, or aim samples at the rare region and reweight them. Always compare at equal cost and measure the variance before and after.

### Exercises

**Exercise 1. Antithetics on an option.** Price a call (S₀ = 100, K = 105, r = 3%, σ = 20%, T = 1 year) with 200,000 plain normal draws and with 100,000 antithetic pairs (z and −z). Both use 200,000 evaluations. Compare the variance of the two estimates.

**Answers.** With seed 8 both estimates are about 7.13 (Black–Scholes gives 7.128), and the variance ratio is only about 1.5. The payoff is zero for half the draws, so z and −z often both pay nothing and little cancels. Antithetics work best when the model responds smoothly and monotonically to its inputs.

```python
rng = np.random.default_rng(8)
S0, K, r, s, T = 100, 105, .03, .2, 1
n = 100_000
def pay(z):
    ST = S0*np.exp((r - s*s/2)*T
                   + s*T**.5*z)
    d = np.exp(-r*T)
    return d*np.maximum(ST - K, 0)
plain = pay(rng.normal(size=2*n))
z = rng.normal(size=n)
anti = (pay(z) + pay(-z)) / 2
v1 = plain.var(ddof=1) / (2*n)
v2 = anti.var(ddof=1) / n
print(v1 / v2)
```

**Exercise 2. A one-in-3.5-million event.** Estimate P(Z > 5), true value 2.867 × 10⁻⁷, with 100,000 draws from N(5, 1) and importance weights. How many plain draws would give the same precision?

**Answers.** With seed 9 the estimate is 2.835 × 10⁻⁷ with MCSE 0.021 × 10⁻⁷, a relative error under 1%. Plain sampling needs N ≈ 1/(p × 0.0075²), about 6 × 10¹⁰ draws, for the same relative error.

```python
from scipy.stats import norm
rng = np.random.default_rng(9)
n = 100_000
y = rng.normal(5, 1, n)
w = norm.pdf(y) / norm.pdf(y, 5)
f = (y > 5) * w
print(f.mean(), f.std() / n**.5)
```

### Self-check

1. A method halves the estimator's variance but makes each run 3× slower. Is it worth it?
2. Why do antithetic variates help for a monotone function?
3. A control variate has correlation 0.9 with the output. By what factor does the variance fall?
4. Why must you scramble and repeat a Sobol run to report an error?
5. What is the danger sign when using importance sampling?

**Answers.** 1: No: at equal time you could run 3× as many plain runs, cutting variance by 3, which beats 2. 2: Each pair has one high and one low value, so their errors are negatively correlated and partly cancel in the average. 3: By 1 − 0.9² = 0.19, about 5×. 4: A deterministic sequence gives one number with no spread; independent scrambles give several estimates whose spread is the error. 5: A few draws carrying most of the weight, so the estimate jumps when a new large weight appears.

## 6. Mistakes, myths and misconceptions

This skill covers the errors that make Monte Carlo results wrong while looking authoritative: bad models, the flaw of averages, ignored correlation, thin tails, false precision, seed games, MCMC confusion and silent bugs. Each one has fooled experienced teams, and none is fixed by running more trials.

| Key word | Plain meaning |
|---|---|
| Bias | A systematic error: the answer is off in the same direction however many runs you do |
| Noise | Random error that shrinks as you add runs |
| Nonlinear | A model where doubling an input does not simply double the output (caps, thresholds, max) |
| Fat tails | Extreme values happen far more often than a bell curve predicts |
| Autocorrelation | Each value depends on the previous one, so values are not independent |
| Effective sample size (ESS) | How many independent draws a set of dependent draws is worth |

### Bias is not fixed by more runs

Total error has two parts:

```
error = model bias + Monte Carlo noise
```

More runs shrink only the noise, like 1/√N. Bias comes from wrong structure, wrong input distributions or missing risks, and it does not move at all. A million runs of a model that leaves out supplier failure give a very precise answer to the wrong question. This is **garbage in, garbage out**, and simulation makes it worse in one way: the output looks scientific, with histograms and percentiles, so people trust it more than a spreadsheet guess.

| Myth | Reality |
|---|---|
| "We ran a million simulations, so the answer is accurate." | It is precisely computed. Accuracy depends on the model. |
| "The histogram shows all the risk." | It shows the risks you modelled. Unknown and excluded risks are not in it. |
| "The model is validated because it converged." | Convergence is about the arithmetic, not the inputs. |

Spend effort where the bias lives: the model's structure, the input ranges, the dependencies and the risks left out.

### The flaw of averages

Picture a person who wades across a river because it is "on average three feet deep". The average hides the deep middle. Sam Savage built a book on this image, *The Flaw of Averages* (2009): **plans based on average inputs are wrong on average.** For a nonlinear model f,

```
f(average input) ≠ average of f(input)
```

**Jensen's inequality** gives the direction: if f is convex, the average output is at least f(average); if concave, at most. Whenever a model has a `max`, a `min`, a threshold, a capacity, a ratio or a product of uncertain inputs, plugging in averages is biased.

Example: a shop stocks 100 units at cost 4, sells at 10, and demand is uniform between 50 and 150 (average 100).

```python
rng = np.random.default_rng(9)
d = rng.uniform(50, 150, 100_000)
def profit(d, q=100):
    return 10*np.minimum(q, d) - 4*q
print(profit(100))       # 600
print(profit(d).mean())  # about 474
```

Average demand gives a profit of 600. The true expected profit is 475 (the simulation gives 474). Above 100 the extra demand is lost, below 100 the stock is wasted, so the average case is the best case here. The schedule example in skill 2 had the same flaw through `max`. Monte Carlo exists to fix exactly this, so the classic mistake is to build a simulation and then report **f(mean inputs)** anyway, or to average the inputs "to simplify" before calling the model.

### Wrong shapes and missing dependence

**Assuming independence.** Two costs, each normal with mean 100 and SD 20. Independent, the P90 of their sum is 236. With correlation 0.8 it is 249. The mean is 200 either way, so a check of the mean would not catch it. In markets, correlations jump towards 1 in a crisis, precisely when it matters. Ask of every pair of inputs: is there a common cause?

**Normal for fat-tailed things.** Returns, losses, claim sizes, project overruns and outage durations have fat tails. A move beyond 4 standard deviations has probability 6.3 × 10⁻⁵ under a normal. Under a Student-t with 3 degrees of freedom, scaled to the same SD, it is 6.2 × 10⁻³: about **100× more likely**. A normal model of a fat-tailed risk underestimates exactly the tail your risk metric measures.

**Overfitting inputs.** Fitting a 4-parameter distribution to 20 observations, or picking the best of 15 candidate distributions by a goodness-of-fit test, reproduces the sample's quirks. The tail of the fitted curve is pure extrapolation. With little data, prefer simple shapes, resampling, and a sensitivity run with fatter tails.

**Silent clipping and truncation.** Durations drawn as normal(3, 2) are negative about 7% of the time. Code that clips them to 0 quietly raises the mean (3.06 instead of 3) and piles 7% of runs onto exactly zero. Prices with `max(price, 0)`, probabilities clipped to [0, 1], inventories that cannot go negative: every clip changes the distribution. Use a distribution with the right support (lognormal, gamma, beta) and count how often any guard triggers.

### False precision and reporting errors

- **Too many digits.** "P(loss) = 0.231847" from 1,000 runs has an MCSE of about 0.013. Write 0.23 ± 0.03 (95%).
- **No error bar at all.** Two scenarios at 0.231 and 0.244 from 1,000 runs each are not distinguishable. Without an MCSE no one can tell.
- **Cherry-picking seeds.** Rerunning until a seed shows the answer you want is p-hacking. Fix the seed in advance and report the spread across seeds.
- **Treating P50 as the plan.** The median is missed half the time, and for skewed costs the mean is above the median. Commit to a stated percentile (P80 is common) and show the whole range.
- **Reporting the tail you can't estimate.** A P99.9 from 5,000 runs rests on 5 points. Either run far more or don't report it.

### Monte Carlo is not MCMC

**Markov chain Monte Carlo** (MCMC) is a different tool with the same surname. Plain Monte Carlo draws **independent** samples from distributions you can sample directly. MCMC builds a **chain** in which each draw depends on the previous one, to sample from a distribution you can only evaluate up to a constant, typically a Bayesian posterior.

The common mistake is treating MCMC draws as independent. Successive draws are **autocorrelated**, so 18,000 MCMC draws may carry the information of only about 2,000 independent ones (see skill 7). Using s/√N with the raw count makes the error bar 3× too small. Use the **effective sample size** (ESS) instead, and check convergence with several chains and the R-hat diagnostic. For a chain whose lag-1 autocorrelation is φ, ESS is roughly N(1 − φ)/(1 + φ): with φ = 0.9, about N/19.

### Silent bugs: units, steps and plumbing

| Bug | Symptom | Check |
|---|---|---|
| Annual volatility used per daily step | Yearly SD of 320% instead of 20% | Scale SD by √(steps per year) |
| Rates mixed (monthly vs annual) | Growth that compounds absurdly | Carry units in variable names |
| Same seed on every worker | Results too smooth, MCSE too small | Count distinct first draws |
| Inputs drawn once, reused for all runs | Zero variance in that input | Plot each input's histogram |
| Off-by-one in time loops | One step missing or doubled | Test a deterministic case |
| Percentile of a mean instead of mean of runs | Tail far too narrow | Compute statistics on the per-run outputs |

The single most effective habit: **test against a known answer.** Turn randomness off and check the deterministic case, run a special case with a closed form (Black–Scholes, a sum of normals) through the same code, and back-test against history where you have it.

### In plain words

Most simulation failures are not about the random numbers. They come from a wrong model, averaged inputs fed into a nonlinear model, missing links between inputs, bell curves for wild risks, too many decimals, and unit or clipping bugs. More runs fix none of these; checks against known answers catch most of them.

### Exercises

**Exercise 1. Spot the bug (flaw of averages).** Price is normal(50, 10), demand normal(1,000, 300), and you can sell at most 1,200 units. A colleague computes revenue as `rev(price.mean(), qty.mean())`. What is the right expected revenue, and why is theirs off?

**Answers.** Their number is 50 × 1,000 = 50,000. The simulation of revenue per run gives about 47,750 with seed 10. Capacity caps the good outcomes but not the bad ones, so the average of `min(q, 1200)` is below `min(average q, 1200)`. Always apply the model to each run, then average the outputs.

```python
rng = np.random.default_rng(10)
n = 100_000
price = rng.normal(50, 10, n)
qty = rng.normal(1000, 300, n)
def rev(p, q):
    return p * np.minimum(q, 1200)
print(rev(price, qty).mean())
```

**Exercise 2. Fix the clipping.** Task durations were drawn as `np.clip(rng.normal(3, 2, n), 0, None)`. Replace this with a lognormal that has the same mean 3 and SD 2, and compare the mean, the SD and the share of exact zeros.

**Answers.** With seed 11 the clipped version has mean 3.06, SD 1.89 and 6.8% exact zeros. The lognormal has mean 3.00, SD 2.00 and no zeros. A lognormal with mean m and SD s has σ² = ln(1 + (s/m)²) and μ = ln m − σ²/2.

```python
rng = np.random.default_rng(11)
n = 100_000
m, s = 3, 2
sl = np.sqrt(np.log(1 + (s/m)**2))
ml = np.log(m) - sl**2 / 2
good = rng.lognormal(ml, sl, n)
print(good.mean(), good.std())
```

**Exercise 3. The time-step bug.** A daily return model uses `rng.normal(0, 0.20, (n, 252))` because "volatility is 20%". Simulate one year and print the SD of the yearly return. Then fix it.

**Answers.** With seed 12 the bug gives a yearly SD of 3.20 (320%). Variance adds over independent steps, so the daily SD must be 0.20/√252 ≈ 0.0126, which gives a yearly SD of about 0.20.

```python
rng = np.random.default_rng(12)
n, days = 10_000, 252
sd = 0.20 / days**0.5
r = rng.normal(0, sd, (n, days))
print(r.sum(1).std())
```

### Self-check

1. You double N and the answer does not move, but last year's actual result was far outside your P5 to P95. What is the likely problem?
2. State the flaw of averages in one sentence, and name the inequality behind it.
3. Two cost inputs have a common cause, but are simulated independently. Which statistic of the total is most affected: mean or P90?
4. Why does a normal model underestimate a 4-sigma loss for a fat-tailed risk?
5. An MCMC run has 50,000 draws with lag-1 autocorrelation 0.95. Roughly what is its effective sample size?

**Answers.** 1: Model bias: the inputs are too narrow or a risk is missing; more runs only reduce noise. 2: A model evaluated at average inputs does not give the average output when the model is nonlinear; Jensen's inequality. 3: The P90 (the tail); the mean of a sum is unaffected by correlation. 4: Its tails fall off far faster than real data's; a t with 3 degrees of freedom puts about 100× more probability beyond 4 SDs. 5: About 50,000 × 0.05/1.95 ≈ 1,300.

## 7. When to use it, and its cousins

This skill covers when Monte Carlo is the right tool and when a formula or a simple sensitivity table is better, then separates the related methods that share the name or the idea: the bootstrap, permutation tests, MCMC and Monte Carlo tree search.

| Key word | Plain meaning |
|---|---|
| Closed form | A formula you can write down and compute directly |
| Resampling | Drawing again from your own data, with replacement |
| Posterior | In Bayesian statistics, what you believe about an unknown after seeing the data |
| Markov chain | A sequence where each step depends only on the step before |
| Rollout | A quick simulated play-out of a game from some position |
| Surrogate model | A fast approximate model fitted to a slow one |

### When simulation is the right tool

Monte Carlo earns its cost when at least one of these holds:

- **No closed form.** The output depends on inputs through `max`, thresholds, queues, paths or rules, and there is no formula for its distribution.
- **Many interacting uncertain inputs.** Ten uncertain inputs with correlations and nonlinear links are hopeless by hand and easy to simulate.
- **You need the distribution, not just the mean.** P80 dates, value at risk, P(stock-out), the chance a trial succeeds.
- **Tail risk matters.** Decisions driven by the bad 5% of outcomes need the tail modelled, not a point estimate.
- **Path dependence.** Results depend on the order of events: inventory over weeks, a portfolio rebalanced monthly, a queue that builds up.

### When it is not

| Situation | Better tool | Why |
|---|---|---|
| A known formula exists (normal sums, binomial, Black–Scholes for a European call) | The formula | Exact, instant, no MCSE |
| A linear model with independent inputs | Mean and variance rules | E and Var of sums are exact |
| You only need "which input matters most" | Deterministic sensitivity (one-at-a-time, tornado) | Cheaper, easier to explain |
| Inputs are wild guesses with no range information | A few named scenarios | A distribution adds false precision |
| Each model run takes hours | A surrogate model, or a small designed experiment | 10,000 runs is not affordable |
| Real-time answers in milliseconds | Precomputed tables or analytic approximations | Simulation latency |

Two practical rules. First, if a formula exists, use simulation only to **check** it, or the reverse. Second, cost scales with N times the cost of one run: a model that takes 1 second per run needs almost 3 hours for 10,000 runs on one core. Vectorise, parallelise with independent streams, use variance reduction, or replace the slow model with a fitted surrogate.

### The bootstrap: resampling your data

The **bootstrap** (Bradley Efron, 1979) uses Monte Carlo to estimate the uncertainty of a statistic computed from **data**. Instead of drawing from a model, you resample the observed data **with replacement**, recompute the statistic each time, and use the spread of those values as its sampling distribution.

```python
rng = np.random.default_rng(10)
x = np.array([12, 15, 9, 30, 14,
              11, 45, 13, 10, 16])
idx = rng.integers(0, 10,
                   (10_000, 10))
med = np.median(x[idx], axis=1)
ci = np.percentile(med, [2.5, 97.5])
```

The sample median is 13.5 and the 95% percentile interval is 11 to 22.5. No formula for the standard error of a median was needed. Limits: the bootstrap cannot create information the sample lacks, works poorly for extremes (the maximum, a P99 from 50 points) and for very small samples, and must resample in blocks when data are time-ordered.

Monte Carlo simulation samples from a **model**; the bootstrap samples from the **data**. They are often combined: bootstrap the input data, then feed each resample into the simulation.

### Permutation tests

A **permutation test** asks: if group labels did not matter, how often would shuffled labels give a difference as large as the one observed?

```python
rng = np.random.default_rng(12)
a = np.array([5.1, 4.8, 6.0,
              5.5, 5.9])
b = np.array([4.2, 4.9, 4.4,
              5.0, 4.1])
obs = a.mean() - b.mean()  # 0.94
pool = np.concatenate([a, b])
cnt = 0
for _ in range(10_000):
    p = rng.permutation(pool)
    d = p[:5].mean() - p[5:].mean()
    cnt += d >= obs
```

With seed 12, 1.6% of shuffles reach 0.94, so the one-sided p-value is about 0.016. It assumes only that labels are exchangeable under the null, not normality. With small groups you can enumerate every permutation exactly; Monte Carlo just samples them when there are too many.

### MCMC: sampling what you can't draw directly

**Markov chain Monte Carlo** samples from a distribution known only up to a constant, most often a Bayesian posterior, p(θ given data) ∝ likelihood × prior. The **Metropolis–Hastings** algorithm (Metropolis and colleagues 1953, generalised by Hastings 1970) proposes a move, accepts it with a probability based on the density ratio, and otherwise stays put.

Example: 7 heads in 10 tosses with a flat prior. The posterior is Beta(8, 4), mean 2/3.

```python
def logp(p):
    if not 0 < p < 1:
        return -np.inf
    return 7*np.log(p) + 3*np.log(1-p)
rng = np.random.default_rng(13)
p, out = 0.5, []
for _ in range(20_000):
    q = p + rng.normal(0, 0.1)
    a = logp(q) - logp(p)
    if np.log(rng.random()) < a:
        p = q
    out.append(p)
s = np.array(out[2_000:])  # burn-in
```

The mean of the kept draws is 0.663, close to 0.667. But the draws are autocorrelated (lag-1 correlation 0.83), so the 18,000 kept draws are worth only about 2,000 independent ones. In practice use a library (PyMC, Stan, NumPyro) with modern samplers such as NUTS, run several chains, and check R-hat and effective sample size.

### Monte Carlo tree search

**Monte Carlo tree search** (MCTS) is a planning algorithm for games and sequential decisions. It grows a search tree of moves, and estimates how good a position is from the outcomes of simulated continuations ("rollouts" or a learned evaluation). A selection rule such as UCT balances trying promising moves against exploring uncertain ones. DeepMind's AlphaGo combined MCTS with neural networks and beat Lee Sedol 4–1 in March 2016. The shared idea is only "estimate value by sampling"; MCTS is about **choosing actions**, not estimating a distribution.

### How the family fits together

| Method | Samples from | Draws independent? | Answers |
|---|---|---|---|
| Monte Carlo simulation | A model of inputs | Yes | Distribution of an output |
| Bootstrap | The observed data | Yes | Uncertainty of a statistic |
| Permutation test | Shuffled labels | Yes | p-value under "no effect" |
| MCMC | A target known up to a constant | No (a chain) | Posterior summaries |
| MCTS | Simulated game continuations | Yes, guided by a tree | Which move to make |

### In plain words

Simulate when there is no formula, many uncertain inputs interact, or you need the whole spread and its tail; use the formula when one exists. The bootstrap resamples data, permutation tests shuffle labels, MCMC walks a chain to sample a posterior, and tree search samples game play-outs to pick moves.

### Exercises

**Exercise 1. Bootstrap a skewed mean.** Draw 40 customer spends from a lognormal (μ = 3, σ = 1) with seed 14. Compute a 95% bootstrap percentile interval for the mean with 10,000 resamples, and compare it with the t interval.

**Answers.** The sample mean is 40.7. The bootstrap interval is 23.9 to 63.6, while the t interval is 20.1 to 61.4. The bootstrap interval is shifted right because it follows the skew of the data; the t interval assumes the sample mean is symmetric, which is doubtful at n = 40 for such skewed spend.

```python
rng = np.random.default_rng(14)
x = rng.lognormal(3, 1, 40)
B = 10_000
idx = rng.integers(0, 40, (B, 40))
bm = x[idx].mean(1)
print(np.percentile(bm, [2.5, 97.5]))
```

**Exercise 2. Honest error bars for MCMC.** Take the 18,000 kept draws `s` from the Metropolis example. Estimate the MCSE of the posterior mean by **batch means**: split the chain into 20 consecutive batches, average each, and use the SD of the batch averages divided by √20. Compare with the naive s/√N and compute the effective sample size.

**Answers.** Batch means give an MCSE of 0.0027; the naive formula gives 0.0010, about 2.8× too small. The effective sample size, (SD of draws / MCSE)², is about 2,300 of 18,000. Batches must be long compared with the chain's correlation time for this to work.

```python
b = s.reshape(20, -1).mean(1)
se = b.std(ddof=1) / 20**0.5
naive = s.std(ddof=1) / len(s)**.5
ess = (s.std(ddof=1) / se)**2
```

### Self-check

1. You need the mean and variance of a sum of five independent normal costs. Simulate or not?
2. What does the bootstrap resample, and what does it estimate?
3. Why can't you use s/√N on raw MCMC draws?
4. What does a permutation test assume instead of normality?
5. A model takes 30 seconds per run and you need 10,000 runs by tomorrow. Name two options.

**Answers.** 1: Not needed: means and variances of independent sums add exactly, and the sum is normal. 2: It resamples the observed data with replacement and estimates the sampling distribution (standard error, interval) of a statistic. 3: Successive draws are autocorrelated, so the effective sample size is much smaller than N and s/√N is too small. 4: That group labels are exchangeable when there is no effect. 5: Parallelise across cores with independent streams; use variance reduction or LHS to need fewer runs; or fit a fast surrogate model.

## 8. Real-world uses

This skill covers where Monte Carlo does real work: pricing and risk in finance, project and demand planning, experiment design, reliability, weather, physics, film rendering, election forecasts and drug trials. Seeing the same pattern in each makes it easier to build your own.

| Key word | Plain meaning |
|---|---|
| Option | A contract giving the right, not the duty, to buy or sell at a set price later |
| Value at risk (VaR) | A loss level that is exceeded only on a small share of days, such as 1% |
| Expected shortfall | The average loss on those worst days |
| Power | The chance an experiment detects an effect that is really there |
| Ensemble | A set of forecasts run from slightly different starting points |
| Path tracing | Rendering an image by following random light paths |

### Finance: option pricing and value at risk

Under the Black–Scholes model, a stock follows **geometric Brownian motion** (GBM). Its price at time T is

```
S_T = S₀ exp((r − σ²/2)T + σ√T Z)
```

and an option's value is the discounted average payoff. For a European call this has a closed form, which makes it the perfect validation test:

```python
rng = np.random.default_rng(21)
S0, K, T = 100, 105, 1
r, sig = 0.03, 0.2
n = 1_000_000
z = rng.normal(size=n)
ST = S0 * np.exp((r - sig**2/2)*T
                 + sig*np.sqrt(T)*z)
disc = np.exp(-r*T)
pay = disc * np.maximum(ST - K, 0)
se = pay.std(ddof=1) / n**0.5
```

The simulation gives 7.118 with MCSE 0.013; Black–Scholes gives 7.128. The gap is under one standard error. Once the code matches the formula, you can trust it for what has no formula: Asian options (payoff on the average price), barriers, early exercise (the Longstaff–Schwartz method), or portfolios of many correlated assets.

**Value at risk** (VaR) is a loss percentile: the 1-day 99% VaR is the loss exceeded on 1% of days. **Expected shortfall** (ES) is the average loss beyond it. For a 1 million position with 1% daily volatility, a normal model gives a 99% VaR of 23,260. Simulating Student-t returns (4 degrees of freedom, same volatility) gives a VaR of about 26,800 and an ES of 37,700 (seed 23). Banking rules moved from VaR towards expected shortfall at 97.5% because VaR says nothing about how bad the tail is (Basel market risk rules; approximate summary).

### Planning: projects, demand and inventory

**Project schedule and cost risk.** Simulate task durations and risk events through the dependency network, as in skill 2, and report P50 and P80 dates and costs. Many organisations set budgets and contingency at a stated percentile: the gap between P50 and P80 is the risk reserve. The value lies as much in the sensitivity ranking ("build drives the date") as in the dates.

**Demand and inventory.** Simulate weekly demand, supplier lead times and disruptions, run the reorder policy through time, and measure stock-outs, fill rate and holding cost. Because stock carries over, outcomes are path-dependent, so a closed form rarely exists. Common random numbers make policy comparisons (reorder at 200 or 250?) far sharper.

**Reliability and engineering.** Draw component failures and repair times, and see how often the system fails. For simple series or parallel systems this matches a formula; for real systems with shared causes, maintenance schedules and degraded modes, simulation is the practical tool. Structural engineers sample loads and material strengths to estimate failure probabilities, which are rare, so importance sampling is standard.

### Experiments: A/B tests and drug trials

**A/B test power.** Before running a test, simulate it: generate data under the effect you hope to detect, run the exact analysis you will use, and count how often it detects the effect. With a 10% baseline conversion rate, a lift to 11% and 10,000 users per arm:

```python
rng = np.random.default_rng(22)
sims, n = 2_000, 10_000
a = rng.binomial(n, .10, sims) / n
b = rng.binomial(n, .11, sims) / n
p = (a + b) / 2
se = np.sqrt(2 * p * (1-p) / n)
z = (b - a) / se
print((z > 1.96).mean())
```

Power is 0.65 (MCSE 0.011), against 0.64 from the normal formula. The point of simulating is that it handles what formulas don't: sequential peeking, ratio metrics, skewed revenue, clustered users. Simulating the null (no lift) checks that the false positive rate really is 5% under your peeking rule.

**Clinical trial design.** Adaptive trials (interim looks, early stopping, dropping arms, sample size re-estimation) rarely have closed-form operating characteristics. Sponsors simulate thousands of virtual trials under many scenarios to show the type I error rate and power. The FDA's 2019 guidance on adaptive designs discusses simulations for exactly this, especially for Bayesian and complex designs.

### Science and forecasting

**Weather ensembles.** Weather is chaotic: tiny errors in the starting state grow. ECMWF's medium-range ensemble runs 51 forecasts out to 15 days: one unperturbed control and 50 members with perturbed starting states and model physics. The spread of members gives the forecast uncertainty, and "70% chance of rain" is roughly the share of members with rain. It is Monte Carlo with an expensive model and a small N.

**Particle physics.** **Geant4**, a toolkit developed by a worldwide collaboration hosted at CERN, simulates particles passing through matter: each particle's path, interactions and secondary particles are sampled from physics cross-sections. Experiments compare simulated detector responses with real data, and the same toolkit is used in medical physics (radiotherapy planning, imaging) and space engineering. Neutron transport, the first Monte Carlo problem at Los Alamos, is the same idea.

**Computer graphics.** A pixel's colour is an integral over all light paths reaching the camera. **Path tracing** estimates it by sampling random light paths, which is why an early, low-sample render looks grainy: that grain is Monte Carlo noise, shrinking like 1/√(samples per pixel). Pixar's *Finding Dory* (2016) was its first feature rendered with RenderMan's path-tracing architecture (RIS). Studios rely heavily on importance sampling of lights and materials, and on denoisers, to keep sample counts affordable.

**Election and sports forecasts.** Forecasters combine poll averages with the uncertainty of polling errors, including errors **shared** across states, then simulate the election many times; FiveThirtyEight's 2020 presidential model, for example, simulated it 40,000 times and reported how often each candidate won. "Wins in 71% of simulations" is a probability, not a predicted vote share. The correlated error is crucial: if state errors are independent, the national outcome looks far more certain than it is. Sports models simulate the remaining fixtures of a season to get title and relegation odds in the same way.

### In plain words

The same recipe runs through finance, planning, experiments, weather, physics, film and elections: describe what is uncertain, simulate many possible worlds, and read off averages, percentiles and probabilities. Each field adds a favourite trick, such as checking against a known formula, linking errors that move together, or aiming samples at the rare cases.

### Exercises

**Exercise 1. Size an A/B test by simulation.** Baseline conversion is 10% and you want to detect a lift to 11% with 80% power at a one-sided 2.5% level (z > 1.96). Simulate power for 10,000, 14,000 and 15,000 users per arm and find the smallest that reaches 80%.

**Answers.** With seed 15 and 4,000 simulated tests each, power is about 0.63, 0.79 and 0.81, so roughly 15,000 per arm. The normal-approximation formula gives about 14,750. With 4,000 simulations each power estimate has MCSE about 0.006, so values near 0.80 need more simulations to separate.

```python
rng = np.random.default_rng(15)
def power(n, sims=4_000):
    a = rng.binomial(n, .10, sims) / n
    b = rng.binomial(n, .11, sims) / n
    p = (a + b) / 2
    se = np.sqrt(2*p*(1 - p) / n)
    z = (b - a) / se
    return (z > 1.96).mean()
for n in (10_000, 14_000, 15_000):
    print(n, power(n))
```

**Exercise 2. Validate a reliability model.** A plant fails in a year if its main pump fails (probability 2%) or if both backup pumps fail (10% each, independent). Simulate one million years and compare with the exact answer.

**Answers.** Exact: 1 − 0.98 × (1 − 0.01) = 0.0298. With seed 16 the simulation gives 0.0296 (MCSE about 0.0002). Once it matches, you can add what the formula can't handle, such as a shared cause that makes both backups fail together.

```python
rng = np.random.default_rng(16)
n = 1_000_000
a = rng.random(n) < 0.02
b = rng.random(n) < 0.10
c = rng.random(n) < 0.10
fail = a | (b & c)
print(fail.mean())
```

### Self-check

1. Why price a European call by simulation when Black–Scholes exists?
2. What does a 1-day 99% VaR of 26,800 mean, and what does it leave out?
3. Why simulate an A/B test's null hypothesis as well as the effect?
4. Why does an early path-traced render look grainy?
5. In an election model, what happens to the win probability if polling errors across states are treated as independent?

**Answers.** 1: As a validation test: if the code reproduces the formula, it can be trusted for exotic options and portfolios that have no formula. 2: Losses exceed 26,800 on about 1% of days; it says nothing about how large those losses are, which expected shortfall measures. 3: To check that the false positive rate under your actual analysis (peeking, metric choice) is really the nominal 5%. 4: Each pixel is a Monte Carlo estimate from few light paths, and the grain is its sampling noise. 5: Errors cancel across states, so the leader's win probability is overstated; shared errors keep the upset scenarios alive.

## 9. Capstone: a full case study

This skill ties the track together in one realistic decision, from question to recommendation, and ends with a checklist of the mistakes to avoid. Work through it as a review: each step points back to the skill where it was taught.

| Key word | Plain meaning |
|---|---|
| Fixed-price bid | A promise to deliver for a set price, so overruns come out of your profit |
| Penalty | A charge for every day the project runs late |
| Decision rule | A limit agreed in advance, such as "at most a 15% chance of a loss" |
| Back-test | Checking a model's predictions against what actually happened before |
| Newsvendor | The classic problem of how much stock to order before demand is known |

### The question

A consultancy is asked to deliver a project for a **fixed price of 300,000**. Should it accept? The decision metric is expected profit together with the **probability of a loss**, because the partners have said they will not take a bid with more than a 15% chance of losing money (skill 2, step 1).

The model:

```
cost = 800 × days + materials
       + penalty
penalty = 1,000 × (days over 260)
```

Inputs, from past projects and the delivery lead:

| Input | Distribution | Why |
|---|---|---|
| Labour days | Triangular, min 180, mode 222, max 320 | Expert range, skewed to overruns |
| Materials | Lognormal, median 60,000, σ = 0.3 | Positive, multiplicative uncertainty |
| Dependence | Correlation 0.5 between them | Scope creep raises both |
| Day rate | Fixed at 800 | Contracted |

The "plan" uses the most likely values: 800 × 222 + 60,000 = 237,600, a profit of **62,400**. That is the number the sales team wants to quote.

### The simulation

```python
from scipy.stats import norm, triang
rng = np.random.default_rng(99)
n = 200_000
C = [[1, .5], [.5, 1]]
z = rng.multivariate_normal(
    [0, 0], C, n)
u = norm.cdf(z)
days = triang.ppf(u[:, 0],
                  0.3, 180, 140)
mat = 60_000 * np.exp(0.3*z[:, 1])
late = np.maximum(days - 260, 0)
cost = 800*days + mat + 1_000*late
profit = 300_000 - cost
```

The Gaussian copula links the two inputs (skill 2). The triangular c = (222 − 180)/140 = 0.3. The materials draw uses the normal z directly, which is a lognormal with median 60,000. A seed is fixed and recorded (skill 3).

### The results

| Output | Value |
|---|---|
| Expected profit | 39,400 (MCSE about 100) |
| P50 cost | 252,000 |
| P80 cost | 295,000 |
| P(loss) | 0.182 (MCSE 0.0009) |
| P5 profit | about −52,000 |
| Plan profit (most likely inputs) | 62,400 |

Reading it:

- **The flaw of averages, in full** (skill 6): the plan says 62,400; the expected profit is 39,400. Skewed days, the convex late penalty and correlation all push cost up.
- **The decision**: P(loss) is 18%, above the 15% limit. As quoted, the bid fails the partners' rule.
- **Precision is ample** (skill 4): with MCSE 0.0009 the 18% is not close to 15% in noise terms; 200,000 runs is more than enough.
- **Dependence matters** (skill 6): with the correlation set to 0, P(loss) falls to 15.6%, close to the limit. Ignoring scope creep's common effect would have made a failing bid look borderline.

What would change the answer? A sensitivity run is the next step: labour days have the strongest link to profit (rank correlation −0.91, against −0.78 for materials, which share the scope-creep driver), so the levers are a tighter scope (cutting the upper tail of days), a higher price, or a cap on the late penalty. Each is one line to change and rerun with **common random numbers** (skill 3), so the comparison is sharp.

### Validating before presenting

Before this goes to the partners:

- Set every input to its mode: cost must be 237,600 (it is).
- Check the marginals: days have mean (180 + 222 + 320)/3 ≈ 240.7 and the copula did not change it; materials have median 60,000.
- Check the guard: what share of runs pays a penalty? It is 26%, which is plausible; 0% or 100% would point to a bug.
- Back-test: did past fixed-price projects lose money about as often as the model says?
- Rerun with another seed: P(loss) should agree within about 0.002.

### The checklist

| Check | Skill | The mistake it prevents |
|---|---|---|
| Is the question tied to a decision and a metric? | 2 | Simulating everything, deciding nothing |
| Is every input range honest (P10 to P90, not min to max)? | 2, 6 | Too-narrow inputs, false confidence |
| Are common causes modelled as correlation or shared shocks? | 2, 6 | Thin tails on totals |
| Are shapes right for the support and tails? | 2, 6 | Negative durations, clipped values, normal losses |
| Is the model applied run by run, never to averaged inputs? | 6 | The flaw of averages |
| Is the seed fixed in advance, and are parallel streams spawned? | 3 | Irreproducible or duplicated runs |
| Is N planned from a pilot for the precision the decision needs? | 4 | Too few runs, or wasted compute |
| Is every result reported with its MCSE and sensible rounding? | 1, 4 | False precision |
| Are rare-event and tail estimates backed by enough hits? | 4, 5 | P99.9 from five points |
| Was a known-answer test and a back-test run? | 2, 6, 8 | Bugs and model bias |
| Is the method right (formula, bootstrap, MCMC)? | 7 | Simulating what has a formula; naive MCMC errors |
| Is the P50 labelled as a median, not as the plan? | 6 | Committing to a coin flip |

### In plain words

A good simulation starts from a decision, models the real structure and links between inputs, reports estimates with their errors, is checked against known answers and history, and ends with a clear recommendation that shows the risk, not just one number.

### Capstone exercise

**Exercise. Order quantity for a seasonal product.** A retailer sells a winter jacket for 25; each costs 10, and unsold jackets are cleared at 4. Demand is lognormal with median 1,000 (σ = 0.4), and there is a 10% chance a competitor launches and cuts demand by 30%. Simulate 100,000 seasons with seed 31 and evaluate order quantities 800 to 1,600 in steps of 100, using **the same demand draws for every quantity**. Report the best quantity, its expected profit, and whether the difference between 1,100 and 1,200 is real. Then compare with ordering "average demand".

**Answers.** Expected profit peaks at q = 1,200 (about 12,370), with 1,300 close behind (12,330). Because all quantities share the same demand draws (common random numbers), the gain from 1,100 to 1,200 is 108 with MCSE about 3: clearly real, even though each profit alone has an MCSE of about 15. Mean demand is about 1,050, so "order the average" leaves money on the table. The theory agrees: the best q is the demand quantile at the critical ratio (25 − 10)/(25 − 4) ≈ 0.714, which is about 1,220. A bigger order also has a worse bad case (P5 profit falls from 4,205 at q = 1,000 to 3,005 at 1,200), a trade-off to show the decision maker.

```python
rng = np.random.default_rng(31)
n = 100_000
z = rng.normal(size=n)
d = 1000 * np.exp(0.4 * z)
hit = rng.random(n) < 0.10
d = np.where(hit, 0.7 * d, d)
def profit(q):
    sold = np.minimum(q, d)
    left = q - sold
    return 25*sold + 4*left - 10*q
for q in range(800, 1700, 100):
    print(q, profit(q).mean())
g = profit(1200) - profit(1100)
print(g.mean(), g.std() / n**0.5)
```

### Self-check

1. In the case study, why is the expected profit (39,400) so far below the plan (62,400)?
2. P(loss) is 0.182 with MCSE 0.0009. Do you need more runs to compare it with the 15% rule?
3. Setting the correlation to 0 gave P(loss) = 15.6%. Which result should be presented, and why?
4. Name two validation checks you would run before presenting.
5. The partners ask for "the number". What do you give them?

**Answers.** 1: Skewed labour days, a convex late penalty and positive correlation all raise expected cost; the plan uses most likely values, so it suffers the flaw of averages. 2: No: the gap of 3.2 points is over 30 MCSEs. 3: The correlated one, because scope creep really drives both inputs; the independent run is a sensitivity case that shows how much the dependence matters. 4: Any two of: modal inputs give 237,600; marginals have the intended mean and median; the penalty share is plausible; a second seed agrees within MCSE; a back-test against past fixed-price projects. 5: Not a single number: expected profit 39,000, an 18% chance of loss (above the 15% limit), the P80 cost of 295,000, and the levers (price, scope, penalty cap) that would bring the risk under the limit.

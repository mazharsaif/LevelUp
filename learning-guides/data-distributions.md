# Probability Distributions in Data Science

> Reading time: 60 min | Level: DS with 5 yrs | Takeaway: a distribution is an assumption about *how your data was generated*; pick it by asking "what process made this number?", not by what the histogram vaguely resembles.

**Budget choice:** 60 min. The topic is broad, but ~10 distributions cover almost all practical work, and the real skill (matching process to distribution, spotting violations) fits in one sitting.

---

## 1. The problem this exists to solve (story)

You're asked to forecast daily support tickets. You fit a linear regression, and it predicts 4.7 tickets for a quiet Sunday and, on a bad day, -0.3. Your prediction intervals go negative. Your colleague says "just clip at zero." Then you're asked for the probability of more than 40 tickets in a day (the staffing threshold), and your normal-based interval says 0.1%. Reality hits that threshold twice a month.

You tried the obvious thing: treat everything as a bell curve. It failed because the data is a **count** (non-negative integers) with a **fat right tail** and **variance that grows with the mean**. A normal distribution assumes none of that.

A **probability distribution** is the formal way to say what values are possible and how likely each is. Choosing the right one fixes intervals, thresholds, simulation, anomaly detection, and which loss function your model should use.

---

## 2. The core idea in plain words

A distribution is a **model of the data-generating process**. Each family answers a "how was this number produced?" question:

```
What did you measure?
 |
 |-- A yes/no outcome, once ................ Bernoulli
 |     \- count of yeses in n tries ........ Binomial
 |-- A count of events in a time/space window  Poisson (variance = mean)
 |     \- ...but overdispersed ............... Negative Binomial
 |-- A continuous value that is a SUM of many small effects ... Normal
 |-- A continuous value that is a PRODUCT of many effects ..... Log-normal
 |-- Time until the next event ............. Exponential / Weibull
 |-- Extreme maximum of many things ........ Gumbel / GEV / Pareto tail
 \-- A proportion (0..1) / uncertainty on a rate ... Beta
```

Two ideas to hold:

1. **Sum vs product.** Many small *additive* effects give a bell curve (Central Limit Theorem). Many *multiplicative* effects give a right-skewed log-normal. Heights are roughly additive; incomes, prices, and file sizes are multiplicative.
2. **The distribution is also a constraint.** Normal allows negatives. Poisson forces variance = mean. Choosing it means *accepting* those consequences.

---

## 3. The 20% that gets used 80% of the time

### 3.1 Normal (Gaussian)

- **Concept**: symmetric bell curve defined by mean μ and standard deviation σ.
- **Why it matters**: the CLT says *averages* of many independent things become approximately normal, even if the individual things aren't. That's why t-tests, confidence intervals on means, and linear-regression errors lean on it. [consensus]
- **Rules of thumb**: ~68% within 1σ, ~95% within 2σ, ~99.7% within 3σ. Use these only if it *is* roughly normal.
- **Key subtlety**: the data need not be normal, but the **sampling distribution of the mean** often is, given enough samples. "Enough" depends on skew. [depends]

```python
import numpy as np
from scipy import stats

rng = np.random.default_rng(0)
x = rng.normal(loc=170, scale=8, size=10_000)
print(stats.norm.interval(0.95, loc=x.mean(), scale=x.std()))  # ~ (154, 186)
```

### 3.2 Log-normal

- **Concept**: a variable whose *logarithm* is normal. Always positive, right-skewed, mean > median.
- **Why it matters**: the default for money, durations, latencies, sizes, anything driven by multiplicative growth.
- **Practical trick**: if the data look log-normal, **model log(x) with normal-based methods**, then transform back. Remember that back-transforming the mean of logs gives the *median/geometric mean*, not the arithmetic mean.

```python
x = rng.lognormal(mean=3, sigma=1, size=10_000)
print(x.mean(), np.median(x))          # mean >> median (~33 vs ~20)
print(np.exp(np.log(x).mean()))        # geometric mean ~ the median
```

### 3.3 Bernoulli and Binomial

- **Concept**: Bernoulli is one yes/no trial with probability p. Binomial is the number of yeses in n independent trials.
- **Why it matters**: conversion rates, click-through, defect rates, A/B tests, logistic regression's whole premise. If you're predicting a 0/1 label, you've assumed Bernoulli.
- **Watch for**: independence. Ten clicks from one user are not ten independent trials.

```python
# 120 conversions out of 2,000 visitors: what rates are plausible?
n, k = 2000, 120
print(stats.binomtest(k, n).proportion_ci(confidence_level=0.95))  # ~ (0.050, 0.071)
```

### 3.4 Poisson

- **Concept**: number of events in a fixed window when events occur independently at a constant average rate λ. Mean = variance = λ.
- **Why it matters**: tickets per day, requests per second, defects per meter, goals per match. Poisson regression is the standard count model.
- **The catch**: real counts are almost always **overdispersed** (variance > mean), because rates aren't constant and events cluster. That leads to the next one.

```python
counts = rng.poisson(lam=12, size=5000)
print(counts.mean(), counts.var())   # both ~12, the Poisson signature
```

### 3.5 Negative Binomial

- **Concept**: a count distribution with a separate dispersion parameter, so variance can exceed the mean. Intuitively, a Poisson whose rate itself varies from day to day (a Poisson-Gamma mixture).
- **Why it matters**: the safer default for real-world counts. If a Poisson model gives you suspiciously narrow intervals or a bad fit on busy days, this is the fix.
- **Diagnostic**: compute variance / mean of the counts. Much above ~1.5 means Poisson is the wrong tool. [rule of thumb]

```python
# overdispersed counts: gamma-distributed rate feeding a Poisson
rate = rng.gamma(shape=2, scale=6, size=5000)       # mean rate 12, varies a lot
counts = rng.poisson(rate)
print(counts.mean(), counts.var())                  # ~12 vs ~84: way overdispersed
```

### 3.6 Exponential and Weibull

- **Concept**: time until an event. Exponential assumes a constant hazard (memoryless: how long you've waited tells you nothing). Weibull adds a shape parameter so the hazard can rise (wear-out) or fall (infant mortality).
- **Why it matters**: time-to-failure, time-to-churn, inter-arrival times, session lengths. It is the link to survival analysis.
- **Link**: if events arrive as a Poisson process, the gaps between them are exponential.

### 3.7 Beta

- **Concept**: a distribution over values between 0 and 1, shaped by two parameters (think "successes+1" and "failures+1").
- **Why it matters**: it represents *uncertainty about a rate*. It is the conjugate prior for Bernoulli/Binomial, which is why Bayesian A/B testing and Thompson-sampling bandits use it. Great for ranking items with different amounts of data (a 5/5 item vs a 480/500 item).

```python
# posterior for a conversion rate after 120/2000, starting from a flat Beta(1,1)
post = stats.beta(1 + 120, 1 + 1880)
print(post.mean(), post.interval(0.95))      # ~0.060, (~0.050, ~0.071)
```

### 3.8 Uniform

- **Concept**: every value in a range equally likely.
- **Why it matters**: the raw material of random number generation, and a weak "I know nothing, only the bounds" prior. Also what p-values look like when the null is true.

### 3.9 Heavy-tailed families (Pareto / power law, Student-t, Cauchy)

- **Concept**: distributions where extreme values are far more common than a normal predicts. In the extreme (Pareto with small exponent), the mean or variance may be infinite or unstable.
- **Why it matters**: wealth, city sizes, web traffic, insurance claims, financial returns, file sizes. The **80/20 rule itself** is a Pareto phenomenon.
- **What changes**: sample means converge slowly or erratically, one data point can dominate the sum, standard deviation is not a useful summary, and "typical" stops meaning much.
- **Practical move**: use medians, quantiles, and robust methods; model the tail separately (extreme value theory). Student-t is the pragmatic option when you want "normal-ish with fatter tails", for example as a robust regression error.

```python
pareto = (rng.pareto(a=1.2, size=100_000) + 1)
for n in (1_000, 10_000, 100_000):
    print(n, pareto[:n].mean())    # the mean keeps drifting; it hasn't converged
```

### 3.10 Multivariate normal and "what about correlation?"

- **Concept**: the normal extended to many variables, with a covariance matrix describing how they move together.
- **Why it matters**: Gaussian processes, Kalman filters, LDA/QDA, PCA-as-Gaussian-model, simulating correlated features. Correlation in a joint distribution is *not* captured by the marginals alone (see copulas in section 7).

---

## 4. When to use it, and when NOT to

Interpreted for the question "when should I *commit* to a named distribution at all?":

**Commit to a parametric distribution when:**
- You need **probabilities of rare/extreme events** (thresholds, SLAs, risk), and empirical frequency is too sparse.
- You're building a **generative or Bayesian model** and need a likelihood.
- Data are **scarce** and structural knowledge (counts, rates, durations) can substitute for volume.
- You need to **simulate** realistic data (Monte Carlo, stress tests, synthetic benchmarks).
- The **process** strongly implies a family (arrivals -> Poisson, success/fail -> Binomial).

**Do NOT commit (or at least hedge) when:**
- You have **lots of data** and the question is about the *middle* of it. The empirical distribution or a KDE is honest and cheap.
- The shape is **multimodal** (two customer segments). A single family will mislead; model the mixture or segment first.
- You're forecasting **tails** from data that never contained a tail event. The fit will be dominated by the center, so the tail estimate is mostly an assumption in disguise.
- The "distribution" is just **a histogram you eyeballed**. Looking bell-shaped is weak evidence.

**Decision table: parametric vs alternatives**

| Option | Best when | Breaks when | Cost / complexity |
|---|---|---|---|
| Named distribution (MLE fit) | Process is understood; need tails or likelihood; little data | Assumption is wrong; tails extrapolated from the center | Low; fast, interpretable |
| Empirical distribution / bootstrap | Plenty of data; no clean process story; want assumption-light intervals | Rare events, small n, extreme quantiles | Low-medium; compute-heavy for big models |
| KDE / nonparametric density | Exploring shape; smooth density estimate in 1-2 dims | High dimensions; bandwidth choice; boundaries | Medium; tuning needed |
| Mixture model | Visible subpopulations | Components aren't identifiable; overfitting | Medium-high |
| Quantile / distribution-free methods (conformal, quantile regression) | You only need valid intervals, not a story | You need a full generative model | Medium |
| Do nothing (assume normal) | Averages of large samples; quick-and-dirty | Skewed, bounded, count, or heavy-tailed data | Lowest; most dangerous when silently wrong |

---

## 5. Trade-offs and complexity

- **Interpretability vs fit.** A named family gives a story and 2-3 parameters. Mixtures and nonparametrics fit better but explain less. A rule of thumb: prefer the simplest family that survives a QQ-plot and a posterior predictive check. [depends]
- **Extrapolation risk.** Parametric fits trade **bias for variance**: stable estimates, but a wrong family means confidently wrong tails. The 99.9th percentile of a fit is mostly an assumption; the data constrains the median, not the extreme.
- **Estimation cost.** Closed-form for normal, binomial, Poisson (the MLEs are simple). Negative binomial, Weibull with censoring, and mixtures need numerical optimization or EM/MCMC. Still seconds for typical data; the real cost is *diagnosing failure*, not computing.
- **Data requirements.** Rough guide [rule of thumb]: tens of points to estimate a mean/variance, hundreds to distinguish between two similar families (log-normal vs gamma is notoriously hard), thousands-plus to say anything about a tail.
- **Maintenance.** Distributions drift. A fitted λ from last quarter is stale after a product launch. Treat parameters as things to monitor, not constants.
- **What it makes harder later.** A normal-error assumption baked into a model (squared loss) makes outliers expensive and silently shapes every interval. Switching the likelihood later (to Poisson, t, etc.) means revisiting loss, metrics, and calibration.

---

## 6. Pitfalls and failure modes

1. **Testing normality as a gatekeeper.** *Symptom:* Shapiro-Wilk rejects with n=50,000 even though the data are fine, or passes at n=20 when it can't detect anything. *Fix:* for large n it's too powerful, for small n too weak. Use a QQ-plot and think about the process; for regression, check *residuals*, not the raw target. [consensus]
2. **Normal assumption on bounded/count data.** *Symptom:* negative predictions, intervals past 0 or 1. *Fix:* use the family matching the support (Poisson/NB for counts, Beta/logit for proportions, log-normal/gamma for positive continuous).
3. **Poisson on overdispersed counts.** *Symptom:* tiny standard errors, everything "significant", bad coverage. *Fix:* check variance/mean; use negative binomial or quasi-Poisson.
4. **Averaging heavy-tailed data.** *Symptom:* the mean jumps around between samples; one outlier moves KPIs. *Fix:* medians, trimmed means, quantiles, log transforms; investigate the tail directly.
5. **Mixing populations.** *Symptom:* a "weird" bimodal or fat-tailed shape. *Fix:* segment (new vs returning customers, weekdays vs weekends) before fitting. Often what looks like a heavy tail is two groups.
6. **Confusing the data distribution with the sampling distribution.** *Symptom:* "my data aren't normal so I can't use a t-test / CI." *Fix:* with moderate n and mild skew, the mean is approximately normal; with heavy skew, use a bootstrap.
7. **Assuming independence.** *Symptom:* binomial/Poisson intervals are too narrow. Repeat users, autocorrelated time series, and clustered data all break it. *Fix:* model the dependence (random effects, time-series structure) or cluster the bootstrap.
8. **Trusting a log transform blindly.** *Symptom:* back-transformed predictions are biased low for the mean. *Fix:* apply a smearing correction (multiply by exp(σ²/2) if log-normal) or predict the median deliberately. [depends]

---

## 7. Deliberately left out

- **Gamma, Chi-squared, F, Student-t derivations** (the sampling distributions behind tests): learn when you want to understand why a test works, not just run it.
- **Copulas**: learn when you need dependence modelling beyond Gaussian correlation, e.g. joint risk where variables crash together.
- **Extreme Value Theory (GEV, peaks-over-threshold)**: learn when your actual decisions live in the far tail (reliability, insurance, risk).
- **Dirichlet / multinomial / categorical**: learn when modelling topic proportions, multi-class outcomes, or Bayesian categorical data.
- **Zero-inflated and hurdle models**: learn when the count of zeros is far beyond what Poisson/NB predicts (e.g. most customers buy nothing).
- **Exponential family and GLMs as a framework**: learn when you want one unified view of linear/logistic/Poisson regression. It's the best next step.
- **Bayesian conjugacy beyond Beta-Binomial**: learn when you do sequential/online updating.
- **Goodness-of-fit theory (KS, Anderson-Darling)**: learn when you must formally compare fits; QQ plots will carry you far.

---

## 8. Self-check (answer out loud, no peeking)

1. A feature is monthly revenue per customer: right-skewed, strictly positive, a few huge accounts. What distribution would you start with, and what do you do before fitting a linear model on it?
2. Daily tickets have mean 12 and variance 90. Which model do you pick and why? What's the practical consequence of picking the wrong one?
3. Your dataset is normal in the middle but has extreme outliers regularly. Walk through how you'd decide between "remove outliers", "use Student-t errors", and "model them as a separate regime".
4. Your colleague says "the data isn't normal, so we can't use a t-test." What's right and wrong about that?
5. You have two items: 5 reviews, all positive, and 480 positive out of 500. How do you rank them, and with which distribution?
6. Mean vs median of a Pareto-like variable: which is more informative and why? What goes wrong with the standard deviation?
7. When is the empirical distribution better than any fitted family?
8. Someone estimates the 99.99th percentile of latency from a normal fit on 10k samples. What are the risks?

<details>
<summary>Answer key</summary>

1. Log-normal (or gamma). Log-transform and model log-revenue; mind back-transformation bias, and consider segmenting big accounts.
2. Negative binomial (variance 90 >> mean 12, overdispersed). Poisson would give far too-narrow intervals and overstated significance.
3. Ask *why* the outliers exist. Errors: fix/remove. Real but rare: robust (t) errors or quantile methods. A distinct population (e.g. enterprise): model separately or segment. Never delete just to make it look normal.
4. Wrong: the t-test cares about the sampling distribution of the mean, which is approximately normal at moderate n. Right: for small n, strong skew, or heavy tails, the approximation can fail, so use a bootstrap or permutation test.
5. Beta posteriors: Beta(6,1) vs Beta(481,21). Rank by a lower credible bound or sample/expected value; the 5/5 item has a much wider posterior, so the 480/500 item usually ranks higher conservatively.
6. Median/quantiles. With a small tail exponent the mean and variance can be infinite or unstable, so the SD doesn't describe spread meaningfully.
7. Lots of data, central questions, no clean process story, or when any parametric family fits poorly.
8. A normal fit underestimates tails if the data are skewed or heavy-tailed, and 10k samples contain almost no information about the 1-in-10,000 quantile. The answer is mostly the assumption. Use EVT or a heavy-tailed family, and quote the uncertainty.

</details>

---

## 9. One-page cheat sheet

**What it is:** a distribution models how values are generated. Choosing one = assuming a process.

| Data looks like | Start with | Check |
|---|---|---|
| Yes/no | Bernoulli / Binomial | independence |
| Count of events | Poisson -> Negative Binomial | variance vs mean |
| Positive, skewed, multiplicative | Log-normal / Gamma | QQ-plot of log(x) |
| Symmetric, additive effects | Normal | QQ-plot, residuals |
| Time to event | Exponential -> Weibull | hazard shape, censoring |
| Proportion / rate uncertainty | Beta | n behind each rate |
| Extreme values common | Student-t / Pareto / EVT | does the mean converge? |
| Visible clusters | Mixture, or segment first | subgroup structure |

**Use a named distribution when** you need tails, likelihoods, simulation, or have little data and a clear process.
**Avoid when** data are plentiful and the middle is what matters, it's multimodal, or you'd extrapolate a tail you've never seen.

**Key terms:** support (allowed values), parameter vs statistic, likelihood, overdispersion, heavy tail, conjugate prior.

**Gotchas:**
1. Normal is a good model of *averages*, not of most raw data.
2. Poisson means variance = mean; check it.
3. Heavy tails break means and standard deviations.
4. A bimodal shape usually means two populations.
5. Tail estimates from a fit are assumptions; the data barely constrain them.

**Rule of thumb:** match the **support**, then the **process**, then check the **residuals/QQ**, and only then trust the tails.

---

## 10. Further reading (ranked)

- **SciPy `scipy.stats` documentation**: [skim] for each distribution's parameterization; a reliable reference that avoids the "scale vs rate" mixups.
- **Gelman et al., *Bayesian Data Analysis*** (early chapters on single-parameter models): [deep dive] for the clearest account of Beta-Binomial, Poisson-Gamma, and how likelihood choice shapes inference.
- **Gelman, Hill, Vehtari, *Regression and Other Stories***: [skim] for practical advice on choosing error models, and for why normality of residuals is the least important regression assumption.
- **Taleb, *Statistical Consequences of Fat Tails***: [skim] for the intuition on how heavy tails break the mean; contested in tone, so treat the strongest claims as [depends].

*Honesty note:* all code snippets use standard `numpy`/`scipy` APIs (`stats.binomtest` and `proportion_ci` need SciPy >= 1.7) [fast-moving]. Numeric outputs in comments are approximate and will vary with the seed.

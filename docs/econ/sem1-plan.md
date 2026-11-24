# MSc Economics prep: Sem 1 plan (Econometrics 2 + Financial Management)

Source: `~/Downloads/Sem 1 - Subjects.docx` (Mendel University Brno, WS 2026/27). Microeconomics 2 comes later (same method).
Learner: starts from school class 10, no economics, very weak maths. Semester starts in about 3 months. Maths track already exists (`math-core`: found, alg, calc, stats, mc).

## What the two subjects need

| Subject | Needs before day 1 | Exam shape |
|---|---|---|
| Econometrics 2 | regression (OLS, t/F tests), matrices, logs, probability and tests, Gretl | closed book; mid-term 10/20, final 40/80; 9 labs |
| Financial Management | percentages, powers, time value of money, accounting statements, basic economics | 2 projects 30/50, written exam 30/50 |

## Tracks (a new tree course "Economics & Finance", id `econ-core`, content in `content/econ/<branch>/`)

Reading order for the learner: Maths (found, alg, stats) first, then Economics Essentials in parallel with Finance Foundations, then Regression, then the rest.

| # | Branch (id) | Skills | Covers | Maths it leans on |
|---|---|---|---|---|
| 1 | Economics Essentials (`eco`) | 11 | scarcity, supply and demand, elasticity, costs, market types, money and inflation, GDP, banks and central banks, exchange rates, reading economic data | found |
| 2 | Finance Foundations (`fin1`) | 10 | what firms want, balance sheet, income statement and cash flow, ratios, time value of money, annuities and loans, bonds, stocks, company valuation | found, alg (powers, logs) |
| 3 | Corporate Finance (`fin2`) | 14 | risk and return, portfolios, CAPM, WACC, NPV/IRR, project risk, working capital, cash/receivables/stock, dividends, exchange rates, FX risk, international projects, start-ups and bankruptcy | stats |
| 4 | Regression Foundations (`ecm1`) | 11 | data types, OLS, multiple regression, R², t and F tests, dummies, logs and functional forms, matrix OLS and Gauss-Markov, Gretl first steps | stats 11, alg (matrices) |
| 5 | Classical Model and Violations (`ecm2`) | 7 | model choice and over/under-fitting, multicollinearity, heteroskedasticity (detect, fix), serial correlation (detect, fix) | ecm1 |
| 6 | Time Series (`ts`) | 14 | trend, season, stationarity, ACF/PACF, unit roots, spurious regression, cointegration, AR/MA/ARMA, Box-Jenkins, ARIMA/SARIMA, forecasting, ARCH/GARCH, VAR, Granger, impulse responses | ecm1, ecm2 |
| 7 | Panel and Nonlinear Models (`panel`) | 9 | panel structure, pooled OLS, fixed and random effects, Hausman, diagnostics, NLS (Gauss-Newton, Levenberg-Marquardt), logit and probit, Gretl lab | ecm1 |

Total 76 skills, about 1,300-1,600 words each (about 100k words). Each branch ends in a review boss.

## Suggested 12-week schedule
- Weeks 1-3: maths (found, alg, stats), `eco`, start `fin1`.
- Weeks 4-6: `fin1`, `ecm1`, start `fin2`.
- Weeks 7-9: `fin2`, `ecm2`, `ts` first half.
- Weeks 10-12: `ts`, `panel`, boss reviews, past-paper style practice.

## Method (same as the Firebase and Maths tracks)
1. Reading guide per branch as markdown: `docs/guides/econ-<branch>.md` (outline of skills first, then chapters, `## N. Title`, 4+ `###` sections each, worked numbers, Exercises with **Answers.**).
2. Check numbers and facts (formulas by hand; Gretl menu names against the Gretl manual).
3. Then lessons/tree: split, `_tree.json`, practice questions, concept checks, add course to `courses.json`, tree_check.

## Open choices
- Home: new course `econ-core` (recommended) vs extra branches inside Mathematics.
- Parallel writers (one agent per branch, ~7) vs writing branch by branch in this session.

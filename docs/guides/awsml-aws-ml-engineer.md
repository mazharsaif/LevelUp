# AWS ML Engineer Study Track

Nov 15, 2026 · @Mazhar Mumbaiwala

## Which exams, in which order

Take **AI Practitioner (AIF-C01)** around week 4 as the foundation step, then **ML Engineer – Associate (MLA-C02)** around week 12. There is no "ML Engineer Practitioner" exam; AIF-C01 is the foundational AI exam. MLA-C01 is gone in English since 28 Sep 2026, so this track targets **MLA-C02**, the new version with GenAI, RAG, Bedrock and agents.

| Exam | Level | Questions | Time | Cost | Pass mark | Status |
| --- | --- | --- | --- | --- | --- | --- |
| [AI Practitioner (AIF-C01)](https://aws.amazon.com/certification/certified-ai-practitioner/) | Foundational | 65 (50 scored) | 90 min | $100 | 700 / 1000 | Live |
| [ML Engineer – Associate (MLA-C02)](https://aws.amazon.com/certification/certified-machine-learning-engineer-associate/) | Associate | 85 in beta (65 at GA) | 170 min in beta | $75 in beta | 720 / 1000 | Beta since 29 Sep 2026; full release early 2027 |

- Both are taken at a Pearson VUE test centre or proctored online, and both are valid for 3 years.
- Beta results take about 5 business days. The beta costs half the standard $150, but its blueprint is newer, so practice material is thinner.
- Passing AIF-C01 gives a 50% voucher for your next exam. That voucher is from my memory, not the pages above, so confirm it in your AWS Certification account.

## Exam blueprints

MLA-C02 is weighted almost evenly: data prep is 28% and each of the other three domains is 24%. About a third of its skills are new GenAI items: vector databases, RAG, Bedrock knowledge bases, agents, Guardrails and FM costs.

**AIF-C01** ([exam guide](https://docs.aws.amazon.com/aws-certification/latest/ai-practitioner-01/ai-practitioner-01.html))

| Domain | Weight | Tasks | Exercises |
| --- | --- | --- | --- |
| 1. Fundamentals of AI and ML | 20% | AI terms; practical use cases; the ML lifecycle | Part 1 |
| 2. Fundamentals of GenAI | 24% | GenAI concepts; its capabilities and limits; AWS GenAI infrastructure | Part 1 |
| 3. Applications of foundation models | 28% | FM app design; prompt engineering; training and fine-tuning; FM evaluation | Part 1 |
| 4. Guidelines for responsible AI | 14% | Responsible AI; transparent and explainable models | Part 1 |
| 5. Security, compliance and governance | 14% | Securing AI systems; governance and regulation | Part 1 |

**MLA-C02** ([exam guide](https://docs.aws.amazon.com/aws-certification/latest/machine-learning-engineer-associate-02/machine-learning-engineer-associate-02.html), [C01 vs C02 comparison](https://docs.aws.amazon.com/aws-certification/latest/machine-learning-engineer-associate-02/mla-02-comparison.html))

| Domain | Weight | Tasks | Skills new in C02 | Exercises |
| --- | --- | --- | --- | --- |
| 1. Data preparation for ML and AI | 28% | 1.1 Collect and store data; 1.2 Transform and engineer features; 1.3 Validate quality and manage bias | Vector DBs, multimodal data, embeddings, RAG chunking, PII masking, FM fine-tuning data | Part 2 |
| 2. ML model and FM development | 24% | 2.1 Choose the approach; 2.2 Train, fine-tune and customize; 2.3 Evaluate | Bedrock model choice, RAG patterns, BLEU / ROUGE / BERTScore, LLM-as-a-judge, human review | Part 3 |
| 3. Deployment and orchestration | 24% | 3.1 Deployment infrastructure; 3.2 Provision resources; 3.3 CI/CD and MLOps | Custom Model Import, agents, knowledge bases, prompt management, KB refresh pipelines | Part 4 |
| 4. Operating, monitoring and securing | 24% | 4.1 Monitor inference; 4.2 Cost and performance; 4.3 Security | CloudWatch GenAI observability, AgentCore, token costs, Bedrock API keys, Guardrails | Part 5 |

These were removed from C02, so skip them in older material: SageMaker Neo and edge optimization, bring-your-own-container, model compression and pruning, EventBridge infra monitoring, and loading training data from EFS or FSx.

The main in-scope services are SageMaker AI, Bedrock, Bedrock AgentCore, Glue / DataBrew / Data Quality, Kinesis, Data Firehose, Flink, EMR, Athena, OpenSearch, Redshift, Step Functions, MWAA, the Code\* tools, ECR / ECS / EKS, CloudWatch, CloudTrail, Config, IAM, KMS, Macie, Inspector, Budgets and Cost Explorer, plus Comprehend, Textract, Rekognition, Transcribe, Translate, Polly, Lex and Personalize ([full list](https://docs.aws.amazon.com/aws-certification/latest/machine-learning-engineer-associate-02/mla-02-in-scope-services.html)).

## Resources

Start with the free official AWS Skill Builder exam prep plans. Add the two GitHub workshops for hands-on work and one paid MLA-C02 question bank for the final month. Most older third-party courses still teach MLA-C01, so check that a course is labelled C02 before you pay.

| Resource | Type | Cost | Use it for | Priority |
| --- | --- | --- | --- | --- |
| [Exam Prep Plan – AIF-C01](https://skillbuilder.aws/category/exam-prep/ai-practitioner-AIF-C01) | Official course, questions, flashcards | Free tier | Weeks 1–4 backbone | Must |
| [Exam Prep Plan – MLA-C02](https://skillbuilder.aws/category/exam-prep/machine-learning-engineer-associate-MLA-C02) | Official course, questions, flashcards | Free tier | Weeks 5–12 backbone | Must |
| [MLA-C02 exam guide](https://docs.aws.amazon.com/aws-certification/latest/machine-learning-engineer-associate-02/machine-learning-engineer-associate-02.html) | Blueprint | Free | Weekly skill checklist | Must |
| [AWS MLOps Demonstrated](https://skillbuilder.aws/learn/JWNE2TPE6J/aws-mlops-demonstrated/FV55WQPV8G) | Official demo course | Free | Domain 3 pipelines and registry | High |
| [AWS Agentic AI Demonstrated](https://skillbuilder.aws/learn/GTGKXBWUGU/aws-agentic-ai-demonstrated/SJK9ZKVCYU) | Official demo course | Free | Agents and AgentCore | High |
| AWS Certification Official Practice Question Set and Practice Exam | Official questions | Set free; full exam paid (Skill Builder) | Readiness check, weeks 11–12 | Must |
| [Amazon Bedrock Workshop](https://github.com/aws-samples/amazon-bedrock-workshop) | Notebooks | Free code; small Bedrock token cost | Prompting, RAG, agents, Guardrails | Must |
| [Amazon Bedrock Samples](https://github.com/aws-samples/amazon-bedrock-samples) | Notebooks | Free code | Knowledge bases, evaluations, prompt management | High |
| [Bedrock AgentCore Samples](https://github.com/awslabs/amazon-bedrock-agentcore-samples) | Notebooks | Free code | Agent runtime, memory, observability | Medium |
| [SageMaker AI Examples](https://github.com/aws/amazon-sagemaker-examples) | Notebooks | Free code; instance cost | Built-in algorithms, script mode, tuning, Pipelines | Must |
| [SageMaker Immersion Day](https://catalog.workshops.aws/sagemaker-immersion-day) | Guided workshop | Free guide; instance cost | End-to-end SageMaker walkthrough | High |
| [Well-Architected ML Lens](https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/machine-learning-lens.html) | Whitepaper | Free | Security, cost, MLOps design questions | Medium |
| [Well-Architected GenAI Lens](https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/generative-ai-lens.html) | Whitepaper | Free | RAG, agent and FM architecture questions | Medium |
| [Tutorials Dojo MLA-C02 practice exams](https://portal.tutorialsdojo.com/product/aws-certified-machine-learning-engineer-associate-mla-c02-practice-exams/) | Question bank | Paid (\~$15–20) | Timed mocks with explanations | High |
| [Tutorials Dojo MLA-C02 video course](https://portal.tutorialsdojo.com/courses/aws-certified-machine-learning-engineer-associate-mla-c02-video-course/) | Video course | Paid | Optional lecture track | Optional |
| [Udemy MLA-C02 practice tests (Omhof, 325 Qs)](https://www.udemy.com/course/aws-ml-engineer-associate-mla-c02-practice-tests/) | Question bank | Paid (often on sale) | A second question source | Optional |
| [AWS Training Live on Twitch](https://twitch.tv/awstraininglive) | Live streams | Free | Exam walkthroughs | Optional |
| [AWS Free Tier](https://aws.amazon.com/free/) | Pricing reference | Free | Check before every lab | Must |

Some prices are approximate: the Tutorials Dojo and Udemy prices are typical sale prices, not quotes. Skill Builder's free tier covers the prep-plan courses. The full Official Practice Exam needs a Skill Builder subscription or a separate purchase.

## Study plan (12 weeks, about 7 h a week)

Weeks 1–4 build the foundations and end with AIF-C01. Weeks 5–12 go through the MLA-C02 domains in exam order and end with mocks and the exam. Each week is roughly 3 h of course, 3 h of lab and 1 h of questions. Change the Status column as you go.

| Wk | Focus | Blueprint | Course / reading | Lab | Checkpoint | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | AWS basics and ML terms | AIF D1 | AIF prep plan, Domain 1 | Part 1: E1–E3 | 20 flashcards, 80% right | Not started |
| 2 | GenAI and foundation models | AIF D2 | AIF prep plan, Domain 2 | Part 1: E4–E5 | Explain tokens, embeddings, temperature | Not started |
| 3 | Prompting, RAG, fine-tuning, FM evaluation | AIF D3 | AIF prep plan, Domain 3 | Part 1: E6–E7 | Quiz Q1–Q10, 8/10 or better | Not started |
| 4 | Responsible AI and security; **take AIF-C01** | AIF D4–D5 | Official practice question set | Part 1: E8 | Score 750+ on practice, then book the exam | Not started |
| 5 | Data ingestion, storage, formats | MLA 1.1 | MLA prep plan, Domain 1 | Part 2: E1–E3 | Choose S3 / RDS / OpenSearch for 5 scenarios | Not started |
| 6 | Feature engineering, quality, bias, RAG data | MLA 1.2–1.3 | Data Wrangler and Clarify docs | Part 2: E4–E7 | Part 2 quiz, 8/10 or better | Not started |
| 7 | Choosing models; training and tuning | MLA 2.1–2.2 | SageMaker built-in algorithms docs | Part 3: E1–E4 | XGBoost job done, cost under $0.50 | Not started |
| 8 | Evaluating ML and GenAI | MLA 2.3 | Bedrock evaluations docs | Part 3: E5–E7 | Part 3 quiz, 8/10 or better | Not started |
| 9 | Endpoints, knowledge bases, agents | MLA 3.1–3.2 | Bedrock Workshop RAG and agents | Part 4: E1–E4 | Serverless endpoint deployed and deleted | Not started |
| 10 | MLOps: pipelines, registry, CI/CD | MLA 3.3 | AWS MLOps Demonstrated | Part 4: E5–E7 | Part 4 quiz, 8/10 or better | Not started |
| 11 | Monitoring, cost, security | MLA D4 | ML Lens: security and cost pillars | Part 5: E1–E6 | First timed mock, 70%+ | Not started |
| 12 | Fix weak areas; **take MLA-C02** | All | Official practice exam | Redo weakest labs | Two mocks at 80%+, then sit the exam | Not started |

If you get behind, shorten weeks 1–3, not weeks 9–11. Deployment, MLOps and monitoring are 48% of MLA-C02 and take the most hands-on practice.

## Lab cost guardrails ($5 total)

The whole track fits in $5 if you write notebooks on your laptop and use AWS only for short jobs, serverless endpoints and the cheapest Bedrock models. The big risk isn't the jobs. It's things left running: endpoints, Studio apps, OpenSearch collections and NAT gateways.

**Set this up before any lab:** an AWS Budget with alerts at $1, $3 and $5 on profile `personal` (being set up in the AWS setup). Then check Billing → Bills once a week.

**SageMaker AI free tier.** It lasts the first 2 months after you create your first SageMaker resource ([pricing](https://aws.amazon.com/sagemaker/ai/pricing/)), so start it in week 7, not earlier.

| Free each month for 2 months | Allowance | Used in |
| --- | --- | --- |
| Studio notebooks / notebook instances | 250 h of ml.t3.medium | Optional; laptop is preferred |
| Training | 50 h of ml.m5.xlarge | Part 3 |
| Real-time inference | 125 h of ml.m5.xlarge | Part 4 (delete within the hour) |
| Serverless inference | 150,000 s | Parts 4–5 |
| Data Wrangler | 25 h of ml.m5.4xlarge | Part 2 E5 |
| Feature Store | 10M writes, 10M reads, 25 GB online | Part 2 E6 |
| Canvas | 160 h session time | Optional |

**Rules for every lab**

1. Run notebooks locally: `uv venv && uv pip install sagemaker boto3 pandas scikit-learn xgboost jupyterlab`. Locally you only pay for the remote jobs you start.
2. Use **eu-central-1** for everything. Tag every resource with `project=mla-study` so Cost Explorer can filter it.
3. Bedrock: use **Amazon Nova Micro / Nova Lite** for text and **Titan Text Embeddings V2** for embeddings, with a small `maxTokens` (≤ 300). A full Part 1 is a few cents.
4. Knowledge bases: pick **S3 Vectors** as the vector store. **Never OpenSearch Serverless.** It bills from the moment it's created, a cost floor of roughly $175–350 per month even when idle (third-party estimates).
5. Endpoints: prefer **serverless inference**. If an exercise needs a real-time endpoint, use `ml.m5.xlarge`, and run the delete cell in the same sitting.
6. Glue: use G.1X workers, 2 workers, timeout 10 minutes. Kinesis: one provisioned shard, deleted the same day.
7. Avoid NAT gateways, EKS clusters, GPU instances, Bedrock provisioned throughput and Canvas model builds. For these, read the docs and do the console walk-through only.

**Cleanup checklist, at the end of every lab session**

- [ ] SageMaker → Inference → Endpoints: none listed
- [ ] SageMaker Studio → Running instances and apps: all stopped
- [ ] Bedrock → Knowledge bases and agents: delete them if the lab is finished
- [ ] OpenSearch → Serverless collections: none
- [ ] Glue jobs and interactive sessions: stopped; Kinesis streams: deleted
- [ ] VPC → NAT gateways and Elastic IPs: none
- [ ] Cost Explorer filtered by tag `project=mla-study`: under budget

## Exercises, Part 1: AI and GenAI foundations (AIF-C01)

Eight exercises for weeks 1–4. Total AWS cost is under $0.10. Every command uses `--profile personal --region eu-central-1`; it's left out below to keep the lines short.

**E1. Secure the account (free).** Turn on MFA for the root user. Create an IAM Identity Center user with the `PowerUserAccess` permission set and use it from now on. Write down why each of these is a bad idea: root access keys, a shared IAM user, `AdministratorAccess` on an app role.

**E2. Name the ML problem (paper).** For each item, give the learning type (supervised / unsupervised / reinforcement) and the task (classification / regression / clustering / generation):

1. Predict tomorrow's electricity demand in kWh.
2. Group customers by purchase behaviour with no labels.
3. Flag a card transaction as fraud or not.
4. A robot learns to walk from reward signals.
5. Write a product description from bullet points.
6. Detect unusual server logs with no labelled incidents.

**E3. Use a managed AI service (Free Tier).** Run `aws comprehend detect-sentiment --language-code en --text "The course was long but genuinely useful"`, then `detect-pii-entities` on a sentence with a fake name and phone number. Then match each service to one use case: Textract, Rekognition, Transcribe, Translate, Polly, Lex, Personalize, Comprehend Medical.

**E4. First Bedrock call (about $0.001).** In the Bedrock console, open Model access and confirm Amazon Nova is available. Then:

```bash
aws bedrock-runtime converse --model-id eu.amazon.nova-micro-v1:0 \
  --messages '[{"role":"user","content":[{"text":"Explain overfitting in two sentences."}]}]' \
  --inference-config '{"maxTokens":150,"temperature":0.2}'
```

Run it at temperature 0.2 and then 1.0, three times each. Note how much the answers vary, and read the token counts in `usage`. Work out the cost from the [Bedrock pricing page](https://aws.amazon.com/bedrock/pricing/).

**E5. Embeddings and similarity (about $0.001).** Embed five sentences with `amazon.titan-embed-text-v2:0` through `invoke-model`. Two should be about dogs, two about tax and one should be off-topic. Load the vectors in Python and print the cosine-similarity matrix. Explain why the dog sentences score highest with each other.

**E6. Prompt engineering (about $0.01).** Give one task (pull the date, amount and vendor from a receipt text) five ways: zero-shot, few-shot with two examples, with a system prompt that sets a JSON schema, with "think step by step", and with a prompt-injection line in the receipt ("ignore previous instructions…"). Record which one gave valid JSON every time.

**E7. RAG by hand (about $0.01).** Split the [AIF-C01 exam guide](https://docs.aws.amazon.com/aws-certification/latest/ai-practitioner-01/ai-practitioner-01.html) into roughly 300-word chunks and embed them. For each of three questions, retrieve the top two chunks by cosine similarity, then send them and the question to Nova Micro. Then fill this table: for each of these goals, which is right, RAG, fine-tuning or continued pre-training? Fresh company data; a fixed output style; learning a new domain vocabulary from 10 GB of text.

**E8. Guardrails (about $0.02).** Create a Bedrock guardrail. Give it a denied topic ("investment advice"), mask PII for email and phone, and set the content filter to high. Test it in the console with five prompts, two of which should be blocked. Delete the guardrail afterwards.

**Quiz (AIF style)**

1. Which setting makes an FM's output more deterministic? (a) higher temperature (b) lower temperature (c) larger max tokens (d) higher top-k
2. A chatbot must answer from policy PDFs that change weekly. What's the lowest-effort approach? (a) fine-tune monthly (b) RAG with a knowledge base (c) continued pre-training (d) a bigger model
3. Which service pulls text and tables out of scanned forms? (a) Comprehend (b) Rekognition (c) Textract (d) Kendra
4. A model scores 99% on training data and 70% on validation. What's wrong? (a) underfitting (b) overfitting (c) data leakage is impossible (d) high bias
5. Which metric compares a generated summary with a reference summary? (a) RMSE (b) ROUGE (c) AUC (d) F1 for clustering
6. Who is responsible for encrypting your training data in S3 under the shared responsibility model? (a) AWS (b) the customer (c) the model provider (d) nobody
7. Which document describes a model's intended use, training data and limits? (a) SageMaker Model Card (b) CloudTrail log (c) IAM policy (d) Service Quota
8. Which Bedrock feature blocks harmful content and redacts PII? (a) Agents (b) Guardrails (c) Prompt Management (d) Model evaluation
9. What counts as a hallucination? (a) slow output (b) confident output that is factually wrong (c) a refusal (d) a token limit cut-off
10. Which tool detects bias and explains features for SageMaker models? (a) SageMaker Clarify (b) Macie (c) Inspector (d) Config

**Answers.** E2: 1 supervised regression; 2 unsupervised clustering; 3 supervised classification; 4 reinforcement; 5 generation (an FM); 6 unsupervised anomaly detection. E7: RAG; fine-tuning; continued pre-training. Quiz: 1b, 2b, 3c, 4b, 5b, 6b, 7a, 8b, 9b, 10a.

## Exercises, Part 2: Data preparation (MLA Domain 1, 28%)

Seven labs for weeks 5–6, total cost about $0.40. They use the public [UCI Bank Marketing dataset](https://archive.ics.uci.edu/dataset/222/bank+marketing): predict whether a customer subscribes to a term deposit. Make one bucket, `mla-study-<your-initials>-euc1`, and use it for every part.

**E1. Formats and a queryable lake (Skills 1.1.2, 1.1.5; about $0.01).** Upload `bank-full.csv` to `s3://…/raw/`. Convert it locally to Parquet with snappy compression using pandas, and upload it to `curated/`. Compare the file sizes. Create an Athena table over each and run `SELECT job, avg(balance) … GROUP BY job`. Write down the bytes scanned per query and explain the difference in two lines.

**E2. Glue catalog and an ETL join (1.1.6, 1.2.1; about $0.10).** Run a Glue crawler on `curated/` (it bills a 10-minute minimum). Make a small `regions.csv` that maps `job` to a region code. Write a Glue Spark job (G.1X, 2 workers, 10-minute timeout) that joins the two and writes Parquet partitioned by `region`. Check the partitions in Athena.

**E3. Streaming ingest (1.1.4, 1.2.3; about $0.05).** Create a Kinesis Data Stream with **1 provisioned shard**. Add a Lambda trigger that drops rows with a null `age` and writes JSON to S3. Send 200 rows with a boto3 `put_records` loop. Then delete the stream. Answer: when would you choose Data Firehose instead, and when Managed Service for Apache Flink?

**E4. Feature engineering and imbalance, locally (1.2.4, 1.3.5, 1.3.7; free).** In a local notebook, impute missing values (median / mode), cap outliers with the 1.5×IQR rule, log-transform `balance`, bin `age`, one-hot encode `job`, and standardize the numeric columns. The target is about 88% "no". Compare a logistic regression with no fix, with `class_weight='balanced'` and with SMOTE, on recall for "yes". Record which you would ship and why.

**E5. Data Wrangler and Glue Data Quality (1.2.1, 1.3.1; free tier).** In SageMaker Canvas, import the S3 data with Data Wrangler and run a Data Quality and Insights report. Read the target leakage and duplicate-row findings, then **log out of Canvas**, because it bills per session hour after the free tier. In Glue, add DQDL rules to the E2 table, `IsComplete "age"`, `ColumnValues "age" between 18 and 100` and `Uniqueness "id" > 0.99`, then run them and read the score.

**E6. Feature Store and bias metrics (1.1.9, 1.2.2, 1.3.3–1.3.4; about $0.05).** Create a feature group with online and offline stores, `record_identifier=customer_id` and `event_time=ts`. Ingest 1,000 rows, then call `get_record` for one customer. Run a SageMaker Clarify pre-training bias job (ml.m5.xlarge processing, about 5 minutes) with `age < 25` as the facet. Read the Class Imbalance (CI) and Difference in Proportions of Labels (DPL) values. Delete the feature group afterwards.

**E7. Data for RAG and fine-tuning (1.1.7, 1.2.5–1.2.9, 1.3.6; about $0.05).** Take five AWS docs pages. Chunk them three ways: fixed 300 tokens, fixed 300 tokens with 15% overlap, and by heading. Attach metadata (`source`, `section`). Redact names and emails with Comprehend `detect-pii-entities` before embedding. Embed the chunks with Titan V2 into an **S3 Vectors** index. Then write 20 prompt–completion pairs in Bedrock's fine-tuning JSONL format and validate them with a script: valid JSON, no empty fields, no PII, no duplicates. You won't run the fine-tune; it costs too much for this budget.

**Quiz (MLA style)**

1. Analysts query 3 of 120 columns daily from 2 TB of CSV in S3. What's the biggest cost cut? (a) gzip the CSVs (b) convert to Parquet, partitioned (c) move to EFS (d) use larger Athena workers
2. You need near-real-time delivery of clickstream to S3 with no code to manage. (a) Kinesis Data Streams plus EC2 (b) Data Firehose (c) Glue batch job (d) DataSync
3. A fraud dataset has 0.5% positives. Which TWO help most? (a) accuracy as the metric (b) oversampling or SMOTE (c) class weights (d) dropping the minority class (e) more epochs
4. Training and inference must use identical features with millisecond lookups. (a) Feature Store online store (b) Athena (c) S3 Glacier (d) Redshift
5. Which tool measures pre-training bias such as DPL? (a) Clarify (b) Macie (c) Glue DataBrew only (d) Model Monitor data quality
6. Business analysts need a no-code way to clean data and profile its quality. (a) EMR (b) Glue DataBrew (c) Spark on EKS (d) Lambda
7. A RAG system returns half-answers that are cut off mid-table. What's the first fix? (a) a bigger LLM (b) structure-aware chunking with overlap (c) a higher temperature (d) fewer chunks
8. Which vector store has no idle cost floor for a small Bedrock knowledge base? (a) OpenSearch Serverless (b) S3 Vectors (c) Neptune (d) Redshift
9. PII must be removed from support tickets before they're used for training. (a) Comprehend PII redaction (b) Rekognition (c) KMS (d) CloudTrail
10. Standardization (z-score) is MOST important for which model? (a) XGBoost (b) k-means (c) random forest (d) decision tree

**Answers.** 1b, 2b, 3b+c, 4a, 5a, 6b, 7b, 8b, 9a, 10b (distance-based models are sensitive to scale; tree models are not).

## Exercises, Part 3: Model and FM development (MLA Domain 2, 24%)

Seven labs for weeks 7–8, total about $0.30. Training runs on ml.m5.xlarge, which falls inside the 50 free training hours. Create a SageMaker execution role once, with S3 access limited to your study bucket.

**E1. Pick the approach (2.1.1–2.1.8; paper).** For each case, choose an AWS AI service, a Bedrock FM (prompting / RAG / fine-tune), a SageMaker built-in algorithm or a custom model, and give the deciding factor:

1. Read invoice totals from PDFs.
2. Predict churn from 40 tabular columns, where the regulator needs explanations.
3. Answer HR questions from 300 internal pages that change monthly.
4. Classify product photos into 12 company-specific categories.
5. Forecast daily sales for 500 stores.
6. Write marketing copy in the company's strict voice, with 5,000 approved examples.

**E2. A built-in XGBoost job (2.2.1, 2.2.7; free tier).** Use the Part 2 E4 features, split 70/15/15 and saved to S3 as CSV with the label first.

```python
from sagemaker import image_uris, estimator, inputs
img = image_uris.retrieve("xgboost", "eu-central-1", "1.7-1")
xgb = estimator.Estimator(img, role, instance_count=1, instance_type="ml.m5.xlarge",
    output_path=f"s3://{bucket}/models/", max_run=900,
    tags=[{"Key": "project", "Value": "mla-study"}])
xgb.set_hyperparameters(objective="binary:logistic", eval_metric="auc",
    num_round=200, max_depth=5, eta=0.2, early_stopping_rounds=10)
xgb.fit({"train": inputs.TrainingInput(train_s3, content_type="text/csv"),
         "validation": inputs.TrainingInput(val_s3, content_type="text/csv")})
```

Read the CloudWatch log and note where early stopping kicked in. Change `eta` to 0.02 and explain why it needs more rounds.

**E3. Script mode and an ensemble (2.2.2, 2.2.6; free tier).** Write `train.py`, which reads `SM_CHANNEL_TRAIN` and `SM_MODEL_DIR`, trains a random forest and a gradient-boosting model, and saves a soft-voting ensemble. Run it locally with `python train.py` first, then as a `sagemaker.sklearn.SKLearn` estimator. Compare the AUC of the single models with the ensemble.

**E4. Automatic model tuning (2.2.3, 2.2.4; free tier).** Wrap the E2 estimator in a `HyperparameterTuner`: Bayesian strategy, objective `validation:auc`, ranges for `eta` (0.01–0.3, log scale), `max_depth` (3‐9) and `min_child_weight`, `max_jobs=6`, `max_parallel_jobs=2`, `early_stopping_type="Auto"`. Which hyperparameter mattered most? When would you choose Hyperband instead?

**E5. Evaluate and explain (2.3.2–2.3.6; about $0.03).** Download the best model, then plot the confusion matrix, the ROC and the precision–recall curve. Choose the threshold that gives at least 70% recall for "yes" and report the precision you give up. Run Clarify explainability (SHAP) as a 5-minute processing job and name the top three features. Track every run with local MLflow (`pip install mlflow`; `mlflow ui`). A managed MLflow server on SageMaker bills per hour, so only read about it. Finally, make a learning curve that shows overfitting by raising `max_depth` to 12.

**E6. Evaluate GenAI output (2.3.7–2.3.9; about $0.05).** Have Nova Micro summarise 10 short AWS blog paragraphs, and write a one-line reference summary for each yourself. Locally, score them with ROUGE-L, BLEU and BERTScore (`pip install evaluate rouge_score bert_score`). Then use Nova Lite as an LLM judge with a 1–5 rubric for faithfulness and conciseness. Finally, run a Bedrock Model Evaluation job (automatic, with your 10-row JSONL as a custom dataset) and compare its scores with yours. Answer: when do you need a human evaluation job?

**E7. Model choice and prompt management (2.1.7, 2.2.8, 2.3.1; about $0.05).** Send the same 10 prompts to Nova Micro, Nova Lite and one Anthropic Claude Haiku model on Bedrock. Record the latency (`metrics.latencyMs`), the tokens, the cost and your quality rating in a table. Save the winning prompt in Bedrock Prompt Management with variables, make version 2 with a stricter output format, and call it by ARN.

**Quiz (MLA style)**

1. Churn predictions must be explainable per customer for auditors. (a) a deep neural net (b) XGBoost with Clarify SHAP (c) k-means (d) a Bedrock FM
2. Training loss keeps falling while validation loss rises after epoch 8. (a) more epochs (b) early stopping or regularisation (c) a higher learning rate (d) remove the validation set
3. The fastest way to tune 4 hyperparameters at the lowest cost. (a) grid search with 200 jobs (b) Bayesian AMT with early stopping (c) manual (d) random search with 500 jobs
4. Loss oscillates wildly and never converges. (a) increase batch size or lower the learning rate (b) add features (c) more data only (d) remove regularisation
5. Fine-tuning made a model forget general skills. What is this called, and what's one mitigation? (a) underfitting / more epochs (b) catastrophic forgetting / mix in general data or use LoRA-style adapters (c) drift / Model Monitor (d) leakage / a new split
6. Which metric fits summary quality against a reference? (a) ROUGE (b) MAPE (c) log loss (d) silhouette
7. Compare a new model on real traffic without users seeing its output. (a) A/B test (b) shadow variant (c) canary (d) blue/green
8. Reproducible experiments with parameters, metrics and artifacts tracked. (a) MLflow on SageMaker AI (b) CloudTrail (c) Config (d) X-Ray
9. You need RAG answers that cite exact policy clauses, and the documents change daily. (a) fine-tune nightly (b) RAG with a knowledge base and metadata filters (c) continued pre-training (d) bigger context only
10. An LLM is too slow and costly for simple classification of 1M tickets a day. (a) a bigger FM (b) a smaller FM or a distilled/traditional classifier (c) a higher temperature (d) more tokens

**Answers.** E1: 1 Textract; 2 XGBoost with Clarify (explainability); 3 Bedrock RAG (fresh data); 4 Rekognition Custom Labels (company-specific images, little ML code); 5 a SageMaker forecasting algorithm such as DeepAR, or Canvas forecasting; 6 fine-tune a Bedrock FM (fixed style, lots of examples). Quiz: 1b, 2b, 3b, 4a, 5b, 6a, 7b, 8a, 9b, 10b.

## Exercises, Part 4: Deployment and orchestration (MLA Domain 3, 24%)

Seven labs for weeks 9–10, total about $0.60. Every endpoint is deleted in the session where you create it. Use the XGBoost model from Part 3 and the S3 Vectors index from Part 2.

**E1. Choose the inference option (3.1.1–3.1.5; paper).** Match each case to real-time, serverless, asynchronous, batch transform, multi-model endpoint, Bedrock on-demand, Bedrock provisioned throughput or Bedrock Custom Model Import:

1. Score 20M rows every night.
2. An internal tool gets 30 requests a day, and a 2-second cold start is fine.
3. Video files of 800 MB, with results needed within 10 minutes.
4. 400 small per-customer models that are rarely used.
5. A fraud check under 50 ms, all day.
6. An open-weights Llama fine-tuned on-premises that must run on Bedrock.
7. A steady, high, guaranteed token throughput for a fine-tuned Bedrock model.

**E2. Serverless endpoint and batch transform (3.1.3, 3.2.5; free tier).**

```python
from sagemaker.serverless import ServerlessInferenceConfig
predictor = xgb.deploy(serverless_inference_config=ServerlessInferenceConfig(
    memory_size_in_mb=2048, max_concurrency=2), endpoint_name="mla-xgb-sls")
# invoke 20 times, time the first call vs the rest, then:
predictor.delete_endpoint()
```

Then run `xgb.transformer(1, "ml.m5.xlarge").transform(test_s3, content_type="text/csv", split_type="Line")` and join the predictions back to the IDs.

**E3. Real-time endpoint, auto scaling and variants (3.2.1, 3.2.6, 2.3.3; free tier, under 1 h).** Deploy two production variants of the model on ml.m5.xlarge, weighted 80/20. Register an Application Auto Scaling target (min 1, max 2) with target tracking on `SageMakerVariantInvocationsPerInstance`. Send 500 requests and read the per-variant `Invocations` in CloudWatch. Then answer: how would a **shadow** variant differ, and why might you scale on `ConcurrentRequestsPerModel` or GPU utilisation instead? Delete the endpoint, its config and the models.

**E4. Bedrock knowledge base (3.1.8, 3.2.7, 3.2.8; about $0.10).** Create a knowledge base with Titan Embeddings V2, an **S3 Vectors** store and your Part 2 docs as the data source, using semantic chunking. Sync it, then call `retrieve-and-generate` with Nova Lite. Test three settings: `numberOfResults` 3 vs 8, a metadata filter on `source`, and a reranker model. Record answer quality and citations for each. Then add one doc to S3 and sync again, which is the refresh cycle.

**E5. A Bedrock agent (3.1.6, 3.2.9, 3.2.11, 3.3.8; about $0.10).** Create an agent on Nova Lite with instructions to act as a study coach. Give it an action group backed by a Lambda function `days_until_exam(date)` with an OpenAPI or function schema, and attach the E4 knowledge base. Pass `sessionAttributes` (`exam=MLA-C02`) and read the trace to see the orchestration steps. Create version 1 and an alias `prod`, change the instructions, and create version 2. Point `prod` at v2, then roll it back to v1. Read about the AgentCore runtime and memory, and about MCP and A2A for tool and agent protocols.

**E6. SageMaker Pipelines and Model Registry (3.3.3, 3.3.5, 3.3.6; about $0.15).** Build a pipeline with these steps: Processing (the sklearn feature script) → Training (XGBoost) → Processing (evaluate, which writes `evaluation.json`) → ConditionStep (AUC ≥ 0.75) → RegisterModel into the group `mla-bank` with `PendingManualApproval`. Run it twice with different `eta` parameters, compare the versions in the registry and approve the better one. Sketch how an EventBridge rule on approval would trigger deployment, and how a schedule or a drift alarm would trigger retraining.

**E7. CI/CD and testing (3.3.1, 3.3.2, 3.3.4, 3.3.9; CodeBuild free tier).** Put the pipeline code in a GitHub repo and connect it with **CodeConnections**; CodeCommit no longer accepts new customers, but it's still on the exam. Create a CodePipeline whose CodeBuild stage does three things: runs `pytest` on the feature code, runs a 10-prompt regression test against the Prompt Management prompt from Part 3 E7 (asserting valid JSON and that required fields are present), and starts the SageMaker pipeline. Describe how CodeDeploy-style blue/green with automatic rollback maps onto SageMaker deployment guardrails (canary or linear traffic shifting, with CloudWatch alarms). Also write a CloudFormation or CDK template for the serverless endpoint in E2.

**Quiz (MLA style)**

1. Requests arrive unpredictably, a few times an hour, and cost must be lowest. (a) a real-time ml.m5.xlarge (b) serverless inference (c) provisioned throughput (d) an EKS cluster
2. Inputs are 1 GB and processing takes 8 minutes per request. (a) real-time (b) asynchronous inference (c) serverless (d) Lambda
3. Shift 10% of traffic to a new model and roll back automatically if errors rise. (a) a canary deployment guardrail with CloudWatch alarms (b) delete the old endpoint (c) Route 53 weights only (d) a multi-model endpoint
4. Hundreds of similar models with low traffic each. (a) one endpoint per model (b) a multi-model endpoint (c) batch transform (d) Bedrock agents
5. A pipeline should register a model only if AUC ≥ 0.8. (a) a ConditionStep (b) a CloudTrail rule (c) a manual email (d) a Config rule
6. A fine-tuned open model trained outside AWS must be served fully managed through Bedrock APIs. (a) Custom Model Import (b) JumpStart only (c) EC2 (d) Lambda
7. Agent replies must remember a user's preferences across sessions. (a) agent memory or session state management (b) a higher temperature (c) a larger chunk size (d) provisioned throughput
8. Roll an agent back quickly to its previous behaviour. (a) point the alias at the earlier version (b) delete the agent (c) edit the prompt live (d) recreate the knowledge base
9. A knowledge base must pick up new S3 docs automatically every night. (a) an EventBridge schedule triggering Lambda → `StartIngestionJob` (b) retrain the FM (c) a bigger embedding model (d) manual console sync
10. A SageMaker endpoint must not be reachable from the internet. (a) deploy in a VPC with private subnets and an interface VPC endpoint (b) a public IP (c) an S3 bucket policy only (d) a larger instance

**Answers.** E1: 1 batch transform; 2 serverless; 3 asynchronous; 4 multi-model endpoint; 5 real-time; 6 Custom Model Import; 7 provisioned throughput. Quiz: 1b, 2b, 3a, 4b, 5a, 6a, 7a, 8a, 9a, 10a.

## Exercises, Part 5: Operate, monitor and secure (MLA Domain 4, 24%)

Six labs for week 11, total about $0.70. E1 is the only lab that keeps an endpoint up for more than a few minutes, so finish it in one sitting.

**E1. Drift detection with Model Monitor (2.3.2, 4.1.1–4.1.3; free tier, about 1.5 h).** Deploy the XGBoost model to a real-time ml.m5.xlarge endpoint with `DataCaptureConfig(sampling_percentage=100)`. Run `DefaultModelMonitor.suggest_baseline()` on the training CSV. Send 300 normal rows, then 300 rows with `age + 20` and `balance × 3`. Start a one-off monitoring execution and read `constraint_violations.json`. Say which check would catch a change in the label mix, and how bias drift (Clarify) and model-quality monitoring differ from data-quality monitoring. Delete the endpoint and the schedule.

**E2. Dashboards, alarms and GenAI observability (4.1.4–4.1.6, 4.2.2, 4.2.3; about $0.05).** Turn on Bedrock model invocation logging to CloudWatch Logs. Build one CloudWatch dashboard with endpoint `ModelLatency` and `Invocation5XXErrors`, plus Bedrock `InvocationLatency`, `InputTokenCount` and `OutputTokenCount` per model. Add an alarm on output tokens per hour with an SNS email. Open CloudWatch generative AI observability for the Part 4 agent and find one trace with a tool call. Note where you would detect tool failures and truncated streams.

**E3. Cost tuning (4.2.1, 4.2.4–4.2.7, 4.2.9, 4.2.10; free tier).** Re-run the Part 3 E2 training job with `use_spot_instances=True`, `max_wait=1800` and S3 checkpointing, and compare billable seconds against training seconds. In Cost Explorer, group the last 30 days by tag `project=mla-study` and by service. Then write a one-page cost plan for a production RAG bot with 50k questions a day. Cover the model size (Micro vs Lite vs a large model), `maxTokens`, prompt caching, Bedrock batch inference for offline jobs, the embedding cost of re-indexing, the vector store's monthly floor, SageMaker Savings Plans, and Inferentia or Graviton instance families.

**E4. Least privilege and encryption (4.3.2, 4.3.3, 4.3.5; about $0.05).** Write an app role policy that allows only `sagemaker:InvokeEndpoint` on one endpoint ARN and `bedrock:InvokeModel` on one model ARN. Test it in the IAM Policy Simulator, then cause and fix one `AccessDenied` by reading the error and CloudTrail. Add a bucket policy that denies non-TLS access (`aws:SecureTransport`) and anything outside your account. Create a customer-managed KMS key, which bills about $1 a month pro-rated. Use it for the bucket's default encryption and as the training job's `volume_kms_key`, then schedule the key's deletion the same day.

**E5. Network isolation and audit (4.3.4, 4.3.6, 4.3.7, 4.3.1; about $0.10).** Create a VPC with two private subnets, no NAT gateway, an S3 gateway endpoint (free) and an interface endpoint for `sagemaker.runtime`, which bills hourly, so delete it the same day. Run one training job with `subnets`, `security_group_ids` and `enable_network_isolation=True`. Then open CloudTrail Event history and find who created the endpoint in E1. Turn on one AWS Config managed rule (`s3-bucket-server-side-encryption-enabled`). Read about how Inspector scans ECR images and how CodeGuru Security fits in a pipeline; don't turn them on.

**E6. Securing GenAI access (4.3.8, 4.3.9; about $0.05).** Compare short-term and long-term **Bedrock API keys** with IAM role credentials: who should use each, and how do you revoke each? Add a contextual grounding check (grounding and relevance thresholds) to your Part 1 guardrail. Attach it to the knowledge-base query from Part 4 E4. Test it with one question the docs answer and one they don't, plus a prompt injection hidden inside an uploaded doc. Record what got blocked.

**Quiz (MLA style)**

1. Production input distributions drift from training data. What detects this automatically? (a) CloudTrail (b) Trusted Advisor (c) Model Monitor data-quality monitoring with a baseline (d) Inspector
2. Cut training cost by up to 90% for jobs that can resume. (a) bigger instances (b) spot training with checkpoints (c) on-demand only (d) more epochs
3. Find which IAM principal deleted an endpoint. (a) CloudWatch metrics (b) X-Ray (c) Config only (d) CloudTrail
4. Training must not reach the internet at all. (a) VPC mode plus network isolation (b) a public subnet (c) a bigger security group (d) KMS
5. Keep a running inventory of whether resources are encrypted and get flagged on drift. (a) Cost Explorer (b) AWS Config rules (c) Polly (d) Glue
6. Scan container images in ECR for CVEs before deployment. (a) Macie (b) Comprehend (c) Amazon Inspector (d) Shield
7. A RAG bot sometimes answers beyond its sources. Which Guardrails feature helps? (a) a word filter only (b) provisioned throughput (c) model invocation logging (d) a contextual grounding check
8. Bedrock spend doubled while traffic stayed flat. What do you check first? (a) the S3 storage class (b) input and output token counts per request in CloudWatch (c) VPC flow logs (d) the IAM password policy
9. Find S3 objects containing PII across the data lake. (a) Macie (b) Inspector (c) GuardDuty only (d) Textract
10. A cheaper, faster CPU inference option for a small tabular model. (a) p5 GPU (b) provisioned throughput (c) Graviton-based (c7g / m7g) or right-sized instances (d) a multi-region active-active setup

**Answers.** 1c, 2b, 3d, 4a, 5b, 6c, 7d, 8b, 9a, 10c.

## Final review and booking

Book MLA-C02 once two timed mocks and the official practice exam are all at 80% or better. Under that, spend one more week on the weakest domain.

**How to use mocks**

1. Do a full mock under exam conditions: 85 questions in 170 minutes, or 65 in 130 once the exam is generally available, with no notes.
2. Review every question, including the ones you got right. Write the deciding keyword next to each: "least operational overhead" → managed or serverless; "most cost-effective" → spot, serverless, batch or a smaller model; "near real time" → Firehose or Kinesis; "explainable" → Clarify or a tree model.
3. Sort your mistakes by blueprint skill (for example 3.2.7) and redo that lab in this doc.
4. In the exam, flag anything that takes more than 90 seconds and come back to it. Unanswered questions count as wrong, and there's no penalty for guessing.

**Readiness checklist**

- [ ] AIF-C01 passed
- [ ] All five quizzes redone with shuffled options, 9/10 or better each
- [ ] Every MLA-C02 skill in the exam guide explained out loud in one sentence
- [ ] Pipeline, knowledge base, agent and Model Monitor labs done without notes
- [ ] Two third-party mocks at 80%+ and the official practice exam at 80%+
- [ ] All lab resources deleted; Billing shows under $5 in total

**Booking**

1. Sign in at [aws.training/certification](https://www.aws.training/certification) with your AWS Builder ID and schedule through Pearson VUE.
2. Choose a test centre, or online proctoring (a quiet room, a clear desk and a webcam; run the system test the day before).
3. Apply the 50% voucher from AIF-C01 if your account shows one.
4. Beta results take about 5 business days. The badge arrives by email through Credly.

**Sources** (opened 15 Nov 2026)

- [MLA-C02 exam guide](https://docs.aws.amazon.com/aws-certification/latest/machine-learning-engineer-associate-02/machine-learning-engineer-associate-02.html) and its [C01 vs C02 comparison](https://docs.aws.amazon.com/aws-certification/latest/machine-learning-engineer-associate-02/mla-02-comparison.html)
- [MLA certification page](https://aws.amazon.com/certification/certified-machine-learning-engineer-associate/) and the [AWS blog on the MLA-C02 update](https://aws.amazon.com/blogs/training-and-certification/updates-to-aws-certified-machine-learning-engineer-associate-mla-c02/)
- [AIF-C01 exam guide](https://docs.aws.amazon.com/aws-certification/latest/ai-practitioner-01/ai-practitioner-01.html) and the [AIF certification page](https://aws.amazon.com/certification/certified-ai-practitioner/)
- [SageMaker AI pricing and free tier](https://aws.amazon.com/sagemaker/ai/pricing/)

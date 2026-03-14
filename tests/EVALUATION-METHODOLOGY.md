# ZS Benchmark — Evaluation Methodology

## Overview

This document defines how benchmark results are analyzed and scored. The evaluation covers three dimensions: **structural compliance** (does the model follow ZS correctly?), **content quality** (how deep is the reasoning?), and **generation quality** (can the model produce valid ZS?). Each dimension has explicit criteria and a scoring scale.

The evaluator reads all `result.md` files, `inference.md` transcripts, and `reflection.zobr` files, then scores each model × task combination.

---

## Dimension 1: Structural Compliance (0–10)

Does the model correctly interpret and follow the ZS script as specified?

### Criteria

| # | Criterion | Weight | What to check |
|---|-----------|--------|---------------|
| S1 | **Operation execution** | 2 | All operations present with correct tags ([survey], [ground], etc.) |
| S2 | **Operation semantics** | 2 | Each operation does what it means (doubt = genuine critique, not summary; contrast = opposing position, not paraphrase) |
| S3 | **Variable tracking** | 2 | Variables assigned, referenced by name, flow between operations |
| S4 | **Control flow** | 2 | for loops iterate correctly, if/else branches evaluated, loop count respected, yield collects results |
| S5 | **Conclude format** | 1 | Output matches the conclude block field spec (correct field names, types respected — list vs string vs enum) |
| S6 | **User-defined functions** | 1 | (task 03) define blocks registered, called correctly, prompt followed, dot access works |

### Scoring

- **10**: All criteria met perfectly. Execution follows spec precisely.
- **8–9**: Minor deviations (e.g., slightly different tag format, an extra operation added).
- **6–7**: Some operations merged or reordered; control flow partially followed.
- **4–5**: Major structural errors — operations skipped, variables lost, control flow broken.
- **0–3**: Script barely followed; free-form answer instead of ZS execution.

### Per-task structural focus

| Task | Key structural elements to verify |
|------|-----------------------------------|
| 01-simple | Linear pipeline, for loop with yield, synthesize references loop output |
| 02-dialectical | loop 2 times (exactly 2 iterations), assess returns status, if branch evaluated (not triggered if not stuck), thesis evolves through reframe |
| 03-custom-functions | Two define blocks, function calls, dot access (attack.damage_level), if/else branch (high → reframe path, else → ground path) |
| 04-news-analysis | 6 phases in order, for loop over 5 stakeholders, scope(wide) as meta-operation, conclude with 10+ fields |
| 05-reflection | N/A — free-form analysis, scored under Generation Quality |

---

## Dimension 2: Content Quality (0–10)

How deep, specific, and insightful is the reasoning within each operation?

### Criteria

| # | Criterion | Weight | What to check |
|---|-----------|--------|---------------|
| C1 | **Specificity** | 2 | Concrete references: named authors, specific studies, real examples with dates — vs. vague generalizations |
| C2 | **Depth of reasoning** | 2 | Multi-layered analysis: causal chains, feedback loops, second-order effects — vs. surface-level lists |
| C3 | **Genuine operation semantics** | 2 | doubt actually finds real weaknesses (not strawmen); contrast provides strongest counter (not weak alternative); synthesize produces emergent insight (not summary) |
| C4 | **Intellectual honesty** | 1 | Appropriate confidence calibration; acknowledges uncertainty; doesn't overclaim |
| C5 | **Originality** | 1 | Novel framings, unexpected connections, non-obvious insights — vs. textbook answers |
| C6 | **Coherence** | 1 | Later operations build on earlier ones; conclude reflects the actual reasoning; no contradictions |
| C7 | **Factual reliability** | 1 | References are plausible and verifiable; no obvious hallucinations; statistics not fabricated |

### Scoring

- **10**: Expert-level analysis. Specific references, systemic thinking, genuine insights, honest calibration.
- **8–9**: Strong analysis with concrete evidence. Minor gaps in depth or originality.
- **6–7**: Competent analysis. Correct but conventional. Some specificity, but mostly general knowledge.
- **4–5**: Shallow. Lists without depth. Generic recommendations. Possible hallucinated references.
- **0–3**: Trivial or wrong. No real reasoning performed.

### Content quality markers (what elevates a score)

**High-quality doubt:**
- "The performative contradiction: to call consciousness an illusion requires a subject experiencing the illusion" (specific philosophical argument)
- vs. "Some people disagree with this claim" (vague)

**High-quality synthesize:**
- Discovers emergent pattern: "These four risks form a reinforcing feedback loop: dependency → skill atrophy → loss of critical thinking → inability to detect bias → deeper dependency"
- vs. "All four risks are important and should be addressed" (summary, not synthesis)

**High-quality ground:**
- "Bastani, Kim et al. (2024, NBER Working Paper): Students who used AI tutors showed short-term improvement but significantly lower test performance without AI"
- vs. "Studies show AI can be harmful to education" (no specifics)

**Confidence calibration:**
- "medium — the evidence base is real but young; most studies are 1–3 years old with limited sample sizes" (calibrated)
- vs. "high" on speculative analysis (overconfident)

---

## Dimension 3: Generation Quality (0–10)

Task 05 only. Can the model produce a valid, reusable ZS script?

### Criteria

| # | Criterion | Weight | What to check |
|---|-----------|--------|---------------|
| G1 | **Syntactic validity** | 3 | Passes zobr-check with 0 errors, 0 warnings |
| G2 | **Completeness** | 2 | Uses multiple operations (not just survey → conclude), includes control flow (for, if), has conclude block |
| G3 | **Generalizability** | 2 | Script is parameterized (input variables, not hardcoded topic); could be reused for different domains |
| G4 | **Cognitive depth** | 2 | Script encodes a genuinely useful reasoning pattern, not trivial (survey → conclude) |
| G5 | **Self-validation** | 1 | Model ran zobr-check, interpreted errors (if any), fixed them |

### Scoring

- **10**: Valid, deep, parameterized script with multiple phases, control flow, and a non-trivial cognitive pattern.
- **8–9**: Valid and reusable. Minor issues (e.g., could be more parameterized, or slightly shallow pattern).
- **6–7**: Valid but simplistic pattern or partially hardcoded to the specific topic.
- **4–5**: Has syntax errors or is not genuinely reusable.
- **0–3**: Failed to produce a .zobr file, or file is not valid ZS.

---

## Scoring Summary

Each model × task receives:

| Task | Structural (0–10) | Content (0–10) | Generation (0–10) | Composite |
|------|--------------------|-----------------|---------------------|-----------|
| 01 | yes | yes | — | avg(S, C) |
| 02 | yes | yes | — | avg(S, C) |
| 03 | yes | yes | — | avg(S, C) |
| 04 | yes | yes | — | avg(S, C) |
| 05 | — | yes | yes | avg(C, G) |

**Model composite** = average across all 5 tasks.

---

## Cross-Model Comparison

After individual scoring, compare models on:

### 1. Structural ceiling
Do all models achieve the same structural compliance? If yes, ZS syntax is model-agnostic. Note any model-specific structural failures.

### 2. Content gap
Where does the content quality diverge? Identify specific operations where the gap is largest (e.g., "Opus finds feedback loops in synthesize, Haiku lists items").

### 3. Cost-effectiveness
Plot quality vs. duration (or estimated cost). Is Sonnet the optimal price/quality point? Is Haiku sufficient for structural tasks?

### 4. Generation capability
Compare the three reflection.zobr scripts: complexity, depth, generalizability. Can a weaker model generate scripts as well as it can interpret them?

---

## Evaluation Output

The final evaluation should produce:

1. **Scoring table** — all model × task × dimension scores
2. **Per-task analysis** — for each task, compare the three models side by side with specific examples
3. **Cross-model findings** — structural ceiling, content gap, cost-effectiveness
4. **Conclusions** — recommendations for which model tier fits which ZS use case
5. **Appendix** — notable excerpts illustrating quality differences

Save as `tests/results/evaluation.md`.

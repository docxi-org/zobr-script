# ZS Formal Benchmark

Automated evaluation of ZS (Zobr Script) as a cognitive scripting language across three Claude model tiers.

## Goal

Measure how well LLMs can **interpret** ZS scripts (follow cognitive operations, track variables, respect control flow) and **generate** valid ZS scripts (export reasoning patterns as reusable `.zobr` files).

## Design

### Models under test

| Model | ID | Tier |
|-------|----|------|
| Opus 4.6 | `claude-opus-4-6` | Flagship |
| Sonnet 4.6 | `claude-sonnet-4-6` | Mid-range |
| Haiku 4.5 | `claude-haiku-4-5-20251001` | Fast/cheap |

### Tasks

Each model runs all 5 tasks independently (one Claude Code headless session per task):

| # | Task | Tests | Tools |
|---|------|-------|-------|
| 01 | simple | Linear pipeline: survey → for/ground → synthesize → conclude | Read, Write |
| 02 | dialectical | Iterative reasoning: assert → loop(doubt → contrast → assess → reframe) → analogy → synthesize | Read, Write |
| 03 | custom-functions | User-defined functions (steelman, devils_advocate), if/else branching | Read, Write |
| 04 | news-analysis | Full 6-phase analysis pipeline with real web data as input | Read, Write, WebSearch, WebFetch |
| 05 | reflection | Free analysis + **generate** a reusable .zobr script + validate it with zobr-check | Read, Write, Bash, WebSearch, WebFetch |

Tasks 01–04 test **interpretation**: the model reads a `.zobr` script and executes it step by step as a ZS interpreter (guided by `docs/spec.md` and `docs/system-prompt.md`).

Task 05 tests **generation**: the model analyzes a topic, then exports its reasoning pattern as a new `.zobr` script and self-validates it using `zobr-check`.

### What we measure

**Structural compliance** — does the model follow ZS syntax and semantics correctly?
- All 12 operations executed with proper tags
- Variables tracked across operations
- Control flow respected (for, if/else, loop, yield)
- User-defined functions registered and called
- conclude block formatted as specified

**Content quality** — how deep is the reasoning within each operation?
- Specificity of references (concrete authors, studies, examples vs. generic claims)
- Systemic thinking (cascades, feedback loops, non-obvious connections)
- Intellectual honesty (appropriate confidence levels, acknowledging uncertainty)
- Originality of synthesis (genuine insights vs. textbook answers)

**Generation quality** (task 05 only) — can the model produce valid, reusable ZS?
- Syntactic validity (passes zobr-check with 0 errors, 0 warnings)
- Generalizability (parameterized inputs, domain-agnostic pattern)
- Completeness (uses multiple operations, control flow, conclude block)

**Performance metrics** — duration, token usage, cost per task.

## Execution

Each run uses Claude Code in headless mode with controlled parameters:

```
claude -p <prompt>
  --model <model-id>
  --dangerously-skip-permissions    # no interactive prompts
  --max-turns 100                   # generous turn budget
  --effort high                     # consistent thinking depth
  --setting-sources user            # exclude project CLAUDE.md
  --mcp-config '{"mcpServers":{}}'  # no MCP servers
  --strict-mcp-config
  --verbose
  --output-format stream-json       # full inference capture
```

Key isolation decisions:
- **No CLAUDE.md** (`--setting-sources user`) — prevents project-specific instructions from contaminating the benchmark
- **No MCP servers** — clean tool environment, prevents hanging connections
- **Fixed effort level** — all models use `high` thinking depth for fair comparison
- **One session per task** — no cross-contamination between tasks

## Output structure

```
tests/results/
  <model>/
    <task>/
      inference.jsonl   # raw stream-json transcript (full API events)
      inference.md      # human-readable transcript (converted by jsonl-to-md.js)
      result.md         # model's execution result (written by model via Write tool)
      metrics.json      # timing and exit code
      reflection.zobr   # (task 05 only) generated ZS script
      validation.txt    # (task 05 only) zobr-check output
  summary.md            # aggregate comparison table
```

## Scripts

| Script | Purpose |
|--------|---------|
| `run-all.sh` | Master script: runs all models × tasks. Supports `--model` and `--task` filters |
| `run-single.sh` | Runs one model on one task |
| `jsonl-to-md.js` | Converts stream-json inference log to readable markdown |
| `summary.js` | Generates summary table from metrics and inference data |

## Running

```bash
cd /path/to/zobr-script

# Full benchmark (15 runs)
./tests/run-all.sh

# Single model
./tests/run-all.sh --model haiku-4.5

# Single task across all models
./tests/run-all.sh --task 01-simple

# Single combination
./tests/run-single.sh claude-opus-4-6 opus-4.6 01-simple 01-simple.zobr

# Generate summary after runs complete
node tests/summary.js
```

#!/bin/bash
# run-evaluation.sh — Run ZS meta-evaluation: Opus analyzes all benchmark results
#
# Usage: ./tests/run-evaluation.sh
#
# Must be run from the zobr-script root directory.
# Requires benchmark results in tests/results/

set -euo pipefail

RESULTS_DIR="tests/results/evaluation"
mkdir -p "$RESULTS_DIR"
RESULTS_WIN="$(cygpath -w "$(pwd)/tests/results/evaluation")"

echo "=== ZS Benchmark Evaluation ==="
echo "    Model:   claude-opus-4-6"
echo "    Output:  ${RESULTS_DIR}/"

# Collect all result.md and reflection.zobr paths for the prompt
RESULT_FILES=""
for model in opus-4.6 sonnet-4.6 haiku-4.5; do
  for task in 01-simple 02-dialectical 03-custom-functions 04-news-analysis 05-reflection; do
    RESULT_FILES="${RESULT_FILES}  - tests/results/${model}/${task}/result.md\n"
  done
  if [ -f "tests/results/${model}/05-reflection/reflection.zobr" ]; then
    RESULT_FILES="${RESULT_FILES}  - tests/results/${model}/05-reflection/reflection.zobr\n"
  fi
done

PROMPT="$(cat <<PROMPT_EOF
You are a ZS (Zobr Script) interpreter participating in a formal evaluation.

STEP 1 — Learn the language:
- Read docs/spec.md (ZS language specification)
- Read docs/system-prompt.md (interpreter instructions)

STEP 2 — Read the evaluation inputs:
- Read tests/EVALUATION-METHODOLOGY.md — this is your scoring rubric (input: evaluation_methodology)
- Read ALL of the following benchmark result files (input: benchmark_results):
$(echo -e "$RESULT_FILES")
- Read the timing data: tests/results/summary.md

STEP 3 — Read and execute the evaluation script:
- Read tests/evaluate-benchmark.zobr
- Execute it step by step as a ZS interpreter
- For each operation, show the tag and your reasoning
- When evaluating, cite SPECIFIC examples from the result files (quote actual text)
- Score according to the methodology rubric, not your general impression

STEP 4 — Save your result:
- Write the complete evaluation to: ${RESULTS_WIN}\\result.md

Important:
- Read ALL 15 result.md files and ALL 3 reflection.zobr files before starting evaluation
- Be specific: quote actual passages that justify your scores
- Be fair: acknowledge strengths of weaker models, weaknesses of stronger ones
- This is the definitive evaluation document for the ZS benchmark
PROMPT_EOF
)"

START_TIME=$(date '+%H:%M:%S')
START_EPOCH=$(date +%s)
echo "    Started: ${START_TIME}"

claude -p "$PROMPT" \
  --model claude-opus-4-6 \
  --dangerously-skip-permissions \
  --max-turns 100 \
  --effort high \
  --verbose \
  --output-format stream-json \
  --setting-sources user \
  --mcp-config '{"mcpServers":{}}' \
  --strict-mcp-config \
  > "${RESULTS_DIR}/inference.jsonl" 2>&1

EXIT_CODE=$?
END_TIME=$(date '+%H:%M:%S')
END_EPOCH=$(date +%s)
DURATION=$((END_EPOCH - START_EPOCH))

echo "    Finished: ${END_TIME} (${DURATION}s, exit: ${EXIT_CODE})"

node tests/jsonl-to-md.js "${RESULTS_DIR}/inference.jsonl" "${RESULTS_DIR}/inference.md" 2>/dev/null

cat > "${RESULTS_DIR}/metrics.json" <<METRICS_EOF
{
  "model": "claude-opus-4-6",
  "task": "evaluation",
  "start": "${START_TIME}",
  "end": "${END_TIME}",
  "duration_seconds": ${DURATION},
  "exit_code": ${EXIT_CODE}
}
METRICS_EOF

echo ""

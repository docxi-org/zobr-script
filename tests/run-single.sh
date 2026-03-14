#!/bin/bash
# run-single.sh — Run a single ZS test: one model × one task
#
# Usage: ./tests/run-single.sh <model-id> <model-dir> <task-num> <task-file>
#
# Examples:
#   ./tests/run-single.sh claude-opus-4-6 opus-4.6 01-simple 01-simple.zobr
#   ./tests/run-single.sh claude-sonnet-4-6 sonnet-4.6 05-reflection 05-reflection-task.md
#
# Must be run from the zobr-script root directory.

set -euo pipefail

MODEL_ID="$1"       # e.g. claude-opus-4-6
MODEL_DIR="$2"       # e.g. opus-4.6
TASK_NUM="$3"        # e.g. 01-simple, 05-reflection
TASK_FILE="$4"       # e.g. 01-simple.zobr, 05-reflection-task.md

RESULTS_DIR="tests/results/${MODEL_DIR}/${TASK_NUM}"
mkdir -p "$RESULTS_DIR"

# Windows absolute paths for model's Read/Write tools
RESULTS_WIN="$(cygpath -w "$(pwd)/tests/results/${MODEL_DIR}/${TASK_NUM}")"

echo "=== ${MODEL_DIR} / ${TASK_NUM} ==="
echo "    Model:   ${MODEL_ID}"
echo "    Output:  ${RESULTS_DIR}/"

# --- Build prompt and tool set based on task type ---

if [ "$TASK_NUM" = "05-reflection" ]; then
  # Task 05: free analysis + ZS script generation + validation
  TOOLS="Read,Write,Bash,WebSearch,WebFetch"

  PROMPT="$(cat <<PROMPT_EOF
You are participating in a formal evaluation of ZS (Zobr Script), a cognitive scripting language.

STEP 1 — Learn the language:
- Read the file docs/spec.md (ZS language specification)
- Read the file docs/system-prompt.md (interpreter instructions)
- Read a few examples from tests/tasks/ directory (.zobr files) to understand the format

STEP 2 — Read your task:
- Read the file tests/tasks/${TASK_FILE}

STEP 3 — Execute the task:
- Search the web for current information
- Perform deep analysis
- Save your complete analysis to: ${RESULTS_WIN}\\result.md

STEP 4 — Export your reasoning as ZS:
- Create a REUSABLE .zobr script that captures the cognitive pattern you used
- The script should be generalizable — not about AI regulation specifically, but about analyzing any emerging technology policy debate
- Use proper ZS syntax: task, input, operations (survey, ground, assert, doubt, contrast, synthesize, reframe, assess, conclude), control flow (for, if, loop)
- Save it to: ${RESULTS_WIN}\\reflection.zobr

STEP 5 — Validate:
- Run: node dist/cli.js "${RESULTS_WIN}\\reflection.zobr"
- If there are errors, fix the .zobr file and re-run until clean
- Save the final validation output to: ${RESULTS_WIN}\\validation.txt

Important:
- Work in the current directory (do not cd elsewhere)
- Be thorough in your analysis — this is a benchmark
- The .zobr script must be syntactically valid and pass zobr-check
PROMPT_EOF
)"

elif [ "$TASK_NUM" = "04-news-analysis" ]; then
  # Task 04: needs web access for news_text input
  TOOLS="Read,Write,WebSearch,WebFetch"

  PROMPT="$(cat <<PROMPT_EOF
You are a ZS (Zobr Script) interpreter participating in a formal language evaluation.

STEP 1 — Learn the language:
- Read the file docs/spec.md (ZS language specification)
- Read the file docs/system-prompt.md (how to interpret ZS scripts)

STEP 2 — Obtain input data:
- The script requires input: news_text
- Search the web for a current, substantive political news article (2025-2026)
- Fetch the full article text — this becomes your news_text input

STEP 3 — Read and execute the script:
- Read the file tests/tasks/${TASK_FILE}
- Interpret and execute it step by step, following the system prompt instructions exactly
- Show each operation with its tag: [survey], [ground], [doubt], etc.
- Track all variables
- Follow all control flow (for loops, if/else, etc.)
- End with the conclude block formatted exactly as specified

STEP 4 — Save your result:
- Write your complete execution trace and final result to: ${RESULTS_WIN}\\result.md
- Include the source article URL at the top

Important:
- Work in the current directory
- Be thorough — this is a formal benchmark comparing models
- Follow the ZS specification precisely
PROMPT_EOF
)"

else
  # Tasks 01-03: pure interpretation, no web needed
  TOOLS="Read,Write"

  PROMPT="$(cat <<PROMPT_EOF
You are a ZS (Zobr Script) interpreter participating in a formal language evaluation.

STEP 1 — Learn the language:
- Read the file docs/spec.md (ZS language specification)
- Read the file docs/system-prompt.md (how to interpret ZS scripts)

STEP 2 — Read and execute the script:
- Read the file tests/tasks/${TASK_FILE}
- Interpret and execute it step by step, following the system prompt instructions exactly
- Show each operation with its tag: [survey], [ground], [doubt], etc.
- Track all variables
- Follow all control flow (for loops, if/else, etc.)
- End with the conclude block formatted exactly as specified

STEP 3 — Save your result:
- Write your complete execution trace and final result to: ${RESULTS_WIN}\\result.md

Important:
- Work in the current directory
- Be thorough — this is a formal benchmark comparing models
- Follow the ZS specification precisely
PROMPT_EOF
)"
fi

# --- Run ---

START_TIME=$(date '+%H:%M:%S')
START_EPOCH=$(date +%s)
echo "    Started: ${START_TIME}"

claude -p "$PROMPT" \
  --model "$MODEL_ID" \
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

# Convert inference to readable markdown
node tests/jsonl-to-md.js "${RESULTS_DIR}/inference.jsonl" "${RESULTS_DIR}/inference.md" 2>/dev/null

# Save metrics
cat > "${RESULTS_DIR}/metrics.json" <<METRICS_EOF
{
  "model": "${MODEL_ID}",
  "model_dir": "${MODEL_DIR}",
  "task": "${TASK_NUM}",
  "start": "${START_TIME}",
  "end": "${END_TIME}",
  "duration_seconds": ${DURATION},
  "exit_code": ${EXIT_CODE}
}
METRICS_EOF

echo ""
exit $EXIT_CODE

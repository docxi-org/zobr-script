#!/bin/bash
# run-catch-moose.sh — Execute catch-moose.zobr with Claude Opus
# Usage: ./examples/run-catch-moose.sh
# Must be run from the zobr-script root directory.

set -euo pipefail

RESULTS_DIR="examples/results"
mkdir -p "$RESULTS_DIR"
RESULTS_WIN="$(cygpath -w "$(pwd)/$RESULTS_DIR")"

PROMPT="$(cat <<'PROMPT_EOF'
You are a ZS (Zobr Script) interpreter.

STEP 1 — Learn the language:
- Read the file docs/spec.md (ZS language specification)
- Read the file docs/system-prompt.md (how to interpret ZS scripts)

STEP 2 — Read and execute the script:
- Read the file examples/catch-moose.zobr
- The input parameter forest_type = "смешанный лес средней полосы России, конец октября"
- Interpret and execute it step by step, following the system prompt instructions exactly
- Show each operation with its tag: [survey], [ground], [doubt], etc.
- Track all variables
- Follow all control flow (for loops, if/else, etc.)
- End with the conclude block formatted exactly as specified
- Have fun with it — this is a humorous scenario, but execute the cognitive operations seriously

STEP 3 — Save your result:
- Write your complete execution trace and final result to: RESULTS_WIN\catch-moose-result.md

Important:
- Work in the current directory
- Follow the ZS specification precisely
- Write the result in Russian
PROMPT_EOF
)"

PROMPT="${PROMPT//RESULTS_WIN/$RESULTS_WIN}"

echo "=== Running catch-moose.zobr with Opus ==="
START_TIME=$(date '+%H:%M:%S')
echo "    Started: ${START_TIME}"

claude -p "$PROMPT" \
  --model claude-opus-4-6 \
  --dangerously-skip-permissions \
  --max-turns 50 \
  --effort high \
  --verbose \
  --output-format stream-json \
  --setting-sources user \
  --mcp-config '{"mcpServers":{}}' \
  --strict-mcp-config \
  > "${RESULTS_DIR}/catch-moose-inference.jsonl" 2>&1

EXIT_CODE=$?
END_TIME=$(date '+%H:%M:%S')
echo "    Finished: ${END_TIME} (exit: ${EXIT_CODE})"

# Convert to readable markdown
node tests/jsonl-to-md.js "${RESULTS_DIR}/catch-moose-inference.jsonl" "${RESULTS_DIR}/catch-moose-inference.md" 2>/dev/null

echo "    Result:  ${RESULTS_DIR}/catch-moose-result.md"
echo "    Trace:   ${RESULTS_DIR}/catch-moose-inference.md"

#!/bin/bash
# run-fun.sh — Run all 3 Trump pattern scripts with absurd historical inputs
# Must be run from the zobr-script root directory.

set -euo pipefail

DIR="examples/trump-patterns"
RESULTS="$DIR/fun-results"
mkdir -p "$RESULTS"
RESULTS_WIN="$(cygpath -w "$(pwd)/$RESULTS")"

MODEL="claude-sonnet-4-6"

run_pattern() {
  local NUM="$1"
  local INPUT="$2"
  local LABEL="$3"

  local SCRIPT="$DIR/pattern-${NUM}.zobr"
  local OUTFILE="${RESULTS}/${LABEL}-result.md"
  local LOGFILE="${RESULTS}/${LABEL}-inference.jsonl"
  local OUTFILE_WIN="${RESULTS_WIN}\\${LABEL}-result.md"

  PROMPT="$(cat <<PROMPT_EOF
You are a ZS (Zobr Script) interpreter.

STEP 1 — Learn the language:
- Read the file docs/spec.md (ZS language specification)
- Read the file docs/system-prompt.md (how to interpret ZS scripts)

STEP 2 — Read and execute the script:
- Read the file ${SCRIPT}
- The input parameter is: ${INPUT}
- Interpret and execute it step by step, following the system prompt instructions exactly
- Show each operation with its tag: [survey], [ground], [doubt], etc.
- Track all variables
- Follow all control flow (for loops, if/else, etc.)
- End with the conclude block formatted exactly as specified
- This is a humorous/satirical exercise — commit to the absurdity fully, but execute ZS operations with precision

STEP 3 — Save your result:
- Write your complete execution trace and final result to: ${OUTFILE_WIN}

Important:
- Work in the current directory
- Follow the ZS specification precisely
- Write everything in English, in Trump's voice
- The full_post field must be a complete, ready-to-publish social media post
PROMPT_EOF
)"

  echo "=== Pattern ${NUM}: ${LABEL} ==="
  local START_TIME=$(date '+%H:%M:%S')
  echo "    Started: ${START_TIME}"

  claude -p "$PROMPT" \
    --model "$MODEL" \
    --dangerously-skip-permissions \
    --max-turns 50 \
    --effort high \
    --verbose \
    --output-format stream-json \
    --setting-sources user \
    --mcp-config '{"mcpServers":{}}' \
    --strict-mcp-config \
    > "$LOGFILE" 2>&1

  local EXIT_CODE=$?
  local END_TIME=$(date '+%H:%M:%S')
  echo "    Finished: ${END_TIME} (exit: ${EXIT_CODE})"
  echo ""
}

# Pattern 1: Victory Declaration — Conquest of Atlantis
run_pattern 1 \
  'event = "The United States Navy, under the direct command of President Trump, has discovered and conquered the lost city of Atlantis in the mid-Atlantic. The underwater civilization, which had been hiding advanced technology and vast gold reserves for 12,000 years, surrendered unconditionally after a 3-hour naval operation. President Trump has declared Atlantis the 51st state."' \
  "atlantis-victory"

# Pattern 2: Endorsement — Count Dracula for Secretary of Health
run_pattern 2 \
  'candidate = "Count Dracula, legendary Transylvanian nobleman, 600+ years of experience in blood-related medicine and nighttime healthcare. Running for U.S. Secretary of Health and Human Services. Opponent is Dr. Van Helsing, a radical left activist who wants to ban all alternative medicine and stake-based therapies. Dracula represents the great state of Pennsylvania (Transylvania County), where Trump won big. Dracula has been a loyal MAGA supporter since 1462."' \
  "dracula-endorsement"

# Pattern 3: Enemy Degradation — Prince Hamlet of Denmark
run_pattern 3 \
  'target = "Prince Hamlet of Denmark, who gave a long, boring speech criticizing Trump'\''s foreign policy on Danish television. Hamlet called Trump '\''indecisive'\'' (ironic, coming from him). He is the Prince of a country that refused to sell Greenland. He spends all his time talking to skulls instead of making deals. His uncle Claudius is a better leader. Failed to act on clear intelligence about his father'\''s murder for 5 acts. His girlfriend drowned because of his terrible leadership. Denmark'\''s worst prince, possibly ever."' \
  "hamlet-attack"

echo "=== All done ==="
echo "Results in: ${RESULTS}/"

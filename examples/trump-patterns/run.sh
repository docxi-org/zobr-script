#!/bin/bash
# run.sh — Analyze Trump's Truth Social posts and generate ZS pattern scripts
# Must be run from the zobr-script root directory.

set -euo pipefail

DIR="examples/trump-patterns"
DIR_WIN="$(cygpath -w "$(pwd)/$DIR")"

PROMPT="$(cat <<'PROMPT_EOF'
You are analyzing Donald Trump's Truth Social posts to extract cognitive patterns for ZS (Zobr Script).

STEP 1 — Learn ZS:
- Read docs/spec.md (language specification)
- Read docs/system-prompt.md (interpreter instructions)
- Read examples/catch-moose/catch-moose.zobr (example script)

STEP 2 — Read the posts:
- Read the file DIRWIN\data\last100.json — these are Trump's last 100 posts from Truth Social (JSON: date, content, url, reblogs, favourites)

STEP 3 — Analyze and identify exactly 3 distinct patterns:
Study the 100 posts carefully. Identify 3 fundamentally different COGNITIVE PATTERNS in how Trump constructs his posts. Not topics — patterns of reasoning and rhetoric.

For each pattern:
- Give it a short, descriptive name
- Describe: what triggers it (input event type), what cognitive steps happen, what the output looks like
- Show 3-5 real post examples that match this pattern
- Note the rhetorical devices used

STEP 4 — Write the analysis:
- Save your full analysis to: DIRWIN\analysis.md

STEP 5 — For each of the 3 patterns, create a ZS script:
- Each script takes an event/situation as input
- Uses ZS operations (survey, assert, doubt, contrast, reframe, synthesize, conclude, etc.) to model Trump's cognitive pattern
- The conclude block should output a post in Trump's style
- Save as: DIRWIN\pattern-1.zobr, DIRWIN\pattern-2.zobr, DIRWIN\pattern-3.zobr

STEP 6 — Validate all scripts:
- Run: node dist/cli.js DIRWIN\pattern-1.zobr
- Run: node dist/cli.js DIRWIN\pattern-2.zobr
- Run: node dist/cli.js DIRWIN\pattern-3.zobr
- If errors, fix and re-validate until all pass
- Save validation output to: DIRWIN\validation.txt

Important:
- Work in the current directory
- Write analysis and scripts in English
- Be precise about the cognitive structure, not just surface features
- The ZS scripts should be genuinely useful — someone should be able to feed them any event and get a Trump-style post
PROMPT_EOF
)"

PROMPT="${PROMPT//DIRWIN/$DIR_WIN}"

echo "=== Analyzing Trump posts with Sonnet ==="
START_TIME=$(date '+%H:%M:%S')
echo "    Started: ${START_TIME}"

claude -p "$PROMPT" \
  --model claude-sonnet-4-6 \
  --dangerously-skip-permissions \
  --max-turns 50 \
  --effort high \
  --verbose \
  --output-format stream-json \
  --setting-sources user \
  --mcp-config '{"mcpServers":{}}' \
  --strict-mcp-config \
  > "${DIR}/inference.jsonl" 2>&1

EXIT_CODE=$?
END_TIME=$(date '+%H:%M:%S')
echo "    Finished: ${END_TIME} (exit: ${EXIT_CODE})"

node tests/jsonl-to-md.js "${DIR}/inference.jsonl" "${DIR}/inference.md" 2>/dev/null

echo "    Analysis: ${DIR}/analysis.md"
echo "    Scripts:  ${DIR}/pattern-*.zobr"

#!/bin/bash
# run-all.sh — Run the full ZS benchmark: 3 models × 5 tasks = 15 runs
#
# Usage: ./tests/run-all.sh [--model <model-dir>] [--task <task-num>]
#
# Examples:
#   ./tests/run-all.sh                          # all models, all tasks
#   ./tests/run-all.sh --model opus-4.6         # one model, all tasks
#   ./tests/run-all.sh --task 01-simple         # all models, one task
#   ./tests/run-all.sh --model haiku-4.5 --task 05-reflection
#
# Must be run from the zobr-script root directory.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

# --- Parse arguments ---
FILTER_MODEL=""
FILTER_TASK=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --model) FILTER_MODEL="$2"; shift 2 ;;
    --task)  FILTER_TASK="$2";  shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# --- Model definitions ---
declare -A MODELS
MODELS[opus-4.6]="claude-opus-4-6"
MODELS[sonnet-4.6]="claude-sonnet-4-6"
MODELS[haiku-4.5]="claude-haiku-4-5-20251001"

# --- Task definitions ---
# Format: task-num:task-file
TASKS=(
  "01-simple:01-simple.zobr"
  "02-dialectical:02-dialectical.zobr"
  "03-custom-functions:03-custom-functions.zobr"
  "04-news-analysis:04-news-analysis.zobr"
  "05-reflection:05-reflection-task.md"
)

# --- Run ---
TOTAL=0
FAILED=0

echo "========================================"
echo " ZS (Zobr Script) Formal Benchmark"
echo " Date: $(date '+%Y-%m-%d %H:%M')"
echo "========================================"
echo ""

for MODEL_DIR in opus-4.6 sonnet-4.6 haiku-4.5; do
  # Apply model filter
  if [ -n "$FILTER_MODEL" ] && [ "$FILTER_MODEL" != "$MODEL_DIR" ]; then
    continue
  fi

  MODEL_ID="${MODELS[$MODEL_DIR]}"
  echo "━━━ Model: ${MODEL_DIR} (${MODEL_ID}) ━━━"
  echo ""

  for TASK_ENTRY in "${TASKS[@]}"; do
    TASK_NUM="${TASK_ENTRY%%:*}"
    TASK_FILE="${TASK_ENTRY#*:}"

    # Apply task filter
    if [ -n "$FILTER_TASK" ] && [ "$FILTER_TASK" != "$TASK_NUM" ]; then
      continue
    fi

    TOTAL=$((TOTAL + 1))

    if bash tests/run-single.sh "$MODEL_ID" "$MODEL_DIR" "$TASK_NUM" "$TASK_FILE"; then
      echo "    ✓ OK"
    else
      echo "    ✗ FAILED (exit code $?)"
      FAILED=$((FAILED + 1))
    fi
  done

  echo ""
done

echo "========================================"
echo " Done: ${TOTAL} runs, ${FAILED} failed"
echo " Results in: tests/results/"
echo "========================================"

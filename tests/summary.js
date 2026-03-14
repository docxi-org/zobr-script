#!/usr/bin/env node
// summary.js — Generate benchmark summary from metrics and inference files
//
// Usage: node tests/summary.js
//
// Reads tests/results/*/*/metrics.json and inference.jsonl files,
// produces a markdown summary table.

const fs = require('fs');
const path = require('path');

const RESULTS_DIR = path.join(__dirname, 'results');

const MODELS = ['opus-4.6', 'sonnet-4.6', 'haiku-4.5'];
const TASKS = ['01-simple', '02-dialectical', '03-custom-functions', '04-news-analysis', '05-reflection'];

function parseInferenceStats(jsonlPath) {
  if (!fs.existsSync(jsonlPath)) return null;

  const lines = fs.readFileSync(jsonlPath, 'utf-8').split('\n').filter(l => l.trim());
  let turns = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let cacheReadTokens = 0;
  let cacheCreateTokens = 0;
  let duration = null;
  let cost = null;

  // Track per-message to avoid double-counting snapshots of same message
  const seenMessageIds = new Set();
  const messageOutputTokens = new Map(); // msgId -> max output_tokens seen

  for (const line of lines) {
    let event;
    try { event = JSON.parse(line); } catch { continue; }

    if (event.type === 'assistant' && event.message?.content) {
      const msgId = event.message.id;
      const hasText = event.message.content.some(b => b.type === 'text');
      if (hasText && !seenMessageIds.has(msgId + ':text')) {
        turns++;
        seenMessageIds.add(msgId + ':text');
      }

      const usage = event.message?.usage;
      if (usage) {
        totalInputTokens = Math.max(totalInputTokens,
          (usage.input_tokens || 0) +
          (usage.cache_creation_input_tokens || 0) +
          (usage.cache_read_input_tokens || 0)
        );
        // Take max output_tokens per message (snapshots report running total)
        const prev = messageOutputTokens.get(msgId) || 0;
        messageOutputTokens.set(msgId, Math.max(prev, usage.output_tokens || 0));
        cacheReadTokens = Math.max(cacheReadTokens, usage.cache_read_input_tokens || 0);
        cacheCreateTokens = Math.max(cacheCreateTokens, usage.cache_creation_input_tokens || 0);
      }
    }

    if (event.type === 'result' && event.subtype === 'success') {
      if (event.duration_ms) duration = event.duration_ms;
      if (event.cost_usd) cost = event.cost_usd;
    }
  }

  // Sum max output tokens across all messages
  for (const v of messageOutputTokens.values()) {
    totalOutputTokens += v;
  }

  return { turns, totalInputTokens, totalOutputTokens, cacheReadTokens, cacheCreateTokens, duration, cost };
}

// --- Collect data ---
const rows = [];

for (const model of MODELS) {
  for (const task of TASKS) {
    const dir = path.join(RESULTS_DIR, model, task);
    const metricsPath = path.join(dir, 'metrics.json');
    const jsonlPath = path.join(dir, 'inference.jsonl');
    const resultPath = path.join(dir, 'result.md');

    let metrics = null;
    if (fs.existsSync(metricsPath)) {
      metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf-8'));
    }

    const inferenceStats = parseInferenceStats(jsonlPath);
    const resultSize = fs.existsSync(resultPath) ? fs.statSync(resultPath).size : 0;

    rows.push({
      model,
      task,
      duration: metrics?.duration_seconds || null,
      exit: metrics?.exit_code ?? null,
      turns: inferenceStats?.turns || null,
      inputTokens: inferenceStats?.totalInputTokens || null,
      outputTokens: inferenceStats?.totalOutputTokens || null,
      cost: inferenceStats?.cost || null,
      resultKB: resultSize ? (resultSize / 1024).toFixed(1) : '-',
    });
  }
}

// --- Output ---
const out = [];
out.push('# ZS Benchmark Summary');
out.push('');
out.push(`**Date:** ${new Date().toISOString().split('T')[0]}`);
out.push('');

// Table
out.push('| Model | Task | Duration | Turns | Input Tokens | Output Tokens | Cost | Result | Exit |');
out.push('|-------|------|----------|-------|-------------|---------------|------|--------|------|');

for (const r of rows) {
  const dur = r.duration != null ? `${r.duration}s` : '-';
  const turns = r.turns ?? '-';
  const inp = r.inputTokens ? `~${(r.inputTokens / 1000).toFixed(1)}K` : '-';
  const outp = r.outputTokens ? `~${(r.outputTokens / 1000).toFixed(1)}K` : '-';
  const cost = r.cost != null ? `$${r.cost.toFixed(4)}` : '-';
  const exit = r.exit != null ? (r.exit === 0 ? 'OK' : `ERR(${r.exit})`) : '-';

  out.push(`| ${r.model} | ${r.task} | ${dur} | ${turns} | ${inp} | ${outp} | ${cost} | ${r.resultKB}KB | ${exit} |`);
}

// Model totals
out.push('');
out.push('## Per-Model Totals');
out.push('');
out.push('| Model | Total Duration | Total Output Tokens | Avg Duration/Task |');
out.push('|-------|---------------|--------------------|--------------------|');

for (const model of MODELS) {
  const modelRows = rows.filter(r => r.model === model && r.duration != null);
  const totalDur = modelRows.reduce((s, r) => s + (r.duration || 0), 0);
  const totalOut = modelRows.reduce((s, r) => s + (r.outputTokens || 0), 0);
  const avg = modelRows.length > 0 ? (totalDur / modelRows.length).toFixed(0) : '-';

  out.push(`| ${model} | ${totalDur}s (${(totalDur / 60).toFixed(1)}m) | ~${(totalOut / 1000).toFixed(1)}K | ${avg}s |`);
}

const summaryPath = path.join(RESULTS_DIR, 'summary.md');
fs.writeFileSync(summaryPath, out.join('\n'), 'utf-8');
console.log(`✓ ${summaryPath}`);

// Also print to stdout
console.log('');
console.log(out.join('\n'));

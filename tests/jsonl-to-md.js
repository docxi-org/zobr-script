#!/usr/bin/env node
// jsonl-to-md.js — Convert Claude Code stream-json inference log to readable markdown
//
// Usage: node tests/jsonl-to-md.js <inference.jsonl> [output.md]
//        node tests/jsonl-to-md.js tests/results/haiku-4.5/01-simple/inference.jsonl
//
// If output.md is omitted, writes to inference.md next to the input file.

const fs = require('fs');
const path = require('path');

const inputPath = process.argv[2];
if (!inputPath) {
  console.log('Usage: node tests/jsonl-to-md.js <inference.jsonl> [output.md]');
  process.exit(0);
}

const outputPath = process.argv[3] || inputPath.replace(/\.jsonl$/, '.md');

const lines = fs.readFileSync(inputPath, 'utf-8').split('\n').filter(l => l.trim());

const out = [];
let turnNum = 0;
let totalInputTokens = 0;
let totalOutputTokens = 0;

for (const line of lines) {
  let event;
  try {
    event = JSON.parse(line);
  } catch {
    continue; // skip non-json lines (stderr leaks)
  }

  if (event.type === 'system' && event.subtype === 'init') {
    out.push(`# Inference Transcript`);
    out.push('');
    out.push(`- **Model:** ${event.model}`);
    out.push(`- **Session:** ${event.session_id}`);
    out.push(`- **CWD:** ${event.cwd}`);
    out.push(`- **Tools:** ${event.tools?.length || 0} available`);
    out.push('');
    out.push('---');
    out.push('');
    continue;
  }

  if (event.type === 'assistant' && event.message?.content) {
    const content = event.message.content;

    for (const block of content) {
      if (block.type === 'thinking') {
        out.push(`<details><summary>💭 Thinking</summary>`);
        out.push('');
        out.push(block.thinking);
        out.push('');
        out.push('</details>');
        out.push('');
      }

      if (block.type === 'text') {
        turnNum++;
        out.push(`### 🤖 Assistant (turn ${turnNum})`);
        out.push('');
        out.push(block.text);
        out.push('');
      }

      if (block.type === 'tool_use') {
        const toolName = block.name;
        const input = block.input || {};

        out.push(`#### 🔧 ${toolName}`);
        out.push('');

        if (toolName === 'Read') {
          out.push(`📄 Read: \`${input.file_path}\``);
        } else if (toolName === 'Write') {
          out.push(`📝 Write: \`${input.file_path}\``);
          if (input.content) {
            const preview = input.content.length > 500
              ? input.content.slice(0, 500) + '\n...[truncated]'
              : input.content;
            out.push('');
            out.push('```');
            out.push(preview);
            out.push('```');
          }
        } else if (toolName === 'Bash') {
          out.push(`\`\`\`bash`);
          out.push(input.command || '');
          out.push('```');
        } else if (toolName === 'WebSearch') {
          out.push(`🔍 Search: "${input.query}"`);
        } else if (toolName === 'WebFetch') {
          out.push(`🌐 Fetch: ${input.url}`);
        } else if (toolName === 'Edit') {
          out.push(`✏️ Edit: \`${input.file_path}\``);
          if (input.old_string) {
            out.push('');
            out.push('```diff');
            out.push('- ' + input.old_string.split('\n').join('\n- '));
            out.push('+ ' + (input.new_string || '').split('\n').join('\n+ '));
            out.push('```');
          }
        } else {
          // Generic tool
          const inputStr = JSON.stringify(input, null, 2);
          if (inputStr.length > 300) {
            out.push('```json');
            out.push(inputStr.slice(0, 300) + '\n...[truncated]');
            out.push('```');
          } else {
            out.push('```json');
            out.push(inputStr);
            out.push('```');
          }
        }
        out.push('');
      }
    }

    // Track tokens
    const usage = event.message?.usage;
    if (usage) {
      const inp = (usage.input_tokens || 0)
        + (usage.cache_creation_input_tokens || 0)
        + (usage.cache_read_input_tokens || 0);
      totalInputTokens = Math.max(totalInputTokens, inp);
      totalOutputTokens += (usage.output_tokens || 0);
    }
  }

  if (event.type === 'user' && event.message?.content) {
    for (const block of event.message.content) {
      if (block.type === 'tool_result') {
        const result = typeof block.content === 'string' ? block.content : JSON.stringify(block.content);
        const preview = result.length > 1000
          ? result.slice(0, 1000) + '\n...[truncated]'
          : result;
        out.push('<details><summary>📋 Tool Result</summary>');
        out.push('');
        out.push('```');
        out.push(preview);
        out.push('```');
        out.push('');
        out.push('</details>');
        out.push('');
      }
    }
  }

  if (event.type === 'result' && event.subtype === 'success') {
    out.push('---');
    out.push('');
    out.push('## Summary');
    out.push('');
    out.push(`- **Turns:** ${turnNum}`);
    out.push(`- **Input tokens:** ~${totalInputTokens.toLocaleString()}`);
    out.push(`- **Output tokens:** ~${totalOutputTokens.toLocaleString()}`);
    if (event.cost_usd !== undefined) {
      out.push(`- **Cost:** $${event.cost_usd}`);
    }
    if (event.duration_ms !== undefined) {
      out.push(`- **Duration:** ${(event.duration_ms / 1000).toFixed(1)}s`);
    }
    out.push('');
  }
}

fs.writeFileSync(outputPath, out.join('\n'), 'utf-8');
console.log(`✓ ${outputPath} (${out.length} lines)`);

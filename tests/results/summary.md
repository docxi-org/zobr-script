# ZS Benchmark Summary

**Date:** 2026-03-14

| Model | Task | Duration | Turns | Input Tokens | Output Tokens | Cost | Result | Exit |
|-------|------|----------|-------|-------------|---------------|------|--------|------|
| opus-4.6 | 01-simple | 108s | 4 | ~26.6K | ~0.0K | - | 15.1KB | OK |
| opus-4.6 | 02-dialectical | 155s | 4 | ~28.7K | ~0.0K | - | 24.2KB | OK |
| opus-4.6 | 03-custom-functions | 137s | 2 | ~28.0K | ~0.0K | - | 17.2KB | OK |
| opus-4.6 | 04-news-analysis | 208s | 5 | ~33.2K | ~0.1K | - | 26.0KB | OK |
| opus-4.6 | 05-reflection | 338s | 12 | ~60.9K | ~0.2K | - | 14.0KB | OK |
| sonnet-4.6 | 01-simple | 132s | 3 | ~28.1K | ~0.1K | - | 14.1KB | OK |
| sonnet-4.6 | 02-dialectical | 205s | 4 | ~31.2K | ~0.0K | - | 22.7KB | OK |
| sonnet-4.6 | 03-custom-functions | 255s | 2 | ~34.6K | ~0.0K | - | 14.6KB | OK |
| sonnet-4.6 | 04-news-analysis | 355s | 3 | ~36.0K | ~0.1K | - | 37.9KB | OK |
| sonnet-4.6 | 05-reflection | 418s | 7 | ~60.0K | ~0.2K | - | 14.0KB | OK |
| haiku-4.5 | 01-simple | 59s | 4 | ~37.1K | ~0.0K | - | 8.5KB | OK |
| haiku-4.5 | 02-dialectical | 67s | 3 | ~39.7K | ~0.0K | - | 15.3KB | OK |
| haiku-4.5 | 03-custom-functions | 81s | 3 | ~40.3K | ~0.0K | - | 17.0KB | OK |
| haiku-4.5 | 04-news-analysis | 201s | 5 | ~48.4K | ~0.0K | - | 37.0KB | OK |
| haiku-4.5 | 05-reflection | 140s | 12 | ~49.0K | ~0.0K | - | 18.3KB | OK |

## Per-Model Totals

| Model | Total Duration | Total Output Tokens | Avg Duration/Task |
|-------|---------------|--------------------|--------------------|
| opus-4.6 | 946s (15.8m) | ~0.4K | 189s |
| sonnet-4.6 | 1365s (22.8m) | ~0.4K | 273s |
| haiku-4.5 | 548s (9.1m) | ~0.1K | 110s |
@echo off
cd /d "%~dp0"
pnpm --filter @zobr/web dev

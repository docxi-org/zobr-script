@echo off
cd /d "%~dp0\ui"
echo Serving prototype at http://localhost:1981
npx -y serve -l 1981 .

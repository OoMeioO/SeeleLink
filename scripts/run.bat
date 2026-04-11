@echo off
setlocal
set ELECTRON_RUN_AS_NODE=
cd /d "%~dp0"
call npm run build
node_modules\electron\dist\electron.exe .

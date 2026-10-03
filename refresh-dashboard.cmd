@echo off
REM Regenerate the cost dashboard. Called by the hourly scheduled task.
REM
REM The node path is written in at task-creation time rather than relying on PATH, because a
REM scheduled task does not necessarily inherit the shell environment that has node on it.
setlocal
set NODE_EXE=C:\Program Files\nodejs\node.exe
set REPO=%~dp0

"%NODE_EXE%" "%REPO%session-cost.mjs" --html > "%REPO%cost-dashboard.log" 2>&1
exit /b %ERRORLEVEL%

@echo off
REM Restart script for BambiSleep.chat server
REM Called by monitor.js when server appears to be down

echo %date% %time% - Restarting BambiSleep server due to monitor detection >> restart.log

REM Kill any existing node processes running the server
taskkill /F /IM node.exe

REM Wait for processes to fully terminate
timeout /t 5 /nobreak

REM Start server with memory safety options
start cmd /c run-memory-safe.bat

echo %date% %time% - Restart command completed >> restart.log

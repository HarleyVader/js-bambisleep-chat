@echo off
REM Run BambiSleep.chat server with memory monitoring and garbage collection enabled

REM Enable Node.js garbage collection
set NODE_OPTIONS=--expose-gc --max-old-space-size=1536

REM Set memory monitoring flags
set MEMORY_MONITOR_ENABLED=true
set MEMORY_MONITOR_INTERVAL=60000
set MEMORY_CRITICAL_THRESHOLD=90
set MEMORY_WARNING_THRESHOLD=75

REM Set aggressive session cleanup
set MAX_SESSIONS=150
set SESSION_IDLE_TIMEOUT=900000

echo Starting BambiSleep.chat server with memory monitoring...
echo Max memory: 1.5GB
echo Memory monitor interval: %MEMORY_MONITOR_INTERVAL%ms
echo Memory critical threshold: %MEMORY_CRITICAL_THRESHOLD%%%
echo Memory warning threshold: %MEMORY_WARNING_THRESHOLD%%%
echo Max sessions: %MAX_SESSIONS%
echo Session idle timeout: %SESSION_IDLE_TIMEOUT%ms (15 minutes)

REM Run the server
cd src
node --expose-gc --max-old-space-size=1536 server.js

REM If we get here, the server has exited
echo Server exited.
pause

# Memory Management in BambiSleep Chat

## Issue: OOM Kill During Overnight Operation

The application was experiencing "KILLED" messages in the terminal when running overnight. This is a signal that the operating system's Out-of-Memory (OOM) killer terminated the process because it was consuming too much memory.

## Root Causes

1. **Memory Growth Without Limits**: The application had no hard upper limits on memory usage, allowing it to grow until the system killed it.

2. **Insufficient Garbage Collection**: While garbage collection was implemented, it wasn't aggressive enough during overnight operation.

3. **Session Accumulation**: Session data would build up over time, particularly during extended operation.

4. **Lack of Memory Pressure Monitoring**: The system wasn't monitoring or responding to memory pressure signals.

## Solutions Implemented

### 1. Memory Monitoring System

We've added a comprehensive memory monitoring system in `src/utils/memory-monitor.js` that:

- Monitors memory usage at regular intervals
- Takes progressive actions based on memory pressure
- Detects memory leaks through trend analysis
- Forces garbage collection when memory usage exceeds thresholds

### 2. Memory-Safe Launch Script

The new `run-memory-safe.bat` script:

- Enables V8 garbage collection with `--expose-gc`
- Sets a hard memory limit of 1.5GB with `--max-old-space-size=1536`
- Configures memory thresholds through environment variables
- Enables more aggressive session timeout management

### 3. Improved Worker Garbage Collection

The LMStudio worker now:

- Monitors its own memory usage
- Takes more aggressive action when memory pressure is high
- Implements shortened timeouts under memory pressure
- Prioritizes database synchronization before memory cleanup

### 4. Session Management Improvements

- Session idle timeout is more aggressive under memory pressure
- High message count sessions are prioritized for cleanup
- Database sync happens before session removal to prevent data loss

## How to Use

1. **For Regular Use**: Use the standard `run-server.bat` script.

2. **For Memory-Sensitive Environments**: Use `run-memory-safe.bat` which enables all memory protection features.

3. **For Custom Memory Settings**: Edit the environment variables in `run-memory-safe.bat` to adjust:
   - `MEMORY_MONITOR_ENABLED`: Set to "true" to enable memory monitoring
   - `MEMORY_MONITOR_INTERVAL`: Interval in milliseconds between memory checks
   - `MEMORY_CRITICAL_THRESHOLD`: Percentage at which emergency actions are taken
   - `MEMORY_WARNING_THRESHOLD`: Percentage at which preventive actions begin
   - `MAX_SESSIONS`: Maximum number of concurrent sessions allowed
   - `SESSION_IDLE_TIMEOUT`: Time in milliseconds before a session is considered idle

## Monitoring Memory Usage

You can monitor memory usage in the logs:

1. Regular updates will show memory usage statistics
2. Warning messages will appear when memory usage exceeds the warning threshold
3. Critical messages will appear when emergency actions are taken

If you still see "KILLED" messages, you may need to adjust your memory thresholds lower or increase your system's available memory.
import { EventEmitter } from 'events';

// Create a singleton event bus
const eventBus = new EventEmitter();

// Set higher max listeners to avoid warning messages
eventBus.setMaxListeners(20);

// Optional: Add debug logging in development
if (process.env.NODE_ENV !== 'production') {
  const originalEmit = eventBus.emit;
  eventBus.emit = function(type, ...args) {
    console.log(`[EventBus] Event '${type}' emitted`, args[0] ? `with data: ${JSON.stringify(args[0]).substring(0, 100)}` : '');
    return originalEmit.apply(this, [type, ...args]);
  };
}

export default eventBus;
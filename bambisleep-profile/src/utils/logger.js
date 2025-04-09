import colors from 'colors';

// Configure colors
colors.setTheme({
  info: 'cyan',
  success: 'green',
  warning: 'yellow',
  error: 'red'
});

const logger = {
  info: (message) => console.log(`INFO: ${message}`),
  success: (message) => console.log(`SUCCESS: ${message}`),
  warning: (message) => console.log(`WARNING: ${message}`),
  error: (message) => console.error(`ERROR: ${message}`)
};

export default logger;
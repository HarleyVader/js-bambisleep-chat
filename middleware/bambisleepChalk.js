const chalk = require('chalk');

const colors = {
  primary: chalk.hex('#0c2a2ac9'),
  primaryAlt: chalk.hex('#15aab5ec'),
  secondary: chalk.hex('#40002f'),
  secondaryAlt: chalk.hex('#005d46'),
  tertiary: chalk.hex('#cc0174'),
  tertiaryAlt: chalk.hex('#01c69eae'),
  button: chalk.hex('#df0471'),
  buttonAlt: chalk.hex('#110000'),
  nav: chalk.hex('#0a2626'),
  navAlt: chalk.hex('#17dbd8'),
  transparent: chalk.hex('#ffffff00')
};

const patterns = {
  server: {
    info: chalk.hex('#0c2a2ac9'),
    success: chalk.hex('#15aab5ec'),
    error: chalk.hex('#40002f'),
    warning: chalk.hex('#005d46')
  },
  database: {
    info: chalk.hex('#cc0174'),
    success: chalk.hex('#01c69eae'),
    error: chalk.hex('#01c69eae')
  },
  socket: {
    info: chalk.hex('#0a2626'),
    success: chalk.hex('#17dbd8'),
    warning: chalk.hex('#cc0174'),
    error: chalk.hex('#df0471')
  }
};

module.exports = { colors, patterns };
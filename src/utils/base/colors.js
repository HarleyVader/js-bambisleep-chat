// src/utils/base/colors.js
import chalk from 'chalk';

export const colors = {
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

export const patterns = {
  server: {
    info: chalk.hex('#005d46'),
    success: chalk.hex('#15aab5ec'),
    warning: chalk.hex('#cc0174'),
    error: chalk.hex('#df0471'),
  }
};
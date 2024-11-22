import fs from 'fs';
import os from 'os';

const envFilePath = '.env';

// Read .env file & convert to array
export const readEnvVars = (): string[] => fs.readFileSync(envFilePath, 'utf-8').split(os.EOL);

/**
 * Finds the key in .env files and returns the corresponding value
 *
 * @param {string} key Key to find
 * @returns {string|null} Value of the key
 */
export const getEnvValue = (key: string): string | null => {
  const matchedLine = readEnvVars().find((line) => line.split('=')[0] === key);
  return matchedLine !== undefined ? matchedLine.split('=')[1] : null;
};

/**
 * Updates value for existing key or creates a new key=value line
 *
 * This function is a modified version of https://stackoverflow.com/a/65001580/3153583
 *
 * @param {string} key Key to update/insert
 * @param {string} value Value to update/insert
 */
export const setEnvValue = (key: string, value: string): void => {
  const envVars = readEnvVars();
  const targetLine = envVars.find((line) => line.split('=')[0] === key);
  if (targetLine !== undefined) {
    const targetLineIndex = envVars.indexOf(targetLine);
    envVars.splice(targetLineIndex, 1, `${key}="${value}"`);
  } else {
    envVars.push(`${key}="${value}"`);
  }
  fs.writeFileSync(envFilePath, envVars.join(os.EOL));
};

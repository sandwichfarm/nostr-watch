import chalk from "npm:chalk";

export function getLogger(moduleName: string) {
  return {
    debug: (msg: string) =>
      console.debug(chalk.blue(`[DEBUG] [${moduleName}] ${msg}`)),
    info: (msg: string) =>
      console.info(chalk.green(`[INFO] [${moduleName}] ${msg}`)),
    error: (msg: string) =>
      console.error(chalk.red(`[ERROR] [${moduleName}] ${msg}`))
  };
}

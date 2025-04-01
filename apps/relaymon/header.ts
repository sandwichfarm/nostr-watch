import chalk from "npm:chalk";

/**
 * Get the version from deno.json
 */
async function getVersion(): Promise<string> {
  try {
    // Read the deno.json file
    const denoJsonText = await Deno.readTextFile("./deno.json");
    const denoJson = JSON.parse(denoJsonText);
    return denoJson.version || "0.0.0";
  } catch (error) {
    console.error("Error reading version:", error);
    return "0.0.0"; // Default version if we can't read the file
  }
}

// export async function header() {
//   console.log(chalk.bold(`
// npm:@nostrwatch/nocapd  
//                                                    dP
//                                                    88
// 88d888b. .d8888b. .d8888b. .d8888b. 88d888b. .d888b88
// 88'  \`88 88'  \`88 88'  \`"" 88'  \`88 88'  \`88 88'  \`88
// 88    88 88.  .88 88.  ... 88.  .88 88.  .88 88.  .88
// dP    dP \`88888P' \`88888P' \`88888P8 88Y888P' \`88888P8
//                                     88               
//                                     dP               
// `));
// }

export async function header() {
  const version = await getVersion();
  
  console.log(chalk.bold(`
@nostrwatch/relaymon v${version}

░█▀▄░█▀▀░█░░░█▀█░█░█░█▄█░█▀█░█▀█
░█▀▄░█▀▀░█░░░█▀█░░█░░█░█░█░█░█░█
░▀░▀░▀▀▀░▀▀▀░▀░▀░░▀░░▀░▀░▀▀▀░▀░▀ 
`));
}



import chalk from "npm:chalk@5.3.0";
import { getStats } from "../core/status.ts";
import { Config } from "../config/config.ts";
import { msToTimeString } from "../config/config.ts";

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

/**
 * Format configuration into an ASCII box
 */
function formatConfig(config: Config): string {
  const c = chalk;
  const boxWidth = 88;
  const title = c.bold.bgBlue.white;
  const header = c.bold.cyan;
  const key = c.bold.blue;
  const value = c.yellow;
  const highlight = c.bold.green;
  const warning = c.bold.red;

  // Calculate visible string length (without ANSI codes)
  const strLength = (str: string): number => {
    return str.replace(/\u001b\[.*?m/g, '').length;
  };

  // Helper function to convert ms to human readable format
  const formatTime = (ms: number | string): string => {
    if (typeof ms === 'string') {
      // If it's already a string and looks like a timestring, return as is
      if (/^\d+(?:\.\d+)?(?:ms|s|m|h|d)$/.test(ms.trim())) {
        return ms;
      }
      // Otherwise parse it as a number
      const msNum = parseInt(ms);
      return msToTimeString(msNum);
    }
    // For numbers, use the centralized function
    return msToTimeString(ms);
  };

  // Create the box
  let box = '\n';
  
  // Top border
  box += '╔' + '═'.repeat(boxWidth - 2) + '╗\n';
  
  // Title
  const titleText = ' CONFIGURATION ';
  const titlePadding = Math.floor((boxWidth - 2 - titleText.length) / 2);
  const titleLine = `${' '.repeat(titlePadding)}${title(titleText)}${' '.repeat(boxWidth - 2 - titlePadding - titleText.length)}`;
  box += `║${titleLine}║\n`;
  
  // Separator
  box += '╠' + '═'.repeat(boxWidth - 2) + '╣\n';

  // Constants for alignment
  const colWidth = Math.floor((boxWidth - 5) / 2); // Width for each column
  const fullLineWidth = boxWidth - 4; // Width for full line (minus borders and spacing)
  
  // Row 1: Network and Database
  box += `║ ${header('NETWORK SETTINGS')}${' '.repeat(colWidth - strLength(header('NETWORK SETTINGS')))}│ ${header('DATABASE')}${' '.repeat(colWidth - strLength(header('DATABASE')))} ║\n`;
  
  const networks = config?.relaymon?.networks || [];
  const dbPath = config?.db?.path || './relaymon.db';
  
  const networksStr = `${key('Networks:')} ${value(networks.join(', '))}`;
  const dbPathStr = `${key('Path:')} ${value(dbPath)}`;
  
  box += `║ ${networksStr}${' '.repeat(colWidth - strLength(networksStr))}│ ${dbPathStr}${' '.repeat(colWidth - strLength(dbPathStr))} ║\n`;
  
  // Add spacing
  box += `║${' '.repeat(colWidth + 1)}│${' '.repeat(colWidth + 1)}║\n`;
  
  // Row 2: Concurrency and Timeouts
  const concurrencyHeader = `${header('CONCURRENCY')}`;
  const timeoutsHeader = `${header('TIMEOUTS')}`;
  
  box += `║ ${concurrencyHeader}${' '.repeat(colWidth - strLength(concurrencyHeader))}│ ${timeoutsHeader}${' '.repeat(colWidth - strLength(timeoutsHeader))} ║\n`;
  
  const workerConcurrency = config?.queue?.workerConcurrency || 'auto';
  const openTimeout = config?.relaymon?.checks?.options?.timeout?.open || 'default';
  const readTimeout = config?.relaymon?.checks?.options?.timeout?.read || 'default';
  
  const workerStr = `${key('Worker Threads:')} ${highlight(workerConcurrency.toString())}`;
  const openTimeoutStr = `${key('Open:')} ${value(openTimeout + 'ms')}`;
  const readTimeoutStr = `${key('Read:')} ${value(readTimeout + 'ms')}`;
  
  box += `║ ${workerStr}${' '.repeat(colWidth - strLength(workerStr))}│ ${openTimeoutStr}${' '.repeat(colWidth - strLength(openTimeoutStr))} ║\n`;
  box += `║${' '.repeat(colWidth + 1)}│ ${readTimeoutStr}${' '.repeat(colWidth - strLength(readTimeoutStr))} ║\n`;
  
  // Add spacing
  box += `║${' '.repeat(colWidth + 1)}│${' '.repeat(colWidth + 1)}║\n`;
  
  // Row 3: Check settings with two columns
  const checkSettingsHeader = `${header('CHECK SETTINGS')}`;
  box += `║ ${checkSettingsHeader}${' '.repeat(colWidth - strLength(checkSettingsHeader))}│${' '.repeat(colWidth + 1)}║\n`;
  
  const checks = config?.relaymon?.checks?.enabled || [];
  const expires = config?.relaymon?.checks?.options?.expires || 'N/A';
  const interval = config?.relaymon?.checks?.options?.interval || 'N/A';
  const maxChecks = config?.relaymon?.checks?.options?.max || 'All';
  const statusInterval = config?.relaymon?.checks?.options?.statusInterval || 'N/A';
  
  const enabledStr = `${key('Enabled:')} ${value(checks.join(', '))}`;
  const expiryStr = `${key('Expiry:')} ${value(expires)}`;
  const intervalStr = `${key('Interval:')} ${value(interval)}`;
  const maxEnqueueStr = `${key('Max Enqueue:')} ${value(maxChecks.toString())}`;
  const statusUpdateStr = `${key('Status Update:')} ${value(statusInterval.toString())}`;
  
  box += `║ ${enabledStr}${' '.repeat(colWidth - strLength(enabledStr))}│ ${expiryStr}${' '.repeat(colWidth - strLength(expiryStr))} ║\n`;
  box += `║ ${intervalStr}${' '.repeat(colWidth - strLength(intervalStr))}│ ${maxEnqueueStr}${' '.repeat(colWidth - strLength(maxEnqueueStr))} ║\n`;
  box += `║ ${statusUpdateStr}${' '.repeat(fullLineWidth - strLength(statusUpdateStr))} ║\n`;

  // Add spacing
  box += `║${' '.repeat(fullLineWidth + 1)}║\n`;

  // Seed settings - full width
  const seedSettingsHeader = `${header('SEED SETTINGS')}`;
  box += `║ ${seedSettingsHeader}${' '.repeat(fullLineWidth - strLength(seedSettingsHeader))} ║\n`;
  
  const seedInterval = config?.relaymon?.seed?.interval || 'N/A';
  const seedSources = config?.relaymon?.seed?.sources || [];
  const sourcesStr = seedSources.join(', ');
  
  const seedIntervalStr = `${key('Interval:')} ${value(seedInterval)}`;
  const seedSourcesStr = `${key('Sources:')} ${value(sourcesStr)}`;
  
  box += `║ ${seedIntervalStr}${' '.repeat(fullLineWidth - strLength(seedIntervalStr))} ║\n`;
  box += `║ ${seedSourcesStr}${' '.repeat(fullLineWidth - strLength(seedSourcesStr))} ║\n`;
  
  // Add spacing
  box += `║${' '.repeat(fullLineWidth + 1)}║\n`;
  
  // Format retry settings - creative visualization
  const retryHeader = `${header('RETRY BACKOFF STRATEGY')}`;
  box += `║ ${retryHeader}${' '.repeat(fullLineWidth - strLength(retryHeader))} ║\n`;
  
  if (config?.relaymon?.retry?.expiry && Array.isArray(config.relaymon.retry.expiry)) {
    const retryConfig = config.relaymon.retry.expiry;
    
    // Display retry rules as a visualization
    const progressChars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
    
    // Find max delay for normalization
    const maxDelay = Math.max(...retryConfig.map((r: { delay: string | number }) => {
      // Convert time strings like "1h" to milliseconds for comparison
      if (typeof r.delay === 'string') {
        const match = r.delay.match(/(\d+)([mhd])/);
        if (match) {
          const num = parseInt(match[1]);
          const unit = match[2];
          if (unit === 'm') return num * 60 * 1000;
          if (unit === 'h') return num * 60 * 60 * 1000;
          if (unit === 'd') return num * 24 * 60 * 60 * 1000;
        }
        return parseInt(r.delay) || 0;
      }
      return r.delay;
    }));
    
    // Create a timeline visualization
    const retryTimelineKey = `${key('Backoff:')}`;
    let retryLine = `║ ${retryTimelineKey} `;
    
    // Create the full timeline
    retryLine += c.dim('0');
    
    // Calculate retry positions on timeline
    let totalWidth = boxWidth - strLength(retryTimelineKey) - 6; // Adjusting for other elements
    
    // Add spacers and retry indicators
    retryConfig.forEach((rule: { max: number }, i: number) => {
      const position = (rule.max / retryConfig[retryConfig.length-1].max) * totalWidth;
      const spacerWidth = i === 0 ? Math.floor(position) : Math.floor(position) - Math.floor((retryConfig[i-1].max / retryConfig[retryConfig.length-1].max) * totalWidth);
      
      retryLine += c.dim('─'.repeat(spacerWidth-1)) + c.bold.white(`${rule.max}`);
    });
    
    // Calculate the correct padding for the right side
    const timelineRightPadding = Math.max(0, boxWidth - strLength(retryLine) - 2);
    box += `${retryLine}${' '.repeat(timelineRightPadding)} ║\n`;
    
    // Create a gradient bar showing delay progression
    const backoffKey = `${key('        ')}`;
    let delayLine = `║ ${backoffKey} `;
    
    // Add delay progression
    for (let i = 0; i < retryConfig.length; i++) {
      const rule = retryConfig[i];
      const prevMax = i === 0 ? 0 : retryConfig[i-1].max;
      const span = rule.max - prevMax;
      const widthPortion = Math.floor((span / retryConfig[retryConfig.length-1].max) * totalWidth);
      
      // Create a colorful gradient based on delay
      const delayRatio = i / retryConfig.length;
      let barColor;
      if (delayRatio < 0.3) barColor = c.green;
      else if (delayRatio < 0.7) barColor = c.yellow;
      else barColor = c.red;
      
      // Create a increasing height gradient
      const charIndex = Math.floor((i / (retryConfig.length - 1)) * (progressChars.length - 1));
      const char = progressChars[charIndex];
      if(typeof char === 'string') {
        delayLine += barColor(char.repeat(widthPortion));
      } else {
        delayLine += barColor(char);
      }
    }
    
    // Calculate the correct padding for the right side
    const backoffRightPadding = Math.max(0, boxWidth - strLength(delayLine) - 2);
    box += `${delayLine}${' '.repeat(backoffRightPadding)} ║\n`;
    
    // Create a more detailed rule display
    const rulesKey = `${key('Rules:')}`;
    const rulesLine = `║ ${rulesKey} `;
    
    // Format rules for display - all on one line with specific grouping
    let allRulesDisplay = '';
    
    for (let i = 0; i < retryConfig.length; i++) {
      const rule = retryConfig[i];
      const delimiter = i < retryConfig.length - 1 ? c.dim('→') : '';
      const retryLabel = i === 0 ? `0-${rule.max}` : `${retryConfig[i-1].max+1}-${rule.max}`;
      
      // Convert milliseconds to readable format
      const delayValue = typeof rule.delay === 'number' || !isNaN(parseInt(rule.delay.toString())) 
        ? formatTime(rule.delay) 
        : rule.delay;
      
      allRulesDisplay += `${c.bgBlue.white(` ${retryLabel} `)}${c.green(delayValue)} ${delimiter} `;
    }
    
    // Calculate the space needed for all rules
    const allRulesLength = strLength(allRulesDisplay);
    
    // Check if all rules can fit in one line
    const maxRuleWidth = fullLineWidth - strLength(rulesKey) - 1;
    
    if (allRulesLength <= maxRuleWidth) {
      // All rules fit on one line
      const rulesRightPadding = Math.max(0, boxWidth - strLength(rulesLine) - allRulesLength - 2);
      box += `${rulesLine}${allRulesDisplay}${' '.repeat(rulesRightPadding)} ║\n`;
    } else {
      // Split rules into multiple lines
      // Fixed width for each rule box for consistent appearance
      const rules: Array<{display: string, delimiter: string}> = [];
      for (let i = 0; i < retryConfig.length; i++) {
        const rule = retryConfig[i];
        const retryLabel = i === 0 ? `0-${rule.max}` : `${retryConfig[i-1].max+1}-${rule.max}`;
        const delayValue = typeof rule.delay === 'number' || !isNaN(parseInt(rule.delay.toString())) 
          ? formatTime(rule.delay) 
          : rule.delay;
        rules.push({
          display: `${c.bgBlue.white(` ${retryLabel} `)}${c.green(delayValue)}`,
          delimiter: i < retryConfig.length - 1 ? c.dim(' → ') : ''
        });
      }
      
      // First line with Rules: prefix
      let currentLine = `${rulesLine}${rules[0].display}${rules[0].delimiter}`;
      let currentLength = strLength(`${rulesKey} ${rules[0].display}${rules[0].delimiter}`);
      
      // How many rules we can fit per line
      const rulesPerLine = 3;
      let ruleCount = 1;
      
      for (let i = 1; i < rules.length; i++) {
        const thisRule = `${rules[i].display}${rules[i].delimiter}`;
        const thisRuleLength = strLength(thisRule);
        
        if (ruleCount < rulesPerLine && currentLength + thisRuleLength <= maxRuleWidth) {
          // Add to current line
          currentLine += thisRule;
          currentLength += thisRuleLength;
          ruleCount++;
        } else {
          // Complete current line and start a new one
          const rightPadding = Math.max(0, boxWidth - strLength(currentLine) - 2);
          box += `${currentLine}${' '.repeat(rightPadding)} ║\n`;
          
          // Start new line
          currentLine = `║ ${' '.repeat(strLength(rulesKey))} ${thisRule}`;
          currentLength = strLength(`${' '.repeat(strLength(rulesKey))} ${thisRule}`);
          ruleCount = 1;
        }
      }
      
      // Add the last line if not empty
      if (currentLength > 0) {
        const rightPadding = Math.max(0, boxWidth - strLength(currentLine) - 2);
        box += `${currentLine}${' '.repeat(rightPadding)} ║\n`;
      }
    }
    
    // Add a legend
    const legendKey = `${key('Legend:')}`;
    let legendLine = `║ ${legendKey} `;
    legendLine += `${c.green('▁')}${c.green('▄')}${c.yellow('▆')}${c.red('█')} ${c.dim('=')} ${c.white('Increasing Delay')}`;
    legendLine += `   ${c.bgBlue.white(' range ')} ${c.dim('=')} ${c.white('Retry Count Range')}`;
    
    const legendRightPadding = Math.max(0, boxWidth - strLength(legendLine) - 2);
    box += `${legendLine}${' '.repeat(legendRightPadding)} ║\n`;
  } else {
    const retryRulesStr = `${key('Retry Rules:')} ${value('None configured')}`;
    box += `║ ${retryRulesStr}${' '.repeat(fullLineWidth - strLength(retryRulesStr))} ║\n`;
  }
  
  // Bottom border
  box += '╚' + '═'.repeat(boxWidth - 2) + '╝\n';
  
  return box;
}

export async function header(config?: Config) {
  const version = await getVersion();
  
  console.log(chalk.bold(`
@nostrwatch/relaymon v${version}

░█▀▄░█▀▀░█░░░█▀█░█░█░█▄█░█▀█░█▀█
░█▀▄░█▀▀░█░░░█▀█░░█░░█░█░█░█░█░█
░▀░▀░▀▀▀░▀▀▀░▀░▀░░▀░░▀░▀░▀▀▀░▀░▀ 
`));

  // If config is provided, display it in a table
  if (config) {
    console.log(formatConfig(config));
  }
}



/// <reference lib="deno.ns" />

import { trawl } from './trawl';
import chalk from 'npm:chalk';

const header = (): void => {
  console.log(chalk.bold(`

@nostrwatch/
 dMMMMMMP dMMMMb  .aMMMb  dMP dMP dMP dMP     dMMMMMP dMMMMb
   dMP   dMP.dMP dMP"dMP dMP dMP dMP dMP     dMP     dMP.dMP
  dMP   dMMMMK" dMMMMMP dMP dMP dMP dMP     dMMMP   dMMMMK" 
 dMP   dMP"AMF dMP dMP dMP.dMP.dMP dMP     dMP     dMP"AMF  
dMP   dMP dMP dMP dMP  VMMMPVMMP" dMMMMMP dMMMMMP dMP dMP   

`));
};

export default async (): Promise<void> => {
  header();
  // Start trawling and keep the process running
  await trawl();
  
  // Create a never-resolving promise to keep the process alive
  return new Promise(() => {
    // This promise intentionally never resolves
    // It keeps the process running until manually terminated
  });
}; 
import { trawl } from './trawl.js'
import chalk from 'chalk'

const header = () => {
  console.log(chalk.bold(`

@nostrwatch/
 dMMMMMMP dMMMMb  .aMMMb  dMP dMP dMP dMP     dMMMMMP dMMMMb
   dMP   dMP.dMP dMP"dMP dMP dMP dMP dMP     dMP     dMP.dMP
  dMP   dMMMMK" dMMMMMP dMP dMP dMP dMP     dMMMP   dMMMMK" 
 dMP   dMP"AMF dMP dMP dMP.dMP.dMP dMP     dMP     dMP"AMF  
dMP   dMP dMP dMP dMP  VMMMPVMMP" dMMMMMP dMMMMMP dMP dMP   

`));
}

export default async () => {
  return new Promise( async (resolve) => {
    header()
    trawl()
  })
}
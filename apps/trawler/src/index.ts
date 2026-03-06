/// <reference lib="deno.ns" />

import { config } from "https://deno.land/x/dotenv@v3.2.2/mod.ts";
import agent from './agent.ts';
import { getLogger } from './logger.ts';

const logger = getLogger('root');

logger.debug('Current Directory', Deno.cwd());

const $ = agent();
$.catch(logger.error); 
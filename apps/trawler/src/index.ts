/// <reference lib="deno.ns" />

import { config } from "https://deno.land/x/dotenv@v3.2.2/mod.ts";
import agent from './agent.ts';
import Logger from '@nostrwatch/logger';

const logger = new Logger('root');

logger.debug('Current Directory', Deno.cwd());

const $ = agent();
$.catch(logger.error); 
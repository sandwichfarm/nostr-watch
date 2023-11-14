#!/usr/bin/env node

import daemon from './daemon.js';
import Logger from '@nostrwatch/logger'

const logger = new Logger('root')

logger.debug('Current Directory', process.cwd())

const $ = daemon()
$.catch(logger.error);
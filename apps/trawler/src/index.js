#!/usr/bin/env node

import dotenv from 'dotenv'
dotenv.config()

import agent from './agent.js';
import Logger from '@nostrwatch/logger'

const logger = new Logger('root')

logger.debug('Current Directory', process.cwd())

const $ = agent()
$.catch(logger.error);
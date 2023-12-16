#!/usr/bin/env node
import React from 'react';
import {render} from 'ink';
import meow from 'meow';
import App from './app.js';
import lmdb from '../../relaydb/index.js' 


const cli = meow(
	`
		Usage
		  $ relaydb --dbpath <path>
		
		Options
			--dbpath  Path to lmdb directory
	`,
	{
		importMeta: import.meta,
	},
);

const db = lmdb(cli.flags.dbpath)

render(<App db={db} />);

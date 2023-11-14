#!/usr/bin/env node

const kinds = {
  '10002': true
};

const rl = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', (line) => {
  let req = JSON.parse(line);

  if (req.type !== 'new') {
      console.error("unexpected request type"); // will appear in strfry logs
      return;
  }

  let res = { id: req.event.id }; // must echo the event's id

  if (kinds?.[req.event.kind]) {
      res.action = 'accept';
  } else {
      res.action = 'reject';
      res.msg = 'blocked: not kind 10002';
  }
});
import * as lib from '../geneviv.js';
import * as assert from 'assert';

import { tests as forEachTests } from './for-each.js';
import { tests as ofTests } from './of.js';
import { tests as fromTests } from './from.js';
import { tests as eventSourceTests } from './event-source.js';
import { tests as forAwaitTests } from './for-await.js';

async function testModule(name, mod) {
  for (let key of Object.keys(mod)) {
    if (typeof mod[key] === 'function') {
      await mod[key](lib, assert);
    }
  }
}

async function main() {
  await testModule('forEach', forEachTests);
  await testModule('of', ofTests);
  await testModule('from', fromTests);
  await testModule('EventSource', eventSourceTests);
  await testModule('for await', forAwaitTests);
}

main().catch(err => {
  setTimeout(() => { throw err }, 0);
});

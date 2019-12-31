import { EventStream } from '../geneviv.js';

import * as forEachTests from './forEach.js';
import * as ofTests from './of.js';
import * as fromTests from './from.js';

async function testModule(mod) {
  for (let key of Object.keys(mod)) {
    await mod[key](EventStream);
  }
}

async function main() {
  await testModule(forEachTests);
  await testModule(ofTests);
  await testModule(fromTests);
  console.log('OK');
}

main().catch(err => {
  setTimeout(() => { throw err }, 0);
});

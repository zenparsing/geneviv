const lib = require('../');
const assert = require('assert');

const forEachTests = require('./forEach.js');
const ofTests = require('./of.js');
const fromTests = require('./from.js');
const eventSourceTests = require('./eventSource.js');

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
}

main().catch(err => {
  setTimeout(() => { throw err }, 0);
});

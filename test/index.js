const lib = require('../');
const assert = require('assert');

const forEachTests = require('./forEach.js');
const ofTests = require('./of.js');
const fromTests = require('./from.js');

async function testModule(mod) {
  for (let key of Object.keys(mod)) {
    await mod[key](lib, assert);
  }
}

async function main() {
  await testModule(forEachTests);
  await testModule(ofTests);
  await testModule(fromTests);
}

main().catch(err => {
  setTimeout(() => { throw err }, 0);
});

import assert from 'assert';

export async function testBasics(EventStream) {
  let list = [];
  EventStream.of(1, 2, 3).listen(value => list.push(value));
  assert.deepStrictEqual(list, []);
  await null;
  assert.deepStrictEqual(list, [1, 2, 3]);
}

export async function testCancel(EventStream) {
  let list = [];
  let cancel = EventStream.of(1, 2, 3).listen(value => list.push(value));
  assert.deepStrictEqual(list, []);
  cancel();
  await null;
  assert.deepStrictEqual(list, []);
}

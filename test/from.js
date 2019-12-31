import assert from 'assert';

export async function testEventStream(EventStream) {
  let stream = new EventStream(observer => {
    observer.next(1);
    observer.return();
  });
  assert.strictEqual(EventStream.from(stream), stream);
}

export async function testAsyncIterable(EventStream) {
  async function* ag() {
    yield 1;
    await null;
    yield 2;
    await null;
    return;
  }

  let list = [];
  EventStream.from(ag()).listen(value => list.push(value));
  await new Promise(r => setTimeout(r, 0));
  assert.deepStrictEqual(list, [1, 2]);
}

export async function testIterable(EventStream) {
  function* ag() {
    yield 1;
    yield 2;
    return;
  }

  let list = [];
  EventStream.from(ag()).listen(value => list.push(value));
  await null;
  assert.deepStrictEqual(list, [1, 2]);
}

export async function testNoConversion(EventStream) {
  assert.throws(() => EventStream.from({}), TypeError);
}

module.exports = new class {

  async testBasics({ EventStream }, assert) {
    let list = [];
    EventStream.of(1, 2, 3).listen(value => list.push(value));
    assert.deepStrictEqual(list, []);
    await null;
    assert.deepStrictEqual(list, [1, 2, 3]);
  }

  async testCancel({ EventStream }, assert) {
    let list = [];
    let cancel = EventStream.of(1, 2, 3).listen(value => list.push(value));
    assert.deepStrictEqual(list, []);
    cancel();
    await null;
    assert.deepStrictEqual(list, []);
  }

};

module.exports = {

  async testBasics({ EventSource }, assert) {
    let source = new EventSource();
    let values = [];

    let cancelA = source.listen(value => values.push(`a-${ value }`));
    let cancelB = source.listen(value => values.push(`b-${ value }`));

    source.next(1);
    assert.deepEqual(values, ['a-1', 'b-1']);

    values = [];
    cancelA();
    source.next(2);
    assert.deepEqual(values, ['b-2']);

    values = [];
    cancelB();
    source.next(3);
    assert.deepEqual(values, []);
  },

  async testDuplicateListeners({ EventSource }, assert) {
    let source = new EventSource();
    let values = [];
    let listener = value => values.push(value);
    let cancel1 = source.listen(listener);
    let cancel2 = source.listen(listener);

    assert.strictEqual(cancel1, cancel2);

    source.next(1);
    source.next(2);

    assert.deepEqual(values, [1, 2]);

    values = [];
    cancel1();

    source.next(3);
    assert.deepEqual(values, []);
  }

};

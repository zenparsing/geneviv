export const tests = {

  async testBasics({ EventStream }, assert) {
    let [source, stream] = EventStream.source();
    let values = [];

    let cancelA = stream.listen(value => values.push(`a-${ value }`));
    let cancelB = stream.listen(value => values.push(`b-${ value }`));

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

};

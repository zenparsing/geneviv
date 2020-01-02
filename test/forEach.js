module.exports = new class {

  async testBasics({ EventStream }, assert) {
    let stream = new EventStream(observer => {
      Promise.resolve().then(() => {
        observer.next(1);
        observer.next(2);
        observer.next(3);
        observer.return(4);
      });
    });

    let list = [];

    let end = await stream.forEach(value => {
      list.push(value);
    });

    assert.deepStrictEqual(list, [1, 2, 3]);
    assert.strictEqual(end, 4);
  }

  async testEarlyDone({ EventStream }, assert) {
    let stream = new EventStream(observer => {
      Promise.resolve().then(() => {
        observer.next(1);
        observer.next(2);
        observer.next(3);
        observer.return(4);
      });
    });

    let list = [];

    let end = await stream.forEach(value => {
      list.push(value);
      return { value: 0, done: true };
    });

    assert.deepStrictEqual(list, [1]);
    assert.strictEqual(end, 0);
  }

};

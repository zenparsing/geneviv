export const tests = {

  async testBasics({ EventStream }, assert) {
    let stream = new EventStream(observer => {
      (async function() {
        await null;
        await null;
        observer.next(1);
        await null;
        observer.next(2);
        await null;
        await null;
        observer.next(3);
        observer.return();
      })();
    });

    let list = [];

    for await (let value of stream) {
      list.push(value);
    }

    assert.deepStrictEqual(list, [1, 2, 3]);
  },

  async testDropA({ EventStream }, assert) {
    let stream = new EventStream(observer => {
      (async function() {
        await null;
        await null;
        observer.next(1);
        observer.next(2);
        await null;
        await null;
        observer.next(3);
        observer.return();
      })();
    });

    let list = [];

    for await (let value of stream) {
      list.push(value);
    }

    assert.deepStrictEqual(list, [1, 3]);
  },

  async testDropB({ EventStream }, assert) {
    let stream = new EventStream(observer => {
      (async function() {
        await null;
        observer.next(1);
        await null;
        observer.next(2);
        await null;
        observer.next(3);
        await null;
        observer.return();
      })();
    });

    let list = [];

    for await (let value of stream) {
      list.push(value);
      await null;
    }

    assert.deepStrictEqual(list, [1, 3]);
  },

};

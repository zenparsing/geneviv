'use strict';

function makeSymbols() {
  return new Proxy({}, {
    get(target, prop) { return Symbol(prop) }
  });
}

function enqueueThrow(err) {
  setTimeout(() => { throw err }, 0);
}

function enqueue(fn) {
  Promise.resolve().then(() => fn()).catch(enqueueThrow);
}

function validateFunction(x) {
  if (typeof x !== 'function')
    throw new TypeError(`${ x } is not a function.`);
}

function getSpecies(obj, fallback) {
  let ctor = obj.constructor;
  if (ctor !== undefined) {
    ctor = ctor[Symbol.species];
    if (ctor === null) {
      ctor = undefined;
    }
  }
  return ctor !== undefined ? ctor : fallback;
}

function getMethod(obj, key) {
  let value = obj[key];

  if (value == null)
    return undefined;

  if (typeof value !== 'function')
    throw new TypeError(`${ value } is not a function`);

  return value;
}

const functionToObserverMap = new WeakMap();

function functionToObserver(fn) {
  let observer = functionToObserverMap.get(fn);
  if (!observer) {
    observer = { next: fn };
    functionToObserverMap.set(fn, observer);
  }
  return observer;
}


const {
  $subscription,
  $initFunction,
  $isEventStream,
  $observers,
  $stream,
} = makeSymbols();


class SubscriptionObserver {
  constructor(subscription) { this[$subscription] = subscription }
  get done() { return this[$subscription].isClosed() }
  next(value) { return this[$subscription].forward('next', value) }
  throw(value) { return this[$subscription].forward('throw', value) }
  return(value) { return this[$subscription].forward('return', value) }
}


class Subscription {

  constructor(observer, init) {
    if (typeof observer === 'function')
      observer = functionToObserver(observer);

    this._onComplete = undefined;
    this._observer = observer;
    this._state = 'initializing';

    let subscriptionObserver = new SubscriptionObserver(this);

    try {
      this._onComplete = init.call(undefined, subscriptionObserver);
    } catch (e) {
      subscriptionObserver.throw(e);
    }

    if (this._state === 'initializing')
      this._state = 'ready';
  }

  isClosed() {
    return this._state === 'closed';
  }

  cancel() {
    if (this._state === 'running') this._close();
    else this.forward('return');
  }

  forward(type, value) {
    if (this._state === 'closed')
      return { done: true };

    if (this._state !== 'ready')
      throw new Error(`Observer cannot be notified when subscription is ${ this._state }`);

    this._state = 'running';

    let observer = this._observer;
    let method = getMethod(observer, type);
    let result = undefined;

    switch (type) {
      case 'next':
        if (method) result = method.call(observer, value);
        break;
      case 'throw':
        this._close();
        if (method) result = method.call(observer, value);
        else throw value;
        break;
      case 'return':
        this._close();
        if (method) result = method.call(observer, value);
        break;
    }

    if (result && result.done && this._state !== 'closed')
      this._close();

    if (this._state === 'closed')
      this._cleanup();
    else if (this._state === 'running')
      this._state = 'ready';

    return result;
  }

  _close() {
    this._observer = undefined;
    this._state = 'closed';
  }

  _cleanup() {
    let onComplete = this._onComplete;
    if (onComplete === undefined)
      return;

    this._onComplete = undefined;
    onComplete();
  }

}


class EventStream {

  constructor(init) {
    validateFunction(init);
    this[$initFunction] = init;
    this[$isEventStream] = true;
  }

  listen(observer) {
    let subscription = new Subscription(observer, this[$initFunction]);
    return () => { subscription.cancel() };
  }

  forEach(fn) {
    return new Promise((resolve, reject) => {
      validateFunction(fn);

      this.listen({
        next(value) {
          try {
            let result = fn(value);
            if (result && result.done) {
              resolve(result.value);
              return { done: true };
            }
          } catch (e) {
            reject(e);
            return { done: true };
          }
        },
        throw: reject,
        return: resolve,
      });
    });
  }

  map(fn) {
    validateFunction(fn);

    let C = getSpecies(this, EventStream);

    return new C(observer => this.listen(value => {
      try { value = fn(value) }
      catch (e) { return observer.throw(e) }
      observer.next(value);
    }));
  }

  filter(fn) {
    validateFunction(fn);

    let C = getSpecies(this, EventStream);

    return new C(observer => this.listen(value => {
      try { if (!fn(value)) return; }
      catch (e) { return observer.throw(e) }
      observer.next(value);
    }));
  }

  static of(...items) {
    let C = typeof this === 'function' ? this : EventStream;

    return new C(observer => {
      enqueue(() => {
        if (observer.done) return;
        for (let i = 0; i < items.length; ++i) {
          observer.next(items[i]);
          if (observer.done) return;
        }
        observer.return();
      });
    });
  }

  static from(x) {
    let C = typeof this === 'function' ? this : EventStream;

    if (x == null)
      throw new TypeError(`${ x } is not an object`);

    if (x[$isEventStream] && x.constructor === C)
      return x;

    let method;

    method = x.listen;
    if (typeof method === 'function')
      return new C(observer => method.call(x, observer));

    method = x[Symbol.asyncIterator];
    if (method) {
      return new C(observer => {
        enqueue(async () => {
          if (observer.done) return;
          for await (let item of method.call(x)) {
            observer.next(item);
            if (observer.done) return;
          }
          observer.return();
        });
      });
    }

    method = x[Symbol.iterator];
    if (method) {
      return new C(observer => {
        enqueue(() => {
          if (observer.done) return;
          for (let item of method.call(x)) {
            observer.next(item);
            if (observer.done) return;
          }
          observer.return();
        });
      });
    }

    throw new TypeError(`${ x } cannot be converted to an EventStream`);
  }

}


class EventSource {

  constructor() {
    this[$observers] = new Set();
    this[$stream] = new EventStream(observer => {
      this[$observers].add(observer);
      return () => this[$observers].delete(observer);
    });
  }

  listen(observer) {
    if (this[$stream]) return this[$stream].listen(observer);
    else return () => {};
  }

  next(value) {
    for (let observer of this[$observers]) {
      try {
        observer.next(value);
      } catch (err) {
        enqueueThrow(err);
      }
    }
    return { done: false };
  }

  throw(value) {
    this[$stream] = undefined;
    for (let observer of this[$observers]) {
      try {
        observer.throw(value);
      } catch (err) {
        enqueueThrow(err);
      }
    }
    return { done: true };
  }

  return(value) {
    this[$stream] = undefined;
    for (let observer of this[$observers]) {
      try {
        observer.return(value);
      } catch (err) {
        enqueueThrow(err);
      }
    }
    return { done: true };
  }

}

module.exports = { EventStream, EventSource };

// == Error messages ==

const messages = {
  invalidSubscriptionState: state =>
    `listener cannot be notified when subscription is ${ state }`,
  notFunction: x =>
    `${ x } is not a function`,
  notObject: x =>
    `${ x } is not an object`,
  notEventStream: x =>
    `${ x } cannot be converted to an EventStream`,
};

// == Utility Functions ==

function makeSymbols() {
  return new Proxy({}, {
    get(target, prop) { return Symbol(prop) },
  });
}

function enqueueTask(fn) {
  Promise.resolve().then(() => fn()).catch((err) => {
    setTimeout(() => { throw err }, 0);
  });
}

const enqueue = typeof queueMicrotask === 'function'
  ? queueMicrotask
  : enqueueTask;

function enqueueThrow(err) {
  enqueue(() => { throw err });
}

function validateFunction(x) {
  if (typeof x !== 'function')
    throw new TypeError(messages.notFunction(x));
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

  validateFunction(value);
  return value;
}

function makeResolver() {
  let resolver = {};
  resolver.promise = new Promise((resolve, reject) => {
    resolver.resolve = resolve;
    resolver.reject = reject;
  });
  return resolver;
}

// == Symbols ==

const {
  $initFunction,
  $isEventStream,
  $listeners,
  $isDone } = makeSymbols();

// An internal representation of the current state of an event stream.
class Subscription {

  constructor(listener, init) {
    if (typeof listener === 'function')
      listener = { next: listener };

    this._onComplete = undefined;
    this._listener = listener;
    this._state = 'initializing';

    try {
      this._onComplete = init.call(undefined, {
        next: value => this._forward('next', value),
        throw: value => this._forward('throw', value),
        return: value => this._forward('return', value),
      });
    } catch (e) {
      this._state = 'closed';
      throw e;
    }

    if (this._state === 'initializing')
      this._state = 'ready';
  }

  cancel() {
    if (this._state === 'running') this._close();
    else this._forward('return');
  }

  _forward(type, value) {
    if (this._state === 'closed')
      return { done: true };

    if (this._state !== 'ready')
      throw new Error(messages.invalidSubscriptionState(this._state));

    this._state = 'running';

    let listener = this._listener;
    let method = getMethod(listener, type);
    let result = undefined;

    switch (type) {
      case 'next':
        if (method) result = method.call(listener, value);
        break;
      case 'throw':
        this._close();
        if (method) result = method.call(listener, value);
        else throw value;
        break;
      case 'return':
        this._close();
        if (method) result = method.call(listener, value);
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
    this._listener = undefined;
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

class EventStreamSource {

  constructor(listeners) {
    this[$listeners] = listeners;
    this[$isDone] = false;
  }

  get done() {
    return this[$isDone];
  }

  next(value) {
    for (let listener of this[$listeners]) {
      try {
        listener.next(value);
      } catch (err) {
        enqueueThrow(err);
      }
    }
    return { done: false };
  }

  throw(value) {
    this[$isDone] = true;
    for (let listener of this[$listeners]) {
      try {
        listener.throw(value);
      } catch (err) {
        enqueueThrow(err);
      }
    }
    return { done: true };
  }

  return(value) {
    this[$isDone] = true;
    for (let listener of this[$listeners]) {
      try {
        listener.return(value);
      } catch (err) {
        enqueueThrow(err);
      }
    }
    return { done: true };
  }

}

export class EventStream {

  constructor(init) {
    validateFunction(init);
    this[$initFunction] = init;
    this[$isEventStream] = true;
  }

  listen(listener) {
    let subscription = new Subscription(listener, this[$initFunction]);
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

    return new C(listener => this.listen(value => {
      try { value = fn(value) }
      catch (e) { return listener.throw(e) }
      listener.next(value);
    }));
  }

  filter(fn) {
    validateFunction(fn);

    let C = getSpecies(this, EventStream);

    return new C(listener => this.listen(value => {
      try { if (!fn(value)) return; }
      catch (e) { return listener.throw(e) }
      listener.next(value);
    }));
  }

  [Symbol.asyncIterator]() {
    let resolver = makeResolver();

    let cancel = this.listen({
      next(value) {
        resolver.resolve({ value, done: false });
        resolver = makeResolver();
      },
      throw(value) {
        resolver.reject(value);
        resolver = makeResolver();
      },
      return(value) {
        resolver.resolve({ value, done: true });
      },
    });

    return {
      next() {
        return resolver.promise;
      },
      async throw(error) {
        cancel();
        throw error;
      },
      async return(value) {
        cancel();
        return value;
      },
    };
  }

  static of(...items) {
    let C = typeof this === 'function' ? this : EventStream;

    return new C(listener => {
      let done = false;
      enqueue(() => {
        if (done) return;
        for (let i = 0; i < items.length; ++i) {
          listener.next(items[i]);
          if (done) return;
        }
        listener.return();
      });
      return () => { done = true };
    });
  }

  static from(x) {
    let C = typeof this === 'function' ? this : EventStream;

    if (x == null)
      throw new TypeError(messages.notObject(x));

    if (x[$isEventStream] && x.constructor === C)
      return x;

    let method;

    method = x.listen;
    if (typeof method === 'function')
      return new C(listener => method.call(x, listener));

    method = x[Symbol.asyncIterator];
    if (method) {
      return new C(listener => {
        let done = false;
        enqueue(async() => {
          if (done) return;
          for await (let item of method.call(x)) {
            listener.next(item);
            if (done) return;
          }
          listener.return();
        });
        return () => { done = true };
      });
    }

    method = x[Symbol.iterator];
    if (method) {
      return new C(listener => {
        let done = false;
        enqueue(() => {
          if (done) return;
          for (let item of method.call(x)) {
            listener.next(item);
            if (done) return;
          }
          listener.return();
        });
        return () => { done = true };
      });
    }

    throw new TypeError(messages.notEventStream(x));
  }

  static source() {
    let listeners = new Set();
    let source = new EventStreamSource(listeners);
    let stream = new EventStream(listener => {
      listeners.add(listener);
      if (source.done) enqueue(() => { listener.return() });
      return () => { listeners.delete(listener) };
    });
    return [source, stream];
  }

}

# geneviv

A new take on Observables using generator as a core design abstraction.

## Example

```js
// Create an event stream that will send some number values:
const stream = new EventStream(observer => {
  console.log('A new listener has been attached.');

  Promise.resolve().then(async () => {
    // Send some values to the listener. Note that we must
    // send values in a future turn of the event loop; the
    // event stream is not yet active when the init function
    // is called.
    observer.next(1);
    observer.next(2);

    await null;

    // Signal that the stream has ended. If we've returned
    // a cancel function from init, it will now be called.
    observer.return();
  });

  return () => {
    console.log('The listener has been detached.');
  };
});

// Filter the stream and attach a listener function:
stream.map(value => value * 2).forEach(value => {
  console.log(`Next value is: ${ value }`);
}).then(() => {
  // forEach returns a promise for the end of the stream
  console.log('The stream has ended');
});
```

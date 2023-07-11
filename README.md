# Big Shuffle

Linear-time shuffling of large datasets for Node.js

## About

This package uses the [Rao](https://www.jstor.org/stable/25049166)
algorithm to shuffle data sets that are too large to fit in memory. The
algorithm is described pretty well by [Chris Hardin](https://blog.janestreet.com/how-to-shuffle-a-big-dataset/).
The input stream is randomly scattered into "piles" which
are stored on disk. Then each pile is shuffled in-memory with
[Fisher-Yates](https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle).

If your data set is extremely large, then even your piles may not fit in
memory. In that case, the algorithm could recurse until the piles are
small enough, but that feature is not yet implemented here.

On my personal machine, this package randomized the order of a 5.3GB, 22
million row TSV in about three hours. I suspect it could be optimized
quite a bit more.

## Limitations / Future Work

Because the input elements are written to disk as part of the shuffle,
`big-shuffle` can only take string data. If you need to shuffle other
types of times, serialize them to `string` first.

Support for shuffling `Buffer` and `Uint8Array` objects may be added
later if there is demand.

## Getting Started

`npm install big-shuffle`

For TypeScript users:
```ts
import { shuffle } from 'big-shuffle';
import * as path from 'path';

const inArray = [];

function *asyncRange(max: number) {
  for (let i = 0; i < max; i++) {
    yield i.toString(10);
  }
}

const shuffled = shuffle(asyncRange(1000000));

for await (const i of shuffled) {
  console.log();
}
```

This will generate, shuffle, and print a million random numbers.

Should work the same for JavaScript users after a few changes.

## API Reference

```
function shuffle(
  inStream: AsyncIterable<string>,
  numPiles: number = 1000,  // More piles reduces memory usage but requires more open file descriptors
  pileDir: string = path.join(__dirname, 'shuffle_piles'),  // Filesystem path where the files are located
): Promise<AsyncIterable<string>>;
```

Note that the shuffled iterable will not yield any records until the
input iterable is fully consumed.

## Use with Node.js Streams

For interop with the built-in [Stream](https://nodejs.org/api/stream.html)
library, consider using `stream-to-async-iterator` [(details)](https://www.npmjs.com/package/stream-to-async-iterator)
to convert the unshuffled stream into an iterator, and then converting
the shuffled iterator back into a stream using `Readable.from`. See
[test/e2e.spec.ts] for an example using streams to shuffle a CSV.
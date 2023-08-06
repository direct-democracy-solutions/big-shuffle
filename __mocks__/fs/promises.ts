import { jest } from '@jest/globals';
import { fs } from 'memfs';

const m = {
  ...fs.promises,
};

const origOpen = m.open;

m.open = jest
  .fn()
  // Had to hack the type system to get ESM to work, never figured out why.
  .mockImplementation((...args: [ any, any ]) =>
    (origOpen as typeof fs.promises.open)(...args as [ string, string ]),
  ) as typeof fs.promises.open;

export default m;

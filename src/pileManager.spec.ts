import { fc, it } from '@fast-check/jest';
import * as memfs from 'memfs';
import * as fs from 'fs/promises';
import { PileManager } from './pileManager';
import { Delayed, Checkable, arrayFromAsync, dirExists } from '../test/helpers';
import { Pile } from './pile';
import MockedObject = jest.MockedObject;

jest.mock('fs/promises');
jest.mock('./pile');

interface PileManagerParams {
  pileDir: string;
  numPiles: number;
}

// See minimum reproductions in `fs.spec.ts` and `memfs.spec.ts`.
// Bug report: https://github.com/streamich/memfs/issues/938
const memfsBuggedDirectoryName = '__proto__';

const arbPileNum: fc.Arbitrary<number> = fc.integer({ min: 1, max: 100 });
const arbPileManagerParams: fc.Arbitrary<PileManagerParams> = fc.record({
  pileDir: fc.webPath().filter((p) => !p.includes(memfsBuggedDirectoryName)),
  numPiles: arbPileNum,
});

const arbPileManager: fc.Arbitrary<PileManager> = arbPileManagerParams.map(
  (params) => new PileManager(params.pileDir, params.numPiles),
);

const arbPileManagerParamsWithPiles: fc.Arbitrary<{
  pileManager: PileManagerParams;
  piles: string[][];
}> = arbPileManagerParams.chain((pm) =>
  fc.record({
    pileManager: fc.constant(pm),
    piles: fc.array(fc.array(fc.string()), {
      minLength: pm.numPiles,
      maxLength: pm.numPiles,
    }),
  }),
);

const arbPileManagerParamsWithPileNum: fc.Arbitrary<{
  pileManager: PileManagerParams;
  pileNum: number;
}> = arbPileManagerParams.chain((pm: PileManagerParams) =>
  fc.record({
    pileManager: fc.constant(pm),
    pileNum: fc.integer({ min: 0, max: pm.numPiles - 1 }),
  }),
);

describe('class mocking', () => {
  it('should work for Pile', () => {
    new Pile('');
    expect(jest.mocked(Pile)).toHaveBeenCalled();
  });
});

describe('PileManager', () => {
  beforeAll(() => {
    jest.spyOn(global.Math, 'random');
  });

  afterAll(() => {
    jest.restoreAllMocks();
    memfs.vol.reset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('deal', () => {
    it.prop([arbPileManagerParamsWithPileNum, fc.string()])(
      'should get a random pile number',
      async (
        params: { pileManager: PileManagerParams; pileNum: number },
        item: string,
      ) => {
        const pileManager = new PileManager(
          params.pileManager.pileDir,
          params.pileManager.numPiles,
        );
        const randInt = jest
          .spyOn(pileManager, 'randInt')
          .mockReturnValue(params.pileNum);
        try {
          await pileManager.deal(item);
          expect(randInt).toHaveBeenCalledWith(pileManager.numPiles);
        } finally {
          randInt.mockRestore();
        }
      },
    );

    it.prop([arbPileManagerParamsWithPileNum, fc.string()])(
      'should put the item to a random pile',
      async (
        params: { pileManager: PileManagerParams; pileNum: number },
        item: string,
      ) => {
        const pileManager = new PileManager(
          params.pileManager.pileDir,
          params.pileManager.numPiles,
        );
        const randInt = jest
          .spyOn(pileManager, 'randInt')
          .mockReturnValue(params.pileNum);
        const pileConstructor = jest.mocked(Pile);
        try {
          await pileManager.deal(item);
          expect(pileConstructor).toHaveBeenCalledWith(
            pileManager.pilePath(params.pileNum),
          );
        } finally {
          pileConstructor.mockRestore();
          randInt.mockRestore();
        }
      },
    );
  });

  describe('items', () => {
    it.prop([arbPileManagerParamsWithPiles])(
      'should delete any created directories after the last pile is read',
      async (params) => {
        const dirPath = params.pileManager.pileDir;
        const pileDirExistedBefore: boolean = await dirExists(dirPath);
        const pileManager = new PileManager(
          dirPath,
          params.pileManager.numPiles,
        );
        jest
          .spyOn(pileManager, 'dispensePile')
          .mockImplementation((n) => Promise.resolve(params.piles[n]));
        const items = pileManager.items()[Symbol.asyncIterator]();
        for (const _ of params.piles.slice(0, -1).flat()) {
          await items.next();
        }
        await items.next();
        expect(await dirExists(dirPath)).toEqual(pileDirExistedBefore);
      },
    );

    it.prop([arbPileManager, fc.string()])(
      'should close the pile manager for writing',
      (pileManager: PileManager, lateItem: string) => {
        jest.spyOn(pileManager, 'dispensePile').mockResolvedValue([]);
        pileManager.items();
        expect(() => pileManager.deal(lateItem)).toThrow();
      },
    );

    it.prop([arbPileManager])(
      'should dispense ascending piles',
      async (pileManager: PileManager) => {
        const dispensePile = jest
          .spyOn(pileManager, 'dispensePile')
          .mockResolvedValue(['']);
        const items = pileManager.items();
        const iterItems = items[Symbol.asyncIterator]();
        for (let pileNum = 0; pileNum < pileManager.numPiles; pileNum++) {
          await iterItems.next();
          expect(dispensePile).toHaveBeenCalledWith(pileNum);
        }
      },
    );

    it.prop([arbPileManagerParamsWithPiles])(
      'should terminate after the shuffle directory is removed',
      async (params) => {
        const pileManager = new PileManager(
          params.pileManager.pileDir,
          params.pileManager.numPiles,
        );
        const totalItems = params.piles.flat().length;
        const rmDelay = new Delayed(memfs.fs.promises.rm);
        jest
          .spyOn(pileManager, 'dispensePile')
          .mockImplementation((n) => Promise.resolve(params.piles[n]));
        jest
          .mocked(fs.rm)
          .mockImplementationOnce((...args) => rmDelay.start(...args));
        const items = pileManager.items()[Symbol.asyncIterator]();
        for (let i = 0; i < totalItems; i++) {
          await expect(items.next()).resolves.toHaveProperty('done', false);
        }
        const finalIteration = new Checkable(items.next());
        expect(finalIteration.isFinished).toBe(false);
        rmDelay.resolve();
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(finalIteration.isFinished).toBe(true);
        await expect(finalIteration.promise).resolves.toEqual({
          value: undefined,
          done: true,
        });
      },
    );

    it.prop([arbPileManagerParamsWithPiles])(
      'should dispense all items from each pile',
      async (params) => {
        const pileManager = new PileManager(
          params.pileManager.pileDir,
          params.pileManager.numPiles,
        );
        const totalItems = params.piles.flat();
        jest
          .spyOn(pileManager, 'dispensePile')
          .mockImplementation((n) => Promise.resolve(params.piles[n]));
        expect(await arrayFromAsync(pileManager.items())).toEqual(totalItems);
      },
    );
  });

  describe('dispensePile', () => {
    it.prop([arbPileManagerParamsWithPileNum, fc.array(fc.string())])(
      'should read the underlying pile',
      (
        params: { pileManager: PileManagerParams; pileNum: number },
        unshuffledPile: string[],
      ) => {
        try {
          const pileManager: PileManager = new PileManager(
            params.pileManager.pileDir,
            params.pileManager.numPiles,
          );
          const read = getMockPile(params.pileNum).read;
          read.mockResolvedValue(unshuffledPile);
          pileManager.dispensePile(params.pileNum);
          expect(read).toHaveBeenCalledTimes(1);
        } finally {
          jest.clearAllMocks();
        }
      },
    );

    it.prop([
      arbPileManagerParamsWithPileNum,
      fc.array(fc.string()),
      fc.array(fc.string()),
    ])(
      'should shuffle the pile elements',
      async (
        params: {
          pileManager: PileManagerParams;
          pileNum: number;
        },
        unshuffledPile: string[],
        shuffledPile: string[],
      ) => {
        const pileManager = new PileManager(
          params.pileManager.pileDir,
          params.pileManager.numPiles,
        );
        try {
          getMockPile(params.pileNum).read.mockResolvedValue(unshuffledPile);
          const smallShuffle = jest
            .spyOn(pileManager, 'smallShuffle')
            .mockReturnValue(shuffledPile);
          await pileManager.dispensePile(params.pileNum);
          expect(smallShuffle).toHaveBeenCalledWith(unshuffledPile);
        } finally {
          jest.resetAllMocks();
        }
      },
    );

    it.prop([arbPileManagerParamsWithPileNum, fc.array(fc.string())])(
      'should return the shuffled pile',
      async (
        params: {
          pileManager: PileManagerParams;
          pileNum: number;
        },
        shuffledPile: string[],
      ) => {
        try {
          const pileManager = new PileManager(
            params.pileManager.pileDir,
            params.pileManager.numPiles,
          );
          getMockPile(params.pileNum).read.mockResolvedValue([]);
          jest.spyOn(pileManager, 'smallShuffle').mockReturnValue(shuffledPile);
          expect(await pileManager.dispensePile(params.pileNum)).toEqual(
            shuffledPile,
          );
        } finally {
          jest.clearAllMocks();
        }
      },
    );
  });

  describe('smallShuffle', () => {
    it.prop([arbPileManager, fc.array(fc.string())])(
      'should return the same input array',
      (pileManager: PileManager, values: string[]) => {
        expect(pileManager.smallShuffle(values)).toBe(values);
      },
    );

    it.prop([arbPileManager, fc.array(fc.string())])(
      'should retain the same elements',
      (pileManager: PileManager, values: string[]) => {
        const inArray = values.map((x) => x);
        expect(new Set(pileManager.smallShuffle(inArray))).toEqual(
          new Set(values),
        );
      },
    );

    it.prop([arbPileManager, fc.array(fc.string())])(
      'should use random numbers',
      (pileManager: PileManager, values: string[]) => {
        try {
          pileManager.smallShuffle(values);
          expect(jest.mocked(Math.random)).toHaveBeenCalledTimes(values.length);
        } finally {
          jest.mocked(Math.random).mockReset();
        }
      },
    );
  });
});

function getMockPile(pileNum: number): MockedObject<Pile> {
  const pileConstructor = jest.mocked(Pile);
  return pileConstructor.mock.instances[pileNum] as MockedObject<Pile>;
}

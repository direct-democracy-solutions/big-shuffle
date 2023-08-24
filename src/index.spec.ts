import { fc, it } from '@fast-check/jest';
import { Arbitrary } from 'fast-check';
import * as shuffleModule from './index';
import { PileManager, Piles } from './pileManager';
import { arrayFromAsync, asyncify } from '../test/helpers';
import { defaultNumPiles, defaultPileDir } from './index';
import * as path from 'path';

jest.mock('./pileManager', () => {
  return {
    PileManager: jest.fn().mockImplementation(() => {
      return {
        deal: jest.fn(),
        items: jest.fn(),
      };
    }),
  };
});

interface ShuffleParams {
  inStream: Iterable<string>;
  numPiles: number | undefined;
  pileDir: string | undefined;
}

const arbShuffleParams: Arbitrary<ShuffleParams> = fc.record({
  inStream: fc.array<string>(fc.string()),
  numPiles: fc.option(fc.integer({ min: 1 }), { nil: undefined }),
  pileDir: fc.option(fc.webPath(), { nil: undefined }),
});

describe('class mocking', () => {
  it('should work for PileManager', () => {
    const pileManagerConstructor = jest.mocked(PileManager);
    new PileManager('', 1);
    expect(pileManagerConstructor).toHaveBeenCalled();
  });
});

describe('shuffle', () => {
  const pileManager: jest.MockedObjectDeep<Piles<number>> = {
    deal: jest.fn(),
    items: jest.fn(),
  };

  const pileManagerConstructor = jest.mocked(PileManager);

  afterAll(() => {
    jest.clearAllMocks();
  });

  it.prop([arbShuffleParams])(
    'should create a pile manager with the requested number of piles and pileDir',
    (params: ShuffleParams) => {
      if (params.pileDir !== undefined) {
        shuffleModule.shuffle(
          asyncify(params.inStream),
          params.numPiles,
          params.pileDir,
        );
      } else if (params.numPiles !== undefined) {
        shuffleModule.shuffle(asyncify(params.inStream), params.numPiles);
      } else {
        shuffleModule.shuffle(asyncify(params.inStream));
      }
      try {
        expect(pileManagerConstructor).toHaveBeenCalledWith(
          params.pileDir !== undefined
            ? params.pileDir
            : path.join(__dirname, defaultPileDir),
          params.numPiles !== undefined ? params.numPiles : defaultNumPiles,
        );
      } finally {
        pileManagerConstructor.mockClear();
      }
    },
  );

  it.prop([arbShuffleParams])(
    'should deal each input element into the piles',
    async (params: ShuffleParams) => {
      try {
        pileManagerConstructor.mockReturnValue(
          pileManager as unknown as jest.MockedObjectDeep<PileManager>,
        );
        await shuffleModule.shuffle(
          asyncify(params.inStream),
          params.numPiles,
          params.pileDir,
        );
        const inItems = Array.from(params.inStream);
        expect(pileManager.deal.mock.calls).toEqual(inItems.map((x) => [x]));
      } finally {
        pileManager.deal.mockReset();
      }
    },
  );

  it.prop([arbShuffleParams, fc.array(fc.integer())])(
    'should return the items stream from the pile manager',
    async (params: ShuffleParams, shuffled: Iterable<number>) => {
      try {
        pileManager.items.mockReturnValue(asyncify(shuffled));
        const result = await shuffleModule.shuffle(
          asyncify(params.inStream),
          params.numPiles,
          params.pileDir,
        );
        expect(await arrayFromAsync(result)).toEqual(shuffled);
      } finally {
        pileManager.items.mockReset();
      }
    },
  );
});

describe('ShuffleTransform', () => {
  const pileManagerConstructor = jest.mocked(PileManager);

  it.only.prop([arbShuffleParams])(
    'should create a pile manager with the requested number of piles and pileDir',
    (params: ShuffleParams) => {
      if (params.pileDir !== undefined) {
        new shuffleModule.ShuffleTransform(params.numPiles, params.pileDir);
      } else if (params.numPiles !== undefined) {
        new shuffleModule.ShuffleTransform(params.numPiles);
      } else {
        new shuffleModule.ShuffleTransform();
      }
      try {
        expect(pileManagerConstructor).toHaveBeenCalledWith(
          params.pileDir !== undefined
            ? params.pileDir
            : path.join(__dirname, defaultPileDir),
          params.numPiles !== undefined ? params.numPiles : defaultNumPiles,
        );
      } finally {
        pileManagerConstructor.mockClear();
      }
    },
  );

  it.todo('should deal each input element into the piles');
  it.todo('should flush the items from the pile manager');
});

import * as path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import NullWritable from 'null-writable';
import StreamToAsyncIterator from 'stream-to-async-iterator';
import { fc, it } from '@fast-check/jest';
import { Arbitrary } from 'fast-check';
import * as shuffleModule from './index';
import { defaultNumPiles, defaultPileDir, ShuffleTransform } from './index';
import { PileManager, Piles } from './pileManager';
import { any, arrayFromAsync, asyncify, CountTransform } from '../test/helpers';

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

  const pileManager: jest.MockedObjectDeep<Piles<string>> = {
    deal: jest.fn(),
    items: jest.fn(),
  };

  beforeAll(() => {
    pileManagerConstructor.mockReturnValue(
      pileManager as unknown as jest.MockedObjectDeep<PileManager>,
    );
  });

  afterEach(() => {
    pileManager.deal.mockClear();
    pileManager.items.mockClear();
  });

  afterAll(() => {
    pileManagerConstructor.mockReset();
  });

  it.prop([arbShuffleParams])(
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

  it.prop([arbShuffleParams, fc.array(fc.string()), fc.array(fc.string())])(
    'should deal each input element into the piles',
    async (
      params: ShuffleParams,
      elementsIn: string[],
      elementsOut: string[],
    ) => {
      const transform = new ShuffleTransform(params.numPiles, params.pileDir);
      try {
        pileManager.items.mockResolvedValue(asyncify(elementsOut) as never);
        await pipeline(
          Readable.from(elementsIn),
          transform,
          new NullWritable({ objectMode: true }),
        );
        expect(pileManager.deal.mock.calls).toEqual(
          elementsIn.map((x: string) => [x]),
        );
      } finally {
        pileManager.deal.mockClear();
      }
    },
  );

  it.prop([arbShuffleParams, fc.array(fc.string()), fc.array(fc.string())])(
    'should flush the items from the pile manager',
    async (
      params: ShuffleParams,
      elementsIn: string[],
      elementsOut: string[],
    ) => {
      const transform = new ShuffleTransform(params.numPiles, params.pileDir);
      pileManager.items.mockResolvedValue(asyncify(elementsOut) as never);
      expect(
        await arrayFromAsync(
          new StreamToAsyncIterator(Readable.from(elementsIn).pipe(transform)),
        ),
      ).toEqual(elementsOut);
    },
  );

  it.failing.prop([
    arbShuffleParams,
    fc.array(fc.string(), { minLength: 1000, maxLength: 1000 }),
  ])(
    'should respect backpressure',
    async (params: ShuffleParams, elements: string[]) => {
      const nodeDefaultHighWaterMark = 16;
      pileManager.items.mockResolvedValue(asyncify(elements) as never);
      const transform = new ShuffleTransform(params.numPiles, params.pileDir);
      const countIn = new CountTransform();
      const countOut = new CountTransform();
      const sink = new NullWritable({ objectMode: true, highWaterMark: 1 });
      sink.cork();
      const testPipeline = pipeline(
        Readable.from(elements),
        countIn,
        transform,
        countOut,
        sink,
      );
      try {
        await new Promise((resolve) => setTimeout(resolve, 10));
        expect(countIn.count).toBeLessThanOrEqual(
          1 + 5 * nodeDefaultHighWaterMark,
        );
        expect(countOut.count).toBeLessThanOrEqual(
          1 + nodeDefaultHighWaterMark,
        );
      } finally {
        sink.uncork();
        await testPipeline;
      }
      expect(countOut.count).toEqual(1000);
    },
  );

  it.prop([arbShuffleParams, any().filter((x: any) => typeof x !== 'string')])(
    'should reject non-string chunks',
    (params: ShuffleParams, invalidChunk: any) => {
      const transform = new ShuffleTransform(params.numPiles, params.pileDir);
      expect(() => transform.write(invalidChunk)).toThrow();
    },
  );
});

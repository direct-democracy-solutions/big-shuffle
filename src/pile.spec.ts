import { fc, it } from '@fast-check/jest';
import * as memfs from 'memfs';
import * as pile from './pile';
import { Pile } from './pile';
import * as path from 'path';
import { Arbitrary, hexaString, webPath } from 'fast-check';
import { Checkable, Delayed, ifAFileWasOpened } from '../test/helpers';

jest.mock('fs/promises');

interface PileParams {
  dirPath: string;
  fileName: string;
}

const arbPileParams: Arbitrary<PileParams> = fc.record({
  dirPath: webPath(),
  fileName: hexaString({ minLength: 1 }),
});

const arbPileItem: Arbitrary<string> = fc
  .array(fc.oneof(fc.char(), fc.constant(pile.delim), fc.constant(pile.escape)))
  .map((a) => a.join('\n'));

async function putAllItems(pile: Pile, contents: string[]) {
  for (const item of contents) {
    await pile.put(item);
  }
}

describe('Pile', () => {
  describe('put and read', () => {
    it.prop([arbPileParams, fc.array(arbPileItem)])(
      'should be inverse',
      async (params: PileParams, contents: string[]) => {
        await withPile(params, async (pile: Pile) => {
          await putAllItems(pile, contents);
          await expect(await pile.read()).toEqual(contents);
        });
      },
    );
  });

  describe('put', () => {
    it.prop([arbPileParams, fc.array(arbPileItem), arbPileItem])(
      'should reject after read',
      async (params: PileParams, contents: string[], lateItem: string) => {
        await withPile(params, async (pile: Pile) => {
          await putAllItems(pile, contents);
          await pile.read();
          await expect(pile.put(lateItem)).rejects.toBeTruthy();
        });
      },
    );
  });

  describe('read', () => {
    it.prop([arbPileParams, fc.array(arbPileItem)])(
      'should wait until the write stream is closed',
      async (params: PileParams, contents: string[]) => {
        await withPile(params, async (pile) => {
          await putAllItems(pile, contents);
          await ifAFileWasOpened(async (pileFile) => {
            const closeDelay: Delayed<void> = new Delayed(() =>
              Promise.resolve(),
            );
            jest
              .spyOn(pileFile, 'close')
              .mockImplementationOnce(() => closeDelay.start());
            const read: Checkable<string[]> = new Checkable(pile.read());
            expect(read.isFinished).toBe(false);
            closeDelay.resolve();
            await read.promise;
            expect(read.isFinished).toBe(true);
          });
        });
      },
    );

    it.prop([arbPileParams, fc.array(arbPileItem)])(
      'should close and delete the underlying file',
      async (params: PileParams, contents: string[]) => {
        await withPile(params, async (pile: Pile) => {
          const pilePath = path.join(params.dirPath, params.fileName);
          await putAllItems(pile, contents);
          await pile.read();
          await expect(
            memfs.fs.promises.open(pilePath, 'r'),
          ).rejects.toBeTruthy();
        });
      },
    );
  });
});

describe('size', () => {
  it.prop([arbPileParams, fc.array(arbPileItem)])(
    'should equal the number of items added to the pile',
    async (params: PileParams, contents: string[]) => {
      await withPile(params, (pile: Pile) =>
        putAllItems(pile, contents).then(() =>
          expect(pile.size).toEqual(contents.length),
        ),
      );
    },
  );
});

function withPile<T>(params: PileParams, f: (pile: Pile) => T): Promise<T> {
  return setUpPile(params).then(f);
}

async function setUpPile(params: PileParams): Promise<Pile> {
  await memfs.fs.promises.mkdir(params.dirPath, { recursive: true });
  return new Pile(path.join(params.dirPath, params.fileName));
}

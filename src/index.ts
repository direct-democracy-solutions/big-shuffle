import { Transform, TransformCallback } from 'stream';
import * as path from 'path';
import { PileManager, Piles } from './pileManager';

export const defaultNumPiles = 1000;
export const defaultPileDir = 'shuffle_piles';

export async function shuffle(
  inStream: AsyncIterable<string>,
  numPiles: number = defaultNumPiles,
  pileDir: string = path.join(__dirname, defaultPileDir),
): Promise<AsyncIterable<string>> {
  const pileManager: Piles<string> = new PileManager(pileDir, numPiles);
  for await (const x of inStream) {
    pileManager.deal(x);
  }
  return pileManager.items();
}

export class ShuffleTransform extends Transform {
  constructor(
    numPiles: number = defaultNumPiles,
    pileDir: string = path.join(__dirname, defaultPileDir),
  ) {
    super({ objectMode: true });
    new PileManager(pileDir, numPiles);
  }

  _transform(chunk: any, encoding: string | null, callback: TransformCallback) {
    throw new Error('Not implemented yet');
  }

  _flush(callback: TransformCallback) {
    throw new Error('Not implemented yet');
  }
}

export default shuffle;

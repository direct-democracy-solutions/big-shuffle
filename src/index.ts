import { TransformCallback } from 'stream';
import * as path from 'path';
import { DrainAwareTransform } from './drain-aware-transform';
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

export class ShuffleTransform extends DrainAwareTransform {
  private readonly pileManager;

  constructor(
    numPiles: number = defaultNumPiles,
    pileDir: string = path.join(__dirname, defaultPileDir),
  ) {
    super({ objectMode: true });
    this.pileManager = new PileManager(pileDir, numPiles);
  }

  _transform(chunk: any, encoding: string | null, callback: TransformCallback) {
    if (typeof chunk !== 'string') {
      throw new TypeError(`chunk must be a string, got ${chunk}`);
    }
    this.pileManager.deal(chunk);
    callback();
  }

  _flush(callback: TransformCallback): void {
    this.flushPileManager()
      .then(() => callback())
      .catch((e) => callback(e));
  }

  private async flushPileManager(): Promise<void> {
    for await (const item of await this.pileManager.items()) {
      await this.safePush(item);
    }
  }
}

export default shuffle;

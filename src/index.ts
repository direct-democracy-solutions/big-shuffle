import { Piles } from './pileManager.js';
import * as path from 'path';
import url from "url";

const {PileManager} = await import('./pileManager');

export const defaultNumPiles = 1000;
export const defaultPileDir = 'shuffle_piles';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

export async function shuffle(
  inStream: AsyncIterable<string>,
  numPiles = defaultNumPiles,
  pileDir: string = path.join(__dirname, defaultPileDir),
): Promise<AsyncIterable<string>> {
  const pileManager: Piles<string> = new PileManager(pileDir, numPiles);
  for await (const x of inStream) {
    pileManager.deal(x);
  }
  return pileManager.items();
}

export default shuffle;

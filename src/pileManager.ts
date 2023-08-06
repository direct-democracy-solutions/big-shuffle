import * as path from 'path';
import type { Pile as PileType } from './pile.d.ts';

const fs = await import('fs/promises');
const { Pile } = await import('./pile.js');

export interface Piles<T> {
  deal(item: T): void;

  items(): AsyncIterable<T>;
}

const closedMsg =
  'This pile manager is closed; once items() has been called, no more elements may be added.';

export class PileManager implements Piles<string> {
  private readonly piles: PileType[] = [];
  private closed = false;
  private readonly createdDir: Promise<string | void>;

  constructor(readonly pileDir: string, readonly numPiles: number) {
    this.createdDir = fs.mkdir(pileDir, { recursive: true });
    for (let i = 0; i < numPiles; i++) {
      this.piles.push(new Pile(this.pilePath(i)));
    }
  }

  /** Deal a new element into a random pile */
  deal(item: string): void {
    if (this.closed) {
      throw new Error(closedMsg);
    } else {
      const pileNum = this.randInt(this.numPiles);
      this.piles[pileNum].put(item);
    }
  }

  /** Emit all stored elements, in a random order.
   *
   * Once items() is called, it is no longer possible to put any
   * further elements.
   */
  items(): AsyncIterable<string> {
    this.closed = true;
    return this._items();
  }

  private async *_items(): AsyncGenerator<string> {
    for (let p = 0; p < this.numPiles; p++) {
      const items = await this.dispensePile(p);
      if (p === this.numPiles - 1) {
        await this.removeTempDir();
      }
      for (const i of items) {
        yield i;
      }
      items.length = 0;
    }
  }

  async dispensePile(pileNum: number): Promise<string[]> {
    const pile = await this.piles[pileNum].read();
    return this.smallShuffle(pile);
  }

  /** In-place array shuffle
   *
   * Implementation is O(n) in time and memory using the
   * Fisher-Yates/Durstenfield algorithm.
   * */
  smallShuffle(a: string[]): string[] {
    for (let i = 0; i < a.length; i++) {
      const j = i + Math.floor(Math.random() * (a.length - i));
      const tmp = a[j];
      a[j] = a[i];
      a[i] = tmp;
    }
    return a;
  }

  randInt(max: number): number {
    return Math.floor(Math.random() * max);
  }

  pilePath(pileNum: number): string {
    return path.join(this.pileDir, `shuffle_pile_${pileNum}.txt`).toString();
  }

  private async removeTempDir(): Promise<void> {
    const createdPileDir = await this.createdDir;
    if (createdPileDir !== undefined) {
      await fs.rm(createdPileDir, { recursive: true });
    }
  }
}

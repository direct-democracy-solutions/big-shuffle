import { FileHandle } from 'fs/promises';
import * as fs from 'fs/promises';

export const delim = '\n';
export const escape = '\\';
export const delimRegex = /\n/g;
export const escapeRegex = /\\/g;

const pileEncoding: BufferEncoding = 'utf8';
const pileClosedMessage =
  'This pile is closed; cannot put items after read() has been called';

export class Pile {
  size = 0;
  private file: Promise<FileHandle> | undefined;
  private closed = false;

  constructor(private readonly path: string) {}

  async put(item: string): Promise<void> {
    if (this.closed) {
      throw new Error(pileClosedMessage);
    }
    const file = await this.ensureFileIsOpen();
    await file.appendFile(this.escapeItem(item) + delim);
    this.size++;
  }

  async read(): Promise<string[]> {
    this.closed = true;
    if (this.file !== undefined) {
      const content = await this.loadAndDeleteFile(this.file);
      return Array.from(this.parsePile(content));
    } else {
      return [];
    }
  }

  private ensureFileIsOpen(): Promise<FileHandle> {
    if (this.file === undefined) {
      this.file = fs.open(this.path, 'w');
    }
    return this.file;
  }

  private async loadAndDeleteFile(file: Promise<FileHandle>): Promise<string> {
    await (await file).close();
    const content = await fs.readFile(this.path, { encoding: pileEncoding });
    if (this.file !== undefined) {
      await fs.unlink(this.path);
    }
    return content;
  }

  private *parsePile(pileStr: string): Iterable<string> {
    let mode = 'SCAN';
    let currentItem = [];
    for (const c of pileStr) {
      if (mode === 'SCAN') {
        if (c === escape) {
          mode = 'ESCAPE';
        } else if (c === delim) {
          yield currentItem.join('');
          currentItem = [];
        } else {
          currentItem.push(c);
        }
      } else if (mode === 'ESCAPE') {
        mode = 'SCAN';
        currentItem.push(c);
      }
    }
  }

  private escapeItem(item: string) {
    return item
      .replace(escapeRegex, escape + escape)
      .replace(delimRegex, escape + delim);
  }
}

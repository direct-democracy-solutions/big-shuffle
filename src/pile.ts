import * as stream from 'stream';
import * as fsStream from 'fs';
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
  private file: stream.Writable | undefined;
  private closed = false;

  constructor(private readonly path: string) {}

  async put(item: string): Promise<void> {
    if (this.closed) {
      throw new Error(pileClosedMessage);
    }
    const file = this.ensureFileIsOpen();
    this.size++;
    if (!file.write(this.escapeItem(item) + delim)) {
      await new Promise(resolve =>
        file.once('drain', resolve)
      );
    }
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

  private ensureFileIsOpen(): stream.Writable {
    if (this.file === undefined) {
      this.file = fsStream.createWriteStream(this.path);
    }
    return this.file;
  }

  private async loadAndDeleteFile(file: stream.Writable): Promise<string> {
    await this.closeWriteStream(file);
    const content = await fs.readFile(this.path, { encoding: pileEncoding });
    if (this.file !== undefined) {
      await fs.unlink(this.path);
    }
    return content;
  }

  private closeWriteStream(stream: stream.Writable): Promise<void> {
    const p = new Promise(resolve =>
      stream.once('close', resolve)
    );
    stream.end();
    return p.then();
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

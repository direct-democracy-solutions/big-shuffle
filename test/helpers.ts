import { FileHandle, open } from 'fs/promises';
import * as memfs from 'memfs';

export async function* asyncify<T>(it: Iterable<T>): AsyncIterable<T> {
  for (const i of it) {
    yield i;
  }
}

export async function arrayFromAsync<T>(it: AsyncIterable<T>): Promise<T[]> {
  const array = [];
  for await (const i of it) {
    array.push(i);
  }
  return array;
}

export async function ifAFileWasOpened<T>(
  f: (openedFile: FileHandle) => Promise<T>,
) {
  try {
    const mockOpen = jest.mocked(open);
    if (mockOpen.mock.calls.length > 0) {
      const pileFile = await mockOpen.mock.results[0].value;
      return f(pileFile);
    }
  } finally {
    jest.clearAllMocks();
  }
}

export function dirExists(path: string): Promise<boolean> {
  return memfs.fs.promises
    .access(path, memfs.fs.promises.constants.R_OK)
    .then(() => true)
    .catch(() => false);
}

export class Delayed<T> {
  private readonly delay: Promise<void>;

  resolve: (value?: any) => void = () => {
    throw new Error('Resolve called before set');
  };

  constructor(private readonly f: () => Promise<T>) {
    this.delay = new Promise((resolve) => {
      this.resolve = resolve;
    });
  }

  start(): Promise<T> {
    return this.delay.then(() => this.f());
  }
}

export class Checkable<T> {
  isFinished = false;
  readonly promise: Promise<T>;

  constructor(p: Promise<T>) {
    this.promise = new Promise((resolve) => {
      p.then((r: T) => {
        this.isFinished = true;
        resolve(r);
      });
    });
  }
}

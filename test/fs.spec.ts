import * as fs from 'fs/promises';
import { FileHandle } from 'fs/promises';
import * as path from 'path';
import * as memfs from 'memfs';

describe('node fs module', () => {
  const testFilePath = path.join(__dirname, 'test-file.txt');
  let file: FileHandle;
  let filePromise: Promise<FileHandle>;

  beforeEach(async () => {
    filePromise = fs.open(testFilePath, 'w');
    file = await filePromise;
  });

  afterEach(async () => {
    try {
      await file.close();
    } catch {}
    try {
      await fs.unlink(testFilePath);
    } catch {}
  });

  it('should write', async () => {
    await file.write('hello world');
  });

  it('should preserve handle after unlink', async () => {
    await file.write('hello');
    await file.close();
    await fs.unlink(testFilePath);
    expect(file).toBeDefined();
    expect(filePromise).toBeDefined();
  });

  it('should allow directories named __proto__', async () => {
    const dirName = path.join(__dirname, '__proto__');
    expect(await dirExistsForReal(dirName)).toBe(false);
    await fs.mkdir(dirName);
    try {
      expect(await dirExistsForReal(dirName)).toBe(true);
    } finally {
      await fs.rmdir(dirName);
    }
  });

  it('does not error on close after delete', async () => {
    const testPath = path.join(__dirname, 'test-file-1');
    const f = await fs.open(testPath, 'w');
    await fs.unlink(testPath);
    await f.close();
  });
});

function dirExistsForReal(path: string): Promise<boolean> {
  return fs
    .access(path, memfs.fs.promises.constants.R_OK)
    .then(() => true)
    .catch(() => false);
}

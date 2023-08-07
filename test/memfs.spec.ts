import * as fs from 'fs/promises';
import * as memfs from 'memfs';
import { dirExists } from './helpers';
import * as path from 'path';

jest.mock('fs/promises');

describe('memfs integration', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should interop between monkey-patched and direct imports', () => {
    const testString = 'test-string';
    return fs
      .open('/my-file-3', 'w')
      .then((f) => fs.writeFile(f, testString))
      .then(() => memfs.fs.promises.open('/my-file-3', 'r'))
      .then((f) => memfs.fs.promises.readFile(f, { encoding: 'utf8' }))
      .then((contents) => expect(contents).toEqual(testString));
  });

  it('should clear all files on vol.reset()', async () => {
    const testPath = '/my-file-4';
    const f = await fs.open(testPath, 'w');
    await fs.writeFile(f, 'test-string');
    memfs.vol.reset();
    await expect(
      fs.readFile(testPath, { encoding: 'utf8' }),
    ).rejects.toBeTruthy();
  });

  it('should allow multiple close after clear', async () => {
    const testPath = '/my-file-5';
    const f = await fs.open(testPath, 'w');
    await f.close();
    memfs.vol.reset();
    const g = await fs.open(testPath, 'w');
    expect(async () => await g.close()).not.toThrow();
  });

  it('should not allow reading non-existent files', () => {
    return expect(
      memfs.fs.promises.access('/my-dir', memfs.fs.promises.constants.R_OK),
    ).rejects.toBeTruthy();
  });

  it('should reject on double close', async () => {
    const f = await fs.open('/my-file-6', 'w');
    await f.close();
    await expect(f.close()).rejects.toBeTruthy();
  });

  it('should clear files synchronously', async () => {
    await fs.open('/my-file-7', 'w');
    memfs.vol.reset();
    const f = await fs.open('/my-file-8', 'w');
    await new Promise((resolve) => setTimeout(resolve, 100));
    await expect(f.writeFile('abc')).resolves.toBeUndefined();
  });

  // Bug report: https://github.com/streamich/memfs/issues/938
  it.failing('should allow directories named __proto__', async () => {
    const dirName = path.join(__dirname, '__proto__');
    expect(await dirExists(dirName)).toBe(false);
    await memfs.fs.promises.mkdir(dirName);
    try {
      expect(await dirExists(dirName)).toBe(true);
    } finally {
      await memfs.fs.promises.rmdir(dirName);
    }
  });
});

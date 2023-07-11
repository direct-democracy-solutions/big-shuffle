import * as fs from 'fs/promises';
import { FileHandle } from 'fs/promises';
import * as path from 'path';

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
});

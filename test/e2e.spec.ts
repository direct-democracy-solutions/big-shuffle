import { jest } from '@jest/globals';
import * as csv_read from 'csv-parse';
import * as csv_write from 'csv-stringify';
import * as path from 'path';
import * as fs from 'fs';
import StreamToAsyncIterator from 'stream-to-async-iterator';
import { pipeline, Readable, Transform, TransformCallback } from 'stream';
import shuffle from '../src';
import ErrnoException = NodeJS.ErrnoException;

const fileSettings: csv_read.Options & csv_write.Options = {
  escape: '\\',
};

const parserOptions: csv_read.Options = {
  columns: true, // auto-detect from first line
  ...fileSettings,
};

const writeOptions: csv_write.Options = {
  // columns: (auto-discovered by the reader and set below)
  header: true,
  ...fileSettings,
};

const inFileName = 'e2e-test-vector.csv';
const outFileName = 'e2e-test-out.csv';
const pileDirPath = path.join(__dirname, 'e2e-test-piles');
const numPiles = 3;

describe('shuffle', () => {
  it(
    'should properly shuffle a CSV',
    async () => {
      let countIn = 0;
      let countOut = 0;
      let resolveHeaders: (headers: string[]) => void;

      const headers = new Promise<string[]>((resolve) => {
        resolveHeaders = resolve;
      });

      function incrCountIn<T>(record: T): T {
        countIn++;
        return record;
      }

      function incrCountOut<T>(record: T): T {
        countOut++;
        return record;
      }

      function pipelineCompleteHandler(
        name: string,
        resolve?: (r?: any) => void,
        reject?: (e: Error) => void,
      ): (e?: ErrnoException | null) => void {
        return (e?: ErrnoException | null): void => {
          if (e !== null && e !== undefined) {
            console.error(e);
            if (reject !== undefined) {
              reject(e);
            }
          } else if (resolve !== undefined) {
            resolve();
          }
        };
      }

      const inStream = pipeline(
        fs.createReadStream(path.join(__dirname, inFileName)),
        csv_read.parse(parserOptions).once('data', (record) => {
          resolveHeaders(Object.keys(record));
        }),
        new LambdaTransform((o: object) => JSON.stringify(o)),
        new LambdaTransform(incrCountIn),
        pipelineCompleteHandler('read'),
      );

      const shuffled = await shuffle(
        new StreamToAsyncIterator(inStream),
        numPiles,
        pileDirPath,
      );

      const outStream = headers.then(
        (h: string[]) =>
          new Promise((resolve, reject) =>
            pipeline(
              Readable.from(shuffled),
              new LambdaTransform(incrCountOut),
              new LambdaTransform((line: string) => JSON.parse(line)),
              csv_write.stringify({ columns: h, ...writeOptions }),
              fs.createWriteStream(path.join(__dirname, outFileName)),
              pipelineCompleteHandler('write', resolve, reject),
            ),
          ),
      );

      await outStream;
      expect(countOut).toEqual(countIn);
    },
  );
});

class LambdaTransform<T, U> extends Transform {
  constructor(private readonly f: (o: T) => U) {
    super({ objectMode: true });
  }

  _transform(
    _chunk: any,
    encoding: BufferEncoding,
    callback: TransformCallback,
  ) {
    try {
      callback(null, this.f(_chunk as T));
    } catch (e) {
      callback(e as Error);
    }
  }
}

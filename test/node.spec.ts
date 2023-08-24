import { Readable, Transform, TransformCallback } from 'stream';
import { pipeline } from 'stream/promises';
import NullWritable from 'null-writable';

// Bug report: https://github.com/nodejs/node/issues/49302
describe('stream.Transform', () => {
  it.failing('should emit drain events while flushing', async () => {
    const elements = range(3);
    const transform = new DelayTransform()
    const sink = new NullWritable({ objectMode: true, highWaterMark: 1 })
    sink.cork();
    const testPipeline = pipeline(
      Readable.from(elements, { highWaterMark: 1 }),
      transform,
      sink,
    );
    await new Promise(resolve => setTimeout(resolve, 10));
    sink.uncork();
    await testPipeline;
  });
});

class DelayTransform extends Transform {
  private readonly storedElements: any = [];

  constructor() {
    super({ objectMode: true, highWaterMark: 1 });
  }

 _transform(chunk: any, encoding: string | null, callback: TransformCallback) {
   this.storedElements.push(chunk);
   callback();
 }

 _flush(callback: TransformCallback) {
   this.flushStoredElements()
     .then(() => callback())
     .catch((e) => callback(e));
 }

 private async flushStoredElements(): Promise<void> {
   for (const item of this.storedElements) {
     await this.safePush(item);
   }
 }

 /** Push and resolve when it is safe to push again */
 private safePush(item: string): Promise<void> {
   if (this.push(item)) {
     return Promise.resolve();
   } else {
     return new Promise(resolve => {
       this.once('drain', resolve);
     });
   }
  }
}

function range(n: number): number[] {
  const elements = [];
  for (let i = 0; i < n; i++) {
    elements.push(i);
  }
  return elements;
}

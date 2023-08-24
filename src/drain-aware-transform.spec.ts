import { Readable, TransformCallback } from 'stream';
import { pipeline } from 'stream/promises';
import NullWritable from 'null-writable';
import { DrainAwareTransform } from './drain-aware-transform';

describe('DrainAwareTransform', () => {
  it('should handle backpressure in _transform', () => {
    return shouldHandleBackpressure(new ExpandingTransform(), range(2), 8);
  });

  it('should handle backpressure in _flush', () => {
    return shouldHandleBackpressure(new DelayTransform(), range(10), 10);
  });
});

async function shouldHandleBackpressure(
  transform: DrainAwareTestTransform,
  elements: any[],
  expectedOut: number,
) {
  const sink = new NullWritable({ objectMode: true, highWaterMark: 1 });
  sink.cork();
  const testPipeline = pipeline(
    Readable.from(elements, { highWaterMark: 1 }),
    transform,
    sink,
  );
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect((transform as DelayTransform).emittedElements).toBeLessThanOrEqual(2);
  sink.uncork();
  await testPipeline;
  expect((transform as DelayTransform).emittedElements).toEqual(expectedOut);
}

abstract class DrainAwareTestTransform extends DrainAwareTransform {
  emittedElements = 0;

  push(chunk: any, encoding?: BufferEncoding): boolean {
    if (chunk !== null) {
      this.emittedElements++;
    }
    return super.push(chunk, encoding);
  }
}

class DelayTransform extends DrainAwareTestTransform {
  private readonly storedElements: any = [];

  constructor() {
    super({ objectMode: true, highWaterMark: 1 });
  }

  _transform(chunk: any, encoding: string | null, callback: TransformCallback) {
    this.storedElements.push(chunk);
    callback();
  }

  _flush(callback: TransformCallback): void {
    this.flushStoredElements()
      .then(() => callback())
      .catch((e) => callback(e));
  }

  private async flushStoredElements(): Promise<void> {
    for (const item of this.storedElements) {
      await this.safePush(item);
    }
    return Promise.resolve();
  }
}

class ExpandingTransform extends DrainAwareTestTransform {
  constructor() {
    super({ objectMode: true, highWaterMark: 1 });
  }

  _transform(chunk: any, encoding: string | null, callback: TransformCallback) {
    this.expand(chunk).then(() => callback());
  }

  private async expand(chunk: any): Promise<void> {
    for (let i = 0; i < 4; i++) {
      await this.safePush(chunk);
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

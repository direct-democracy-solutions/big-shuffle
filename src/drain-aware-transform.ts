import * as stream from 'stream';

/** Backpressure-aware stream.Transform class
 *
 * Well-behaved node.js Readable streams should respect the Stream API
 * and stop pushing data when push() returns false. The problem is that
 * there is no built-in way for a Readable to know when its internal
 * buffer is drained enough to resume pushing.
 *
 * This class extends stream.Transform with an event 'continue' that is
 * analogous to the 'drain' event of stream.Writable. When push()
 * returns false, the transform waits until its buffer is drained and
 * the _read() private method is called again. Then 'continue' is
 * emitted and the transform can continue pushing data.
 *
 * A convenience class 'safePush' is also provided. 'safePush' pushes
 * data and then returns a Promise that resolves when it is safe to push
 * again.
 */
export abstract class DrainAwareTransform extends stream.Transform {
  private isDraining = false;

  push(chunk: any, encoding?: BufferEncoding): boolean {
    this.isDraining = !super.push(chunk, encoding);
    return !this.isDraining;
  }

  _read(size: number): void {
    if (this.isDraining) {
      this.isDraining = false;
      this.emit('continue');
    }
    return super._read(size);
  }

  /** Push and resolve when it is safe to push again */
  protected safePush(item: string): Promise<void> {
    if (this.push(item)) {
      return Promise.resolve();
    } else {
      return new Promise((resolve) => {
        this.once('continue', resolve);
      });
    }
  }
}

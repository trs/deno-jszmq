export type Frame = Uint8Array | string;
export type Msg = Frame[];

export const isFrameString = (frame: Frame): frame is string => typeof frame === 'string';

export const isFrameUint8Array = (frame: Frame): frame is Uint8Array =>
  // Object.prototype.toString.call(frame) === '[object Uint8Array]';
  ArrayBuffer.isView(frame);

export const frameToUint8Array = (frame: Frame): Uint8Array | undefined =>
  isFrameString(frame) ? new TextEncoder().encode(frame)
  : isFrameUint8Array(frame) ? frame
  : undefined;

export interface Endpoint<
  Data extends Record<string, unknown> = Record<string, never>,
> {
  send(msg: Msg): boolean;

  close(): void;
  readonly data?: Data;
  readonly address: string;
  routingKey: Uint8Array;
  routingKeyString: string;
  removeListener(
    event: string | symbol,
    // deno-lint-ignore no-explicit-any
    listener: (...args: any[]) => void,
  ): this;
  // deno-lint-ignore no-explicit-any
  on(event: string | symbol, listener: (...args: any[]) => void): this;
}

export interface Listener {
  readonly address: string;
  removeListener(
    event: string | symbol,
    listener: EventListenerOrEventListenerObject,
  ): this;
  on(event: string | symbol, listener: EventListenerOrEventListenerObject): this;
  close(): void;
}

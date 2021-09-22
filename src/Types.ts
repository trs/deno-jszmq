import { Buffer } from "https://deno.land/std@0.106.0/node/buffer.ts";
export { Buffer };

export type Frame = Buffer | string;
export type Msg = Frame[];

export interface IEndpoint<
  Data extends Record<string, unknown> = Record<string, never>,
> {
  send(msg: Msg): boolean;

  close(): void;
  readonly data?: Data;
  readonly address: string;
  routingKey: Buffer;
  routingKeyString: string;
  removeListener(
    event: string | symbol,
    // deno-lint-ignore no-explicit-any
    listener: (...args: any[]) => void,
  ): this;
  // deno-lint-ignore no-explicit-any
  on(event: string | symbol, listener: (...args: any[]) => void): this;
}

export interface IListener {
  readonly address: string;
  removeListener(
    event: string | symbol,
    // deno-lint-ignore no-explicit-any
    listener: (...args: any[]) => void,
  ): this;
  // deno-lint-ignore no-explicit-any
  on(event: string | symbol, listener: (...args: any[]) => void): this;
  close(): void;
}
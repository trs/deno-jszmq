import { SocketOptions } from "./SocketOptions.ts";
import { Endpoint, Msg } from "./Types.ts";

enum State {
  Closed,
  Connecting,
  Reconnecting,
  Active,
}

export class WebSocketEndpoint<Data extends Record<string, unknown>>
  implements Endpoint<Data>
{
  #eventTarget = new EventTarget();
  #socket!: WebSocket;
  #state: State;
  #frames: Uint8Array[] = [];
  #queue: Uint8Array[] = [];
  #options: SocketOptions;
  #routingIdReceived = false;
  #accepted: boolean;
  public routingKey: Uint8Array = new Uint8Array(0);
  public routingKeyString = "";
  public readonly address: string;
  public readonly data?: Data;

  public constructor(
    address: string | WebSocket,
    options: SocketOptions,
    data: Data,
  ) {
    this.#options = options;
    this.data = data;
    this.connect = this.connect.bind(this);

    if (typeof address === "string") {
      this.address = address;
      this.#state = State.Connecting;
      this.#accepted = false;

      this.connect();
    } else {
      this.#routingIdReceived = false;
      this.address = "";
      this.#socket = address;
      this.#accepted = true;
      this.#state = State.Active;
      this.#socket.binaryType = "arraybuffer";
      this.#socket.onclose = this.onClose.bind(this);
      this.#socket.onmessage = this.onMessage.bind(this);
      this.send([this.#options.routingId]);
    }
  }

  private connect(): void {
    if (this.#state === State.Closed) {
      return; // The socket was already closed, abort
    }

    this.#routingIdReceived = false;
    this.#socket = new WebSocket(this.address, ["ZWS2.0"]);
    this.#socket.binaryType = "arraybuffer";
    this.#socket.onopen = this.onOpen.bind(this);
    this.#socket.onclose = this.onClose.bind(this);
    this.#socket.onmessage = this.onMessage.bind(this);
  }

  private onOpen(): void {
    const oldState = this.#state;
    this.#state = State.Active;

    this.send([this.#options.routingId]);
    this.#queue.forEach((frame) => this.#socket.send(frame));
    this.#queue = [];

    if (this.#options.immediate) {
      this.#eventTarget.dispatchEvent(new CustomEvent("attach", {detail: this}));
    } else if (oldState === State.Reconnecting) {
      this.#eventTarget.dispatchEvent(new CustomEvent("hiccuped", {detail: this}));
    }
  }

  private onClose(): void {
    if (this.#accepted) {
      this.#state = State.Closed;
      this.#eventTarget.dispatchEvent(new CustomEvent("terminated", {detail: this}));
    } else if (this.#state !== State.Closed) {
      if (
        (this.#state === State.Active ||
          this.#state === State.Connecting) &&
        this.#options.immediate
      ) {
        this.#eventTarget.dispatchEvent(new CustomEvent("terminated", {detail: this}));
      }

      if (this.#state === State.Active) {
        this.#state = State.Reconnecting;
      }

      setTimeout(this.connect, this.#options.reconnectInterval);
    }
  }

  private error(): void {
    this.#socket.close();
  }

  private onMessage(message: {data: unknown}): void {
    if (!this.#routingIdReceived) {
      this.#routingIdReceived = true;

      if (!this.#options.recvRoutingId) {
        return;
      }
    }

    if (message.data instanceof Uint8Array || message.data instanceof ArrayBuffer) {
      const buffer = new Uint8Array(message.data);

      if (buffer.length > 0) {
        const more = buffer.at(0) === 1;
        const msg = buffer.slice(1);

        this.#frames.push(msg);

        if (!more) {
          this.#eventTarget.dispatchEvent(new CustomEvent("message", {
            detail: [this, ...this.#frames]
          }));
          this.#frames = [];
        }
      } else {
        this.error();
      }
    } else {
      this.error();
    }
  }

  public removeListener(
    event: string,
    listener: EventListenerOrEventListenerObject | null,
  ) {
    this.#eventTarget.removeEventListener(event, listener);
    return this;
  }

  public on(event: string, listener: EventListenerOrEventListenerObject) {
    this.#eventTarget.addEventListener(event, listener);
    return this;
  }

  public close(): void {
    if (this.#state !== State.Closed) {
      this.#state = State.Closed;

      if (
        this.#socket.readyState === this.#socket.CONNECTING ||
        this.#socket.readyState === this.#socket.OPEN
      ) {
        this.#socket.close();
      }

      this.#eventTarget.dispatchEvent(new CustomEvent("terminated", {detail: this}));
    }
  }

  public send(msg: Msg): boolean {
    if (this.#state === State.Closed) {
      return false;
    }

    for (let i = 0, len = msg.length; i < len; i++) {
      const isLast = i === len - 1;
      const flags = isLast ? 0 : 1;

      let frame = msg[i];

      if (typeof frame === "string") {
        frame = new TextEncoder().encode(frame);
      } else if (
        frame instanceof ArrayBuffer ||
        frame instanceof Uint8Array
      ) {
        // Nothing to do, use as is
      } else {
        throw new Error("invalid message type");
      }

      const buffer = new Uint8Array([flags, ...frame]);

      if (this.#state === State.Active) {
        this.#socket.send(buffer);
      } else {
        this.#queue.push(buffer);
      }
    }

    return true;
  }
}

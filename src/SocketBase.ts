import { SocketOptions } from "./SocketOptions.ts";
import { find, pull } from "https://cdn.skypack.dev/lodash";
import { Endpoint, Frame, Listener, Msg, isFrameUint8Array } from "./Types.ts";
import { WebSocketListener } from "./WebSocketListener.ts";
import { WebSocketEndpoint } from "./WebSocketEndpoint.ts";
import { HttpHandler } from "./HttpHandler.ts";

export class SocketBase {
  #endpoints: Endpoint[] = [];
  #binds: Listener[] = [];
  #eventTarget = new EventTarget();
  public readonly options = new SocketOptions();

  public constructor() {
    this.bindAttachEndpoint = this.bindAttachEndpoint.bind(this);
    this.bindEndpointTerminated = this.bindEndpointTerminated.bind(this);
    this.attachEndpoint = this.attachEndpoint.bind(this);
    this.endpointTerminated = this.endpointTerminated.bind(this);
    this.xrecv = this.xrecv.bind(this);
    this.hiccuped = this.hiccuped.bind(this);
  }

  public connect(address: string): void {
    if (address.startsWith("ws://") || address.startsWith("wss://")) {
      const endpoint = new WebSocketEndpoint(address, this.options, {});
      endpoint.on("attach", this.attachEndpoint as EventListener);
      endpoint.on("terminated", this.endpointTerminated as EventListener);
      endpoint.on("message", this.xrecv as EventListener);
      endpoint.on("hiccuped", this.hiccuped as EventListener);
      this.#endpoints.push(endpoint);

      if (!this.options.immediate) {
        this.attachEndpoint({detail: endpoint} as CustomEvent);
      }
    } else {
      throw new Error("unsupported transport");
    }
  }

  public disconnect(address: string): void {
    const endpoint = find(
      this.#endpoints,
      (e: Endpoint) => e.address === address,
    );

    if (endpoint) {
      endpoint.removeListener("attach", this.attachEndpoint);
      endpoint.removeListener("terminated", this.endpointTerminated);
      endpoint.removeListener("message", this.xrecv);
      endpoint.removeListener("hiccuped", this.hiccuped);
      endpoint.close();
      pull(this.#endpoints, endpoint);
      this.endpointTerminated(endpoint);
    }
  }

  public bind<Data extends Record<string, unknown>>(
    server: HttpHandler<Data>,
    address: string = server.address,
  ): void {
    const listener = new WebSocketListener(address, server, this.options);
    listener.on("attach", this.bindAttachEndpoint as EventListener);
    this.#binds.push(listener);
  }

  public unbind(address: string): void {
    const listener = find(
      this.#binds,
      (b: Listener) => b.address === address,
    );

    if (listener) {
      listener.removeListener("attach", this.attachEndpoint);
      listener.close();
      pull(this.#binds, listener);
    }
  }

  public close(): void {
    this.#binds.forEach((listener) => {
      listener.removeListener("attach", this.attachEndpoint as EventListener);
      listener.close();
    });

    this.#binds = [];

    this.#endpoints.forEach((endpoint) => {
      endpoint.removeListener("attach", this.attachEndpoint);
      endpoint.removeListener("terminated", this.endpointTerminated);
      endpoint.removeListener("message", this.xrecv);
      endpoint.removeListener("hiccuped", this.hiccuped);
      endpoint.close();
      pull(this.#endpoints, endpoint);
      this.endpointTerminated({detail: endpoint} as CustomEvent);
    });
  }

  public emit<T extends unknown[]>(
    eventName: string,
    endpoint: Endpoint,
    ...args: T
  ): boolean {
    return this.#eventTarget.dispatchEvent(new CustomEvent(eventName, {
      detail: [endpoint, ...args]
    }))
  }

  public addListener<T extends unknown[]>(
    eventName: string,
    listener: (endpoint: Endpoint,
    ...args: T) => void
  ): void {
    this.#eventTarget.addEventListener(eventName, ((e: CustomEvent<[Endpoint, ...T]>) => {
      const [endpoint, ...args] = e.detail;
      return listener(endpoint, ...args);
    }) as EventListener);
  }

  public subscribe(_topic: Frame): void {
    throw new Error("not supported");
  }

  public unsubscribe(_topic: Frame): void {
    throw new Error("not supported");
  }

  private bindAttachEndpoint(event: CustomEvent<Endpoint>): void {
    event.detail.on("terminated", this.bindEndpointTerminated);
    event.detail.on("message", this.xrecv);

    this.attachEndpoint(event);
  }

  private bindEndpointTerminated(event: CustomEvent<Endpoint>): void {
    event.detail.removeListener("terminated", this.bindEndpointTerminated);
    event.detail.removeListener("message", this.xrecv);

    this.endpointTerminated(event);
  }

  protected attachEndpoint(_event: CustomEvent<Endpoint>): void {}

  protected endpointTerminated(_event: CustomEvent<Endpoint>): void {}

  protected hiccuped(_event: CustomEvent<Endpoint>): void {}

  protected xrecv(_event: CustomEvent<[Endpoint, ...Uint8Array[]]>): void {}

  protected xsend(_msg: Msg): void {}

  public send(msg: Msg | Frame): void {
    const encoder = new TextEncoder();
    const messages = (Array.isArray(msg) ? msg : [msg])
      .map((m) => !isFrameUint8Array(m) ? encoder.encode(m.toString()) : m);

    this.xsend(messages);
  }
}

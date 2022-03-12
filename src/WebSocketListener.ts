import { SocketOptions } from "./SocketOptions.ts";
import { WebSocketEndpoint as Endpoint } from "./WebSocketEndpoint.ts";
import { Listener } from "./Types.ts";
import { HttpHandler } from "./HttpHandler.ts";

export class WebSocketListener<Data extends Record<string, unknown>>
  implements Listener
{
  public readonly path: string | undefined;
  #endPoint?: Endpoint<Data>;
  #eventTarget = new EventTarget();

  public constructor(
    public address: string,
    private httpServer: HttpHandler<Data>,
    private options: SocketOptions,
  ) {
    this.onConnection = this.onConnection.bind(this);

    if (!Deno) {
      throw "binding websocket is not supported on browser";
    }

    const url = new URL(address);
    this.path = url.pathname;

    this.httpServer.registerPath(url.pathname, this);
  }

  public onConnection(connection: WebSocket, data: Data): void {
    this.#endPoint = new Endpoint(connection, this.options, data);
    this.#eventTarget.dispatchEvent(new CustomEvent('attach', {detail: this.#endPoint}));
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
    if (this.path) {
      this.httpServer.removePath(this.path);
    }
    this.#endPoint?.close();
  }
}

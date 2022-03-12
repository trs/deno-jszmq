import { SocketBase } from "./SocketBase.ts";
import { includes, pull } from "https://cdn.skypack.dev/lodash";
import { Endpoint, Msg, isFrameUint8Array } from "./Types.ts";

export class Router extends SocketBase {
  #anonymousPipes: Endpoint[] = [];
  #pipes: Map<string, Endpoint> = new Map<string, Endpoint>();
  protected nextId = 0;

  public constructor() {
    super();
    this.options.recvRoutingId = true;
  }

  protected attachEndpoint(event: CustomEvent<Endpoint>): void {
    this.#anonymousPipes.push(event.detail);
  }

  protected endpointTerminated(event: CustomEvent<Endpoint>): void {
    this.#pipes.delete(event.detail.routingKeyString);
    pull(this.#anonymousPipes, event.detail);
  }

  protected xrecv(event: CustomEvent<[Endpoint, ...Uint8Array[]]>): void {
    const [endpoint, ...msg] = event.detail;
    // For anonymous pipe, the first message is the identity
    if (includes(this.#anonymousPipes, endpoint)) {
      pull(this.#anonymousPipes, endpoint);

      const routingKey = msg[0];
      if (routingKey.length > 0) {

        endpoint.routingKey = new Uint8Array([0, ...routingKey]);
      } else {
        const buffer = new Uint8Array(5);
        buffer.set([1], 0);
        buffer.set([this.nextId], 1);
        endpoint.routingKey = buffer;
        this.nextId++;
      }

      endpoint.routingKeyString = endpoint.routingKey.toString();
      this.#pipes.set(endpoint.routingKeyString, endpoint);

      return;
    }

    this.xxrecv(endpoint, endpoint.routingKey, ...msg);
  }

  protected xxrecv(endpoint: Endpoint, ...msg: Uint8Array[]): void {
    this.emit("message", endpoint, ...msg);
  }

  protected xsend(msg: Msg): void {
    if (msg.length <= 1) {
      throw new Error("router message must include a routing key");
    }

    const routingKey = msg.shift();
    if (routingKey == null || !isFrameUint8Array(routingKey)) {
      throw new Error("routing key must be a buffer");
    }

    const endpoint = this.#pipes.get(routingKey.toString());
    if (!endpoint) {
      return; // TODO: use mandatory option, if true throw exception here
    }

    endpoint.send(msg);
  }
}

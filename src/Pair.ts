import { SocketBase } from "./SocketBase.ts";
import { Endpoint, Msg } from "./Types.ts";

export class Pair extends SocketBase {
  #endpoint?: Endpoint;
  #pending: Msg[] = [];

  protected attachEndpoint(event: CustomEvent<Endpoint>): void {
    if (this.#endpoint) {
      event.detail.close();
      return;
    }

    this.#endpoint = event.detail;

    for (;;) {
      const msg = this.#pending.shift();
      if (!msg) {
        break;
      }

      if (!event.detail.send(msg)) {
        break;
      }
    }
  }

  protected endpointTerminated(event: CustomEvent<Endpoint>): void {
    if (event.detail === this.#endpoint) {
      this.#endpoint = undefined;
    }
  }

  protected xrecv(event: CustomEvent<[Endpoint, ...Uint8Array[]]>): void {
    const [endpoint, ...frames] = event.detail;
    if (endpoint === this.#endpoint) {
      this.emit("message", endpoint, ...frames);
    }
  }

  protected xsend(msg: Msg): void {
    if (this.#endpoint) {
      this.#endpoint.send(msg);
    } else {
      this.#pending.push(msg);
    }
  }
}

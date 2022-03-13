import { SocketBase } from "./SocketBase.ts";
import { LoadBalancer } from "./utils/LoadBalancer.ts";
import { Endpoint, Msg } from "./Types.ts";

export class Dealer extends SocketBase {
  #loadBalancer = new LoadBalancer();
  #pending: Msg[] = [];

  protected attachEndpoint(event: CustomEvent<Endpoint>): void {
    this.#loadBalancer.attach(event.detail);

    for (;;) {
      const msg = this.#pending.shift();
      if (!msg) {
        break;
      }

      if (!this.#loadBalancer.send(msg)) {
        break;
      }
    }
  }

  protected endpointTerminated(event: CustomEvent<Endpoint>): void {
    this.#loadBalancer.terminated(event.detail);
  }

  protected xrecv(event: CustomEvent<[Endpoint, ...Uint8Array[]]>): void {
    const [endpoint, ...frames] = event.detail;
    this.emit("message", endpoint, ...frames);
  }

  protected xsend(msg: Msg): void {
    if (!this.#loadBalancer.send(msg)) {
      this.#pending.push(msg);
    }
  }
}

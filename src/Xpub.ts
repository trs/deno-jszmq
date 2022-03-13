import { SocketBase } from "./SocketBase.ts";
import { Endpoint, Msg, isFrameUint8Array } from "./Types.ts";
import { MultiTrie } from "./utils/MultiTrie.ts";
import { Distribution } from "./utils/Distribution.ts";

export class XPub extends SocketBase {
  #subscriptions = new MultiTrie();
  #distribution = new Distribution();

  public constructor() {
    super();

    this.markAsMatching = this.markAsMatching.bind(this);
    this.sendUnsubscription = this.sendUnsubscription.bind(this);
  }

  private markAsMatching(endpoint: Endpoint): void {
    this.#distribution.match(endpoint);
  }

  protected sendUnsubscription(
    endpoint: Endpoint,
    data: Uint8Array,
    size: number,
  ): void {
    const unsubscription = new Uint8Array([
      0, ...data.slice(0, size)
    ]);

    endpoint.send([unsubscription]);
  }

  protected attachEndpoint(event: CustomEvent<Endpoint>): void {
    this.#distribution.attach(event.detail);
  }

  protected endpointTerminated(event: CustomEvent<Endpoint>): void {
    this.#subscriptions.removeEndpoint(event.detail, this.sendUnsubscription);
    this.#distribution.terminated(event.detail);
  }

  protected xsend(msg: Msg): void {
    let topic: Uint8Array;

    if (isFrameUint8Array(msg[0])) {
      topic = msg[0];
    } else {
      topic = new TextEncoder().encode(msg[0]);
    }

    this.#subscriptions.match(topic, 0, topic.length, this.markAsMatching);
    this.#distribution.sendToMatching(msg);
  }

  protected xrecv(
    event: CustomEvent<[Endpoint, ...Uint8Array[]]>
  ): void {
    const [endpoint, subscription, ...frames] = event.detail;

    if (subscription.length > 0) {
      const type = subscription.at(0);
      if (type === 0 || type === 1) {
        let unique;

        if (type === 0) {
          unique = this.#subscriptions.remove(
            subscription,
            1,
            subscription.length - 1,
            endpoint,
          );
        } else {
          unique = this.#subscriptions.add(
            subscription,
            1,
            subscription.length - 1,
            endpoint,
          );
        }

        if (unique || this.options.xpubVerbose) {
          this.xxrecv({detail: [endpoint, subscription, ...frames]} as CustomEvent);
        }

        return;
      }
    }

    this.xxrecv({detail: [endpoint, subscription, ...frames]} as CustomEvent);
  }

  protected xxrecv(event: CustomEvent<[Endpoint, ...Uint8Array[]]>): void {
    const [endpoint, ...frames] = event.detail;
    this.emit("message", endpoint, ...frames);
  }
}

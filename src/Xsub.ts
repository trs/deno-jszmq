import { SocketBase } from "./SocketBase.ts";
import { Endpoint, Msg, isFrameUint8Array } from "./Types.ts";
import { Trie } from "./utils/Trie.ts";
import { Distribution } from "./utils/Distribution.ts";

export class XSub extends SocketBase {
  #subscriptions: Trie;
  #distribution: Distribution;

  public constructor() {
    super();
    this.#subscriptions = new Trie();
    this.#distribution = new Distribution();
  }

  protected attachEndpoint(event: CustomEvent<Endpoint>): void {
    this.#distribution.attach(event.detail);

    this.#subscriptions.forEach((s) =>
      event.detail.send([new Uint8Array([1, ...s])])
    );
  }

  protected hiccuped(event: CustomEvent<Endpoint>): void {
    this.#subscriptions.forEach((s) =>
      event.detail.send([new Uint8Array([1, ...s])])
    );
  }

  protected endpointTerminated(event: CustomEvent<Endpoint>): void {
    this.#distribution.terminated(event.detail);
  }

  protected xrecv(event: CustomEvent<[Endpoint, ...Uint8Array[]]>): void {
    const [endpoint, ...frames] = event.detail;
    const topic = frames[0];

    const subscribed = this.#subscriptions.check(topic, 0, topic.length);
    if (subscribed) {
      this.emit("message", endpoint, ...frames);
    }
  }

  protected xsend(msg: Msg): void {
    const frame = msg[0];

    if (!isFrameUint8Array(frame)) {
      throw new Error("subscription must be a buffer");
    }

    if (frame.length > 0 && frame.at(0) === 1) {
      this.#subscriptions.add(frame, 1, frame.length - 1);
      this.#distribution.sendToAll(msg);
    } else if (frame.length > 0 && frame.at(0) === 0) {
      // Removing only one subscriptions
      const removed = this.#subscriptions.remove(
        frame,
        1,
        frame.length - 1,
      );
      if (removed) {
        this.#distribution.sendToAll(msg);
      }
    } else {
      // upstream message unrelated to sub/unsub
      this.#distribution.sendToAll(msg);
    }
  }
}

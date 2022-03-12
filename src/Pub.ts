import { XPub } from "./Xpub.ts";
import { Endpoint } from "./Types.ts";

export class Pub extends XPub {
  protected xxrecv(_event: CustomEvent<[Endpoint, ...Uint8Array[]]>): void {
    // Drop any message sent to pub socket
  }

  protected sendUnsubscription(): void {}
}

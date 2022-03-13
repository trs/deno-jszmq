import { Dealer } from "./Dealer.ts";
import { Endpoint, Msg } from "./Types.ts";

export class Req extends Dealer {
  private static bottom = new Uint8Array(0);

  // If true, request was already sent and reply wasn't received yet or
  // was received partially.
  receivingReply: boolean;

  public constructor() {
    super();
    this.receivingReply = false;
  }

  protected xsend(msg: Msg): void {
    // If we've sent a request and we still haven't got the reply,
    // we can't send another request.
    if (this.receivingReply) {
      throw new Error("cannot send another request");
    }

    const withBottom = [Req.bottom, ...msg];
    super.xsend(withBottom);

    this.receivingReply = true;
  }


  protected xrecv(event: CustomEvent<[Endpoint, ...Uint8Array[]]>): void {
    const [endpoint, bottom, ...frames] = event.detail;
    // If request wasn't send, we can't process reply, drop.
    if (!this.receivingReply) {
      return;
    }

    //  Skip messages until one with the right first frames is found.
    if (frames.length === 0 || bottom.length !== 0) {
      return;
    }

    this.receivingReply = false;

    super.xrecv({detail: [endpoint, ...frames]} as CustomEvent);
  }
}

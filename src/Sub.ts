import { XSub } from "./Xsub.ts";
import { Frame, Msg, frameToUint8Array } from "./Types.ts";

export class Sub extends XSub {
  public subscribe(topic: Frame): void {
    const topicTypedArray = frameToUint8Array(topic);
    if (!topicTypedArray) {
      throw new Error("unsupported topic type");
    }

    const frame = new Uint8Array([1, ...topicTypedArray]);
    super.xsend([frame]);
  }

  public unsubscribe(topic: Frame): void {
    const topicTypedArray = frameToUint8Array(topic);

    if (!topicTypedArray) {
      throw new Error("unsupported topic type");
    }

    const frame = new Uint8Array([0, ...topicTypedArray]);
    super.xsend([frame]);
  }

  protected xsend(_msg: Msg): void {
    throw new Error("not supported");
  }
}

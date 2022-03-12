import { SocketBase } from "./SocketBase.ts";
import { Endpoint } from "./Types.ts";

export class Pull extends SocketBase {
  protected xrecv(event: CustomEvent<[Endpoint, ...Uint8Array[]]>): void {
    const [endpoint, ...frames] = event.detail;
    this.emit("message", endpoint, ...frames);
  }
}

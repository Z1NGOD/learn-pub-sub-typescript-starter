import { encode } from "@msgpack/msgpack";
import type { ConfirmChannel } from "amqplib";

export function publishMsgPack<T>(
  ch: ConfirmChannel,
  exchange: string,
  routingKey: string,
  value: T,
): void {
  const encoded = encode(value);
  const buffer: Buffer = Buffer.from(
    encoded.buffer,
    encoded.byteOffset,
    encoded.byteLength,
  );
  ch.publish(exchange, routingKey, buffer, {
    contentType: "application/x-msgpack",
  });
}

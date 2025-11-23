import type { ConfirmChannel } from "amqplib";

export function publishJSON<T>(
  ch: ConfirmChannel,
  exchange: string,
  routingKey: string,
  value: T,
): void {
  const bytes = Buffer.from(JSON.stringify(value), "utf8");
  ch.publish(exchange, routingKey, bytes, { contentType: "application/json" });
}

import amqp from "amqplib";
import { declareAndBind } from "./declareAndBind.js";
import { decode } from "@msgpack/msgpack";
type SimpleQueueType = "durable" | "transient";
type AckType = "Ack" | "NackRequeue" | "NackDiscard";

export async function subscribeMsgPack<T>(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  routingKey: string,
  simpleQueueType: SimpleQueueType,
  handler: (data: T) => Promise<AckType> | AckType,
): Promise<void> {
  const [ch, queue] = await declareAndBind(
    conn,
    exchange,
    queueName,
    routingKey,
    simpleQueueType,
  );
  ch.prefetch(10);
  ch.consume(queue.queue, (msg) => {
    if (msg !== null) {
      const decodedMsg = decode(msg.content);
      const ackType = handler(decodedMsg as T);

      switch (ackType) {
        case "Ack":
          ch.ack(msg);
          break;

        case "NackRequeue":
          ch.nack(msg, false, true);
          break;

        case "NackDiscard":
          ch.nack(msg, false, false);
          break;

        default:
          break;
      }
    }
  });
}

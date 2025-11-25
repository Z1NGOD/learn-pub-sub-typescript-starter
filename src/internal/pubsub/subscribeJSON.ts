import amqp from "amqplib";
import { declareAndBind } from "./declareAndBind.js";
type SimpleQueueType = "durable" | "transient";

export async function subscribeJSON<T>(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType,
  handler: (data: T) => void,
): Promise<void> {
  const [ch, queue] = await declareAndBind(
    conn,
    exchange,
    queueName,
    key,
    queueType,
  );
  ch.consume(queue.queue, (msg) => {
    if (msg !== null) {
      const parsedMsg = JSON.parse(msg.content.toString("utf8"));
      handler(parsedMsg);
      ch.ack(msg);
    }
  });
}

import amqp from "amqplib";
import { declareAndBind } from "./declareAndBind.js";
type SimpleQueueType = "durable" | "transient";

type AckType = "Ack" | "NackRequeue" | "NackDiscard";

export async function subscribeJSON<T>(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType,
  handler: (data: T) => AckType,
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

      const ackType = handler(parsedMsg);

      switch (ackType) {
        case "Ack":
          ch.ack(msg);
          console.log("acknoleged");
          break;

        case "NackRequeue":
          ch.nack(msg, false, true);
          console.log("fuck you");
          break;

        case "NackDiscard":
          ch.nack(msg, false, false);
          console.log("fuck you**2");

          break;

        default:
          break;
      }
    }
  });
}

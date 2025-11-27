import amqp, { type Channel } from "amqplib";

type SimpleQueueType = "durable" | "transient";

/**
 * @returns [channel, queue]
 */
export async function declareAndBind(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType,
): Promise<[Channel, amqp.Replies.AssertQueue]> {
  const ch = await conn.createChannel();

  const args = {
    durable: queueType === "durable",
    autoDelete: queueType === "transient",
    exclusive: queueType === "transient",
    arguments: { "x-dead-letter-exchange": "peril_dlx" },
  };

  const queue = await ch.assertQueue(queueName, args);
  await ch.bindQueue(queueName, exchange, key);

  return [ch, queue];
}

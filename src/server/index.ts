import amqp from "amqplib";
import { publishJSON } from "../internal/pubsub/publishJSON.js";
import {
  ExchangePerilDirect,
  ExchangePerilTopic,
  GameLogSlug,
  PauseKey,
} from "../internal/routing/routing.js";
import type { PlayingState } from "../internal/gamelogic/gamestate.js";
import {
  closeInput,
  getInput,
  printServerHelp,
} from "../internal/gamelogic/gamelogic.js";
import { declareAndBind } from "../internal/pubsub/declareAndBind.js";

const connectionString = "amqp://guest:guest@localhost:5672/";

const state: PlayingState = { isPaused: true };

async function main() {
  console.log("Starting Peril server...");
  const connection = await amqp.connect(connectionString);
  if (connection.connection) {
    console.log("Started succesfully");
    const confirmedChannel = await connection.createConfirmChannel();
    const [channel, _] = await declareAndBind(
      connection,
      ExchangePerilTopic,
      GameLogSlug,
      `${GameLogSlug}.*`,
      "durable",
    );
    printServerHelp();

    outer: while (true) {
      const input = await getInput();
      if (input.length === 0) continue;
      switch (input[0]) {
        case "pause":
          console.log("Sending a pause message");
          publishJSON(confirmedChannel, ExchangePerilDirect, PauseKey, state);
          break;

        case "resume":
          console.log("Sending a resume message");
          publishJSON(
            confirmedChannel,
            ExchangePerilDirect,
            PauseKey,
            (state.isPaused = false),
          );
          break;

        case "quit":
          console.log("Quitting the queue");
          closeInput();
          confirmedChannel.close();
          connection.close();
          break outer;

        default:
          console.log("I dont understand the command");
          break;
      }
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

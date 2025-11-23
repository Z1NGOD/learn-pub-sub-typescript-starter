import amqp from "amqplib";
import { ExchangePerilDirect, PauseKey } from "../internal/routing/routing.js";
import {
  clientWelcome,
  closeInput,
  commandStatus,
  getInput,
  printClientHelp,
  printQuit,
} from "../internal/gamelogic/gamelogic.js";
import { declareAndBind } from "../internal/pubsub/declareAndBind.js";
import { GameState } from "../internal/gamelogic/gamestate.js";
import { commandSpawn } from "../internal/gamelogic/spawn.js";
import { commandMove } from "../internal/gamelogic/move.js";

const connectionString = "amqp://guest:guest@localhost:5672/";

async function main() {
  console.log("Starting Peril client...");
  const connection = await amqp.connect(connectionString);
  if (connection.connection) {
    console.log("Started succesfully");
    const username = await clientWelcome();
    const [channel, _] = await declareAndBind(
      connection,
      ExchangePerilDirect,
      `${PauseKey}.${username}`,
      PauseKey,
      "transient",
    );
    const game = new GameState(username);
    outer: while (true) {
      const input = await getInput();
      if (input.length === 0) continue;

      switch (input[0]) {
        case "spawn":
          commandSpawn(game, input);
          break;

        case "move":
          commandMove(game, input);
          break;

        case "status":
          commandStatus(game);
          break;

        case "help":
          printClientHelp();
          break;

        case "spam":
          console.log("Spamming not allowed yet!");
          break;

        case "quit":
          printQuit();
          closeInput();
          await channel.close();
          await connection.close();
          break outer;

        default:
          console.error("I dont know this command");
          break;
      }
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

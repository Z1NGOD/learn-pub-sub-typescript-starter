import amqp from "amqplib";
import {
  ExchangePerilDirect,
  ExchangePerilTopic,
  PauseKey,
} from "../internal/routing/routing.js";
import {
  clientWelcome,
  closeInput,
  commandStatus,
  getInput,
  printClientHelp,
  printQuit,
} from "../internal/gamelogic/gamelogic.js";
import { declareAndBind } from "../internal/pubsub/declareAndBind.js";
import {
  GameState,
  type PlayingState,
} from "../internal/gamelogic/gamestate.js";
import { commandSpawn } from "../internal/gamelogic/spawn.js";
import { commandMove, handleMove } from "../internal/gamelogic/move.js";
import { handlePause } from "../internal/gamelogic/pause.js";
import { subscribeJSON } from "../internal/pubsub/subscribeJSON.js";
import type { ArmyMove } from "../internal/gamelogic/gamedata.js";
import { publishJSON } from "../internal/pubsub/publishJSON.js";

const connectionString = "amqp://guest:guest@localhost:5672/";
function handlerPause(gs: GameState): (ps: PlayingState) => void {
  return (ps: PlayingState) => {
    handlePause(gs, ps);
    process.stdout.write("> ");
  };
}
function handlerMove(gs: GameState): (move: ArmyMove) => void {
  return (move: ArmyMove) => {
    handleMove(gs, move);
    process.stdout.write("> ");
  };
}

async function main() {
  console.log("Starting Peril client...");
  const connection = await amqp.connect(connectionString);
  if (connection.connection) {
    console.log("Started succesfully");
    const confirmedChannel = await connection.createConfirmChannel();
    const username = await clientWelcome();
    const [channel, _] = await declareAndBind(
      connection,
      ExchangePerilDirect,
      `${PauseKey}.${username}`,
      PauseKey,
      "transient",
    );
    const [movesChannel, __] = await declareAndBind(
      connection,
      ExchangePerilTopic,
      `army_moves.${username}`,
      "army_moves.*",
      "transient",
    );
    const game = new GameState(username);
    await subscribeJSON(
      connection,
      ExchangePerilDirect,
      `${PauseKey}.${username}`,
      PauseKey,
      "transient",
      handlerPause(game),
    );
    await subscribeJSON(
      connection,
      ExchangePerilTopic,
      `army_moves.${username}`,
      "army_moves.*",
      "transient",
      handlerMove(game),
    );

    outer: while (true) {
      const input = await getInput();
      if (input.length === 0) continue;

      switch (input[0]) {
        case "spawn":
          commandSpawn(game, input);
          break;

        case "move":
          const move = commandMove(game, input);
          if (move) {
            publishJSON(
              confirmedChannel,
              ExchangePerilTopic,
              `army_moves.${username}`,
              move,
            );
            console.log("Move published succesfully");
          }
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
          await movesChannel.close();
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

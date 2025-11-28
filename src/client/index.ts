import amqp, { type ConfirmChannel } from "amqplib";
import {
  ArmyMovesPrefix,
  ExchangePerilDirect,
  ExchangePerilTopic,
  GameLogSlug,
  PauseKey,
  WarRecognitionsPrefix,
} from "../internal/routing/routing.js";
import {
  clientWelcome,
  closeInput,
  commandStatus,
  getInput,
  printClientHelp,
  printQuit,
} from "../internal/gamelogic/gamelogic.js";
import {
  GameState,
  type PlayingState,
} from "../internal/gamelogic/gamestate.js";
import { commandSpawn } from "../internal/gamelogic/spawn.js";
import {
  commandMove,
  handleMove,
  MoveOutcome,
} from "../internal/gamelogic/move.js";
import { handlePause } from "../internal/gamelogic/pause.js";
import { subscribeJSON } from "../internal/pubsub/subscribeJSON.js";
import type {
  ArmyMove,
  RecognitionOfWar,
} from "../internal/gamelogic/gamedata.js";
import { publishJSON } from "../internal/pubsub/publishJSON.js";
import { handleWar, WarOutcome } from "../internal/gamelogic/war.js";
import type { GameLog } from "../internal/gamelogic/logs.js";
import { publishMsgPack } from "../internal/pubsub/publish.js";

const connectionString = "amqp://guest:guest@localhost:5672/";
type AckType = "Ack" | "NackRequeue" | "NackDiscard";

function handlerPause(gs: GameState): (ps: PlayingState) => AckType {
  return (ps: PlayingState) => {
    handlePause(gs, ps);
    process.stdout.write("> ");
    return "Ack";
  };
}
function handlerMove(
  gs: GameState,
  ch?: ConfirmChannel,
  username?: string,
): (move: ArmyMove) => AckType {
  return (move: ArmyMove) => {
    const moveOutcome = handleMove(gs, move);
    process.stdout.write("> ");
    if (
      moveOutcome === MoveOutcome.Safe ||
      moveOutcome === MoveOutcome.MakeWar
    ) {
      if (moveOutcome === MoveOutcome.MakeWar) {
        try {
          const warMsg: RecognitionOfWar = {
            attacker: move.player,
            defender: gs.getPlayerSnap(),
          };
          publishJSON(
            ch!,
            ExchangePerilTopic,
            `${WarRecognitionsPrefix}.${username}`,
            warMsg,
          );
          return "Ack";
        } catch (_) {
          return "NackRequeue";
        }
      }
      return "Ack";
    } else {
      return "NackDiscard";
    }
  };
}

function handlerWar(
  gs: GameState,
  ch: ConfirmChannel,
  username: string,
): (ro: RecognitionOfWar) => AckType {
  return (ro: RecognitionOfWar) => {
    const wo = handleWar(gs, ro);
    if (wo.result === WarOutcome.NotInvolved) {
      return "NackRequeue";
    } else if (wo.result === WarOutcome.NoUnits) {
      return "NackDiscard";
    } else if (
      wo.result === WarOutcome.YouWon ||
      wo.result === WarOutcome.OpponentWon ||
      wo.result === WarOutcome.Draw
    ) {
      if (wo.result === WarOutcome.YouWon) {
        const { winner, loser } = wo;
        publishGameLog(ch, username, `${winner} won a war against ${loser}`);
      }
      if (wo.result === WarOutcome.OpponentWon) {
        const { winner, loser } = wo;
        publishGameLog(ch, username, `${winner} won a war against ${loser}`);
      }
      if (wo.result === WarOutcome.Draw) {
        const { attacker, defender } = wo;
        publishGameLog(
          ch,
          username,
          `A war between ${attacker} and ${defender} resulted in a draw`,
        );
      }

      return "Ack";
    } else {
      console.error("Could not process the war outcome");
      return "NackDiscard";
    }
  };
}

function publishGameLog(ch: ConfirmChannel, username: string, msg: string) {
  const gameLog: GameLog = {
    username: username,
    message: msg,
    currentTime: new Date(),
  };
  publishMsgPack(ch, ExchangePerilTopic, `${GameLogSlug}.${username}`, gameLog);
}

async function main() {
  console.log("Starting Peril client...");
  const connection = await amqp.connect(connectionString);
  if (connection.connection) {
    console.log("Started succesfully");
    const confirmedChannel = await connection.createConfirmChannel();
    const username = await clientWelcome();
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
      `${ArmyMovesPrefix}.${username}`,
      `${ArmyMovesPrefix}.*`,
      "transient",
      handlerMove(game, confirmedChannel, username),
    );
    await subscribeJSON(
      connection,
      ExchangePerilTopic,
      `${WarRecognitionsPrefix}`,
      `${WarRecognitionsPrefix}.*`,
      "durable",
      handlerWar(game, confirmedChannel, username),
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

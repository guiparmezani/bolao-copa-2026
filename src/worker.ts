import { prisma } from "@/lib/prisma";
import {
  finalizeFinishedMatches,
  openKnockoutPredictionsIfReady,
  syncLiveMatches,
  syncOfficialStandings,
  syncStaticTournamentData,
} from "@/lib/sync/tournament-sync";

const commands = {
  all: async () => ({
    staticTournamentData: await syncStaticTournamentData(),
    liveMatches: await syncLiveMatches(),
    finalizeFinishedMatches: await finalizeFinishedMatches(),
    officialStandings: await syncOfficialStandings(),
    openKnockoutPredictionsIfReady: await openKnockoutPredictionsIfReady(),
  }),
  static: syncStaticTournamentData,
  live: syncLiveMatches,
  finalize: finalizeFinishedMatches,
  standings: syncOfficialStandings,
  "open-knockout": openKnockoutPredictionsIfReady,
} as const;

type WorkerCommand = keyof typeof commands;

function getCommand(): WorkerCommand {
  const command = process.argv[2] ?? "all";

  if (command in commands) {
    return command as WorkerCommand;
  }

  throw new Error(
    `Unknown worker command "${command}". Use one of: ${Object.keys(commands).join(", ")}.`,
  );
}

async function main() {
  const command = getCommand();
  const result = await commands[command]();

  console.log(JSON.stringify({ command, result }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

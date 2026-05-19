export type RevealableMatch = {
  status: string;
  homeGoals: number | null;
  awayGoals: number | null;
};

export function canRevealMatchPredictions(match: RevealableMatch) {
  return match.status === "finished" && match.homeGoals !== null && match.awayGoals !== null;
}

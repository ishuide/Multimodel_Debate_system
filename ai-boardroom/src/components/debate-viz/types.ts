export interface DebateTurn {
  agent: string;
  claim: string;
  critiques: { target: string; strength: number }[];
  confidence: number;
}
export interface DebateRound {
  round: number;
  turns: DebateTurn[];
  contradictions: { a: string; b: string }[];
}

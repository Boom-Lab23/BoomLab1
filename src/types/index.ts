import type { Client, Session, Recording, Document, User } from "@prisma/client";

export type ClientWithRelations = Client & {
  sessions: Session[];
  recordings: Recording[];
  documents: Document[];
};

export type SessionWithRelations = Session & {
  client: Client;
  assignedTo: User | null;
  recordings: Recording[];
  documents: Document[];
};

export type RecordingWithRelations = Recording & {
  client: Client;
  session: Session | null;
};

export type AIAnalysisResult = {
  overallScore: number;
  scriptAdherence: number;
  criteria: {
    name: string;
    score: number;
    maxScore: number;
    feedback: string;
  }[];
  strengths: string[];
  improvements: string[];
  keyMoments: {
    timestamp: string;
    description: string;
    sentiment: "positive" | "negative" | "neutral";
  }[];
  summary: string;
};

export type CjmStage =
  | "Acquisition"
  | "Onboarding"
  | "Activation"
  | "Core Use"
  | "Billing"
  | "Retention"
  | "Support"
  | "Other";

export type Severity = "low" | "medium" | "high";
export type Confidence = "low" | "medium" | "high";
export type ExpectedImpact = "low" | "medium" | "high";
export type HypothesisStatus = "new" | "testing" | "validated" | "rejected";

export type AnalysisListItem = {
  id: string;
  createdAt: string;
  painPointsCount: number;
  hypothesesCount: number;
};

export type AnalysisDetails = {
  analysis: {
    id: string;
    createdAt: string;
  };
  painPoints: Array<{
    id: string;
    title: string;
    summary: string;
    evidenceCount: number;
    quotes: string[];
    cjmStage: CjmStage;
    severity: Severity;
    confidence: Confidence;
  }>;
  hypotheses: Array<{
    id: string;
    painPointId: string;
    title: string;
    hypothesis: string;
    expectedImpact: ExpectedImpact;
    confidence: Confidence;
    status: HypothesisStatus;
  }>;
};

export type DashboardData = {
  kpi: {
    analysesPerformed: number;
    painPointsDetected: number;
    hypothesesGenerated: number;
  };
  topCjmStages: Array<{ stage: CjmStage; share: number }>;
  hypothesisStatus: Array<{ status: HypothesisStatus; count: number }>;
};


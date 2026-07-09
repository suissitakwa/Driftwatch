export type EntitlementStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "none";

export interface CanonicalState {
  customerRef: string;
  status: EntitlementStatus;
  plan?: string;
  mrrCents?: number;
  email?: string;
}

export type DriftKind =
  | "paid_not_provisioned"
  | "canceled_still_active"
  | "plan_mismatch"
  | "trial_mismatch"
  | "missing_internal"
  | "missing_in_stripe";

export type Severity = "critical" | "high" | "medium" | "low";

export interface DriftFinding {
  kind: DriftKind;
  severity: Severity;
  customerRef: string;
  stripe?: CanonicalState;
  internal?: CanonicalState;
  summary: string;
  monthlyImpactCents: number;
}

export interface AuditResult {
  findings: DriftFinding[];
  stripeCount: number;
  internalCount: number;
  generatedAt: string;
}

export const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

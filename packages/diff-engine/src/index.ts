import {
  SEVERITY_ORDER,
  type AuditResult,
  type CanonicalState,
  type DriftFinding,
  type DriftKind,
  type Severity,
} from "@driftwatch/core";

function finding(
  kind: DriftKind,
  severity: Severity,
  customerRef: string,
  summary: string,
  monthlyImpactCents: number,
  stripe?: CanonicalState,
  internal?: CanonicalState,
): DriftFinding {
  return { kind, severity, customerRef, summary, monthlyImpactCents, stripe, internal };
}

const PROVISIONED: ReadonlySet<string> = new Set([
  "active",
  "trialing",
  "past_due",
]);

export function diffStates(
  stripeStates: CanonicalState[],
  internalStates: CanonicalState[],
): AuditResult {
  const findings: DriftFinding[] = [];
  const internalByRef = new Map(internalStates.map((s) => [s.customerRef, s]));
  const matched = new Set<string>();

  for (const s of stripeStates) {
    const i = internalByRef.get(s.customerRef);
    matched.add(s.customerRef);

    if (!i) {
      if (s.status === "active" || s.status === "trialing") {
        findings.push(
          finding(
            "missing_internal",
            "critical",
            s.customerRef,
            `Stripe has a ${s.status} subscription for ${s.customerRef} but no matching internal record exists`,
            s.mrrCents ?? 0,
            s,
          ),
        );
      }
      continue;
    }

    const paying = s.status === "active" || s.status === "past_due";
    const provisioned = PROVISIONED.has(i.status);

    if (paying && !provisioned) {
      findings.push(
        finding(
          "paid_not_provisioned",
          "critical",
          s.customerRef,
          `${s.customerRef} is ${s.status} in Stripe but ${i.status} internally — paying customer without access`,
          s.mrrCents ?? 0,
          s,
          i,
        ),
      );
    } else if (s.status === "canceled" && provisioned) {
      findings.push(
        finding(
          "canceled_still_active",
          "high",
          s.customerRef,
          `${s.customerRef} is canceled in Stripe but still ${i.status} internally — unbilled access`,
          s.mrrCents ?? 0,
          s,
          i,
        ),
      );
    } else if (s.status === "trialing" && i.status !== "trialing") {
      findings.push(
        finding(
          "trial_mismatch",
          "medium",
          s.customerRef,
          `${s.customerRef} is trialing in Stripe but ${i.status} internally`,
          0,
          s,
          i,
        ),
      );
    } else if (paying && s.plan && i.plan && s.plan !== i.plan) {
      findings.push(
        finding(
          "plan_mismatch",
          "high",
          s.customerRef,
          `${s.customerRef} is on ${s.plan} in Stripe but ${i.plan} internally`,
          0,
          s,
          i,
        ),
      );
    }
  }

  for (const i of internalStates) {
    if (matched.has(i.customerRef)) continue;
    if (i.status === "active" || i.status === "past_due") {
      findings.push(
        finding(
          "missing_in_stripe",
          "high",
          i.customerRef,
          `${i.customerRef} is ${i.status} internally but has no Stripe subscription — unbilled access`,
          0,
          undefined,
          i,
        ),
      );
    }
  }

  findings.sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      b.monthlyImpactCents - a.monthlyImpactCents,
  );

  return {
    findings,
    stripeCount: stripeStates.length,
    internalCount: internalStates.length,
    generatedAt: new Date().toISOString(),
  };
}

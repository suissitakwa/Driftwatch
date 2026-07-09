import { formatCents, type AuditResult } from "@driftwatch/core";

export function renderMarkdown(
  result: AuditResult,
  diagnosis: string,
): string {
  const critical = result.findings.filter((f) => f.severity === "critical");
  const atRiskCents = result.findings
    .filter((f) => f.kind === "paid_not_provisioned" || f.kind === "missing_internal")
    .reduce((sum, f) => sum + f.monthlyImpactCents, 0);
  const leakingCents = result.findings
    .filter((f) => f.kind === "canceled_still_active")
    .reduce((sum, f) => sum + f.monthlyImpactCents, 0);

  const lines: string[] = [
    "# driftwatch audit report",
    "",
    `Generated ${result.generatedAt} — compared ${result.stripeCount} Stripe subscriptions against ${result.internalCount} internal records.`,
    "",
    "## Summary",
    "",
    `- Findings: ${result.findings.length} (${critical.length} critical)`,
    `- MRR at risk (paying customers without access): ${formatCents(atRiskCents)}`,
    `- MRR leaking (unbilled access): ${formatCents(leakingCents)}`,
    "",
  ];

  if (result.findings.length > 0) {
    lines.push(
      "## Findings",
      "",
      "| Severity | Kind | Customer | Monthly impact | Detail |",
      "|---|---|---|---|---|",
    );
    for (const f of result.findings) {
      lines.push(
        `| ${f.severity} | ${f.kind} | ${f.customerRef} | ${formatCents(f.monthlyImpactCents)} | ${f.summary} |`,
      );
    }
    lines.push("");
  } else {
    lines.push("No drift detected. Stripe and your database agree.", "");
  }

  lines.push("## Agent diagnosis", "", diagnosis, "");
  return lines.join("\n");
}

import Anthropic from "@anthropic-ai/sdk";
import type { AuditResult } from "@driftwatch/core";

const ROOT_CAUSE_PROMPT = `You are the root-cause agent of driftwatch, a tool that detects state drift between Stripe and a SaaS application's own database.

You receive drift findings as JSON. The deterministic diff engine has already established the facts — do not question them. Your job:
1. For each drift kind present, hypothesize the most likely technical cause (failed webhook delivery, missing idempotency, race between checkout and provisioning, manual DB edit, cancellation handled in Stripe dashboard but not synced, etc.).
2. Recommend a safe remediation order: verify first, then fix data, then fix the code path that caused it.
3. Never recommend writing to Stripe or the database directly — recommendations only.

Output concise markdown with one section per drift kind. Lead with the highest-severity kind.`;

export async function explainFindings(result: AuditResult): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return "_Agent diagnosis skipped — set ANTHROPIC_API_KEY to get root-cause hypotheses for each drift category._";
  }
  if (result.findings.length === 0) {
    return "_No drift found — nothing to diagnose._";
  }
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1500,
    system: ROOT_CAUSE_PROMPT,
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          stripeCount: result.stripeCount,
          internalCount: result.internalCount,
          findings: result.findings.slice(0, 50),
        }),
      },
    ],
  });
  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

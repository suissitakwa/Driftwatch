#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { Command } from "commander";
import { formatCents } from "@driftwatch/core";
import { fetchInternalStates, fetchStripeStates } from "@driftwatch/connectors";
import { diffStates } from "@driftwatch/diff-engine";
import { explainFindings } from "@driftwatch/agents";
import { renderMarkdown } from "@driftwatch/report";
import { registerSeedCommand } from "./seed.js";

const DEFAULT_QUERY =
  "select stripe_customer_id, status, plan, email from subscriptions";

const program = new Command()
  .name("driftwatch")
  .description(
    "Detects state drift between Stripe and your application's database",
  );

program
  .command("audit")
  .description("Run a one-time drift audit and write a markdown report")
  .option("--db-url <url>", "Postgres connection string (or DATABASE_URL)")
  .option(
    "--query <sql>",
    "SQL returning stripe_customer_id, status, plan, email",
  )
  .option("--query-file <path>", "read the SQL from a file instead")
  .option("--out <path>", "report output path", "report.md")
  .option("--no-agent", "skip the agent diagnosis step")
  .action(async (opts) => {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const dbUrl = opts.dbUrl ?? process.env.DATABASE_URL;
    if (!stripeKey) fail("STRIPE_SECRET_KEY is not set");
    if (!dbUrl) fail("Pass --db-url or set DATABASE_URL");

    const query = opts.queryFile
      ? readFileSync(opts.queryFile, "utf8")
      : (opts.query ?? DEFAULT_QUERY);

    console.log("driftwatch: fetching Stripe and internal state...");
    const [stripeStates, internalStates] = await Promise.all([
      fetchStripeStates(stripeKey!),
      fetchInternalStates(dbUrl!, query),
    ]);

    const result = diffStates(stripeStates, internalStates);
    const diagnosis = opts.agent
      ? await explainFindings(result)
      : "_Agent diagnosis skipped (--no-agent)._";

    writeFileSync(opts.out, renderMarkdown(result, diagnosis));

    const critical = result.findings.filter((f) => f.severity === "critical");
    const impact = result.findings.reduce(
      (sum, f) => sum + f.monthlyImpactCents,
      0,
    );
    console.log(
      `driftwatch: ${result.findings.length} findings (${critical.length} critical), ` +
        `${formatCents(impact)}/month impact — report written to ${opts.out}`,
    );
    if (critical.length > 0) process.exitCode = 1;
  });

registerSeedCommand(program);

program
  .command("watch")
  .description("Scheduled re-audit with alerting (module 1.1 — not built yet)")
  .action(() => {
    console.log(
      "watch mode is planned for module 1.1 — run `driftwatch audit` on a cron for now",
    );
  });

function fail(message: string): never {
  console.error(`driftwatch: ${message}`);
  process.exit(2);
}

program.parseAsync().catch((err) => {
  console.error(`driftwatch: ${err instanceof Error ? err.message : err}`);
  process.exit(2);
});

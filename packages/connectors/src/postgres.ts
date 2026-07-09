import pg from "pg";
import type { CanonicalState, EntitlementStatus } from "@driftwatch/core";

const DEFAULT_STATUS_MAP: Record<string, EntitlementStatus> = {
  active: "active",
  trialing: "trialing",
  trial: "trialing",
  past_due: "past_due",
  canceled: "canceled",
  cancelled: "canceled",
  expired: "canceled",
  inactive: "none",
  none: "none",
};

export async function fetchInternalStates(
  databaseUrl: string,
  query: string,
  statusMap: Record<string, EntitlementStatus> = {},
): Promise<CanonicalState[]> {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    const { rows } = await pool.query(query);
    return rows.map((row: Record<string, unknown>) => {
      const rawStatus = String(row.status ?? "none").toLowerCase();
      return {
        customerRef: String(row.stripe_customer_id ?? ""),
        status:
          statusMap[rawStatus] ?? DEFAULT_STATUS_MAP[rawStatus] ?? "none",
        plan: row.plan != null ? String(row.plan) : undefined,
        email: row.email != null ? String(row.email) : undefined,
      };
    });
  } finally {
    await pool.end();
  }
}

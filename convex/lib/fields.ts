import type { Id } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"
import { type PlanKey, SERVER_SESSION } from "./consts"

export type FieldVersion = { value: unknown; version: number; session: string }

/** Every stored field of a plan, keyed by name. */
export async function readFields(ctx: QueryCtx, planId: Id<"plans">) {
  const rows = await ctx.db
    .query("planFields")
    .withIndex("by_plan_key", (q) => q.eq("planId", planId))
    .collect()
  return Object.fromEntries(
    rows.map((row) => [
      row.key,
      { value: row.value, version: row.version, session: row.session },
    ])
  ) as Record<string, FieldVersion>
}

export async function readField<T>(
  ctx: QueryCtx,
  planId: Id<"plans">,
  key: PlanKey
): Promise<T | undefined> {
  const row = await ctx.db
    .query("planFields")
    .withIndex("by_plan_key", (q) => q.eq("planId", planId).eq("key", key))
    .unique()
  return row?.value as T | undefined
}

/** Writes one field; the public site's slug follows `site`. */
export async function writeField(
  ctx: MutationCtx,
  planId: Id<"plans">,
  key: PlanKey,
  value: unknown,
  session = SERVER_SESSION
) {
  const row = await ctx.db
    .query("planFields")
    .withIndex("by_plan_key", (q) => q.eq("planId", planId).eq("key", key))
    .unique()
  const version = Math.max(Date.now(), (row?.version ?? 0) + 1)
  if (row) await ctx.db.patch(row._id, { value, version, session })
  else await ctx.db.insert("planFields", { planId, key, value, version, session })
  if (key === "site") await claimSlug(ctx, planId, (value as { slug?: string })?.slug)
}

async function claimSlug(
  ctx: MutationCtx,
  planId: Id<"plans">,
  slug: string | undefined
) {
  const current = await ctx.db
    .query("sites")
    .withIndex("by_plan", (q) => q.eq("planId", planId))
    .unique()
  if (current?.slug === slug) return
  if (current) await ctx.db.delete(current._id)
  if (!slug) return
  const taken = await ctx.db
    .query("sites")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .first()
  if (!taken) await ctx.db.insert("sites", { slug, planId })
}

/** Removes a plan and everything that hangs off it. */
export async function deletePlan(ctx: MutationCtx, planId: Id<"plans">) {
  const rows = [
    ...(await ctx.db
      .query("planFields")
      .withIndex("by_plan_key", (q) => q.eq("planId", planId))
      .collect()),
    ...(await ctx.db
      .query("planMembers")
      .withIndex("by_plan", (q) => q.eq("planId", planId))
      .collect()),
    ...(await ctx.db
      .query("sites")
      .withIndex("by_plan", (q) => q.eq("planId", planId))
      .collect()),
    ...(await ctx.db
      .query("invites")
      .withIndex("by_plan", (q) => q.eq("planId", planId))
      .collect()),
  ]
  for (const row of rows) await ctx.db.delete(row._id)
  const photos = await ctx.db
    .query("photos")
    .withIndex("by_plan", (q) => q.eq("planId", planId))
    .collect()
  for (const photo of photos) {
    await ctx.storage.delete(photo.storageId)
    await ctx.db.delete(photo._id)
  }
  await ctx.db.delete(planId)
}

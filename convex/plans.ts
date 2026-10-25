import { ConvexError, v } from "convex/values"

import { mutation, query } from "./_generated/server"
import { membershipOf, requireMember, requireUser } from "./lib/access"
import { PLAN_KEYS, type PlanKey } from "./lib/consts"
import { deletePlan, readFields, writeField } from "./lib/fields"
import { getAuthUserId } from "@convex-dev/auth/server"

const fieldsValidator = v.record(v.string(), v.any())

function planKeys(fields: Record<string, unknown>): PlanKey[] {
  const keys = Object.keys(fields)
  const unknown = keys.filter((key) => !PLAN_KEYS.includes(key as PlanKey))
  if (unknown.length)
    throw new ConvexError(`Unknown fields: ${unknown.join(", ")}`)
  return keys as PlanKey[]
}

/**
 * Every plan the signed-in user is on, with each field and its version;
 * null when signed out.
 */
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null
    const memberships = await ctx.db
      .query("planMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect()
    return Promise.all(
      memberships.map(async (membership) => ({
        id: membership.planId,
        role: membership.role,
        memberId: membership.memberId,
        fields: await readFields(ctx, membership.planId),
      }))
    )
  },
})

/** Uploads a plan made on a device; returns its id on the server. */
export const create = mutation({
  args: {
    fields: fieldsValidator,
    memberId: v.string(),
    session: v.string(),
  },
  handler: async (ctx, { fields, memberId, session }) => {
    const userId = await requireUser(ctx)
    const planId = await ctx.db.insert("plans", { createdBy: userId })
    await ctx.db.insert("planMembers", {
      planId,
      userId,
      role: "owner",
      memberId,
    })
    for (const key of planKeys(fields))
      await writeField(ctx, planId, key, fields[key], session)
    return planId
  },
})

/** Saves the fields one tab changed. */
export const patch = mutation({
  args: {
    planId: v.id("plans"),
    fields: fieldsValidator,
    session: v.string(),
  },
  handler: async (ctx, { planId, fields, session }) => {
    await requireMember(ctx, planId)
    for (const key of planKeys(fields))
      await writeField(ctx, planId, key, fields[key], session)
  },
})

/** The owner deletes the plan; anyone else leaves its team. */
export const remove = mutation({
  args: { planId: v.id("plans") },
  handler: async (ctx, { planId }) => {
    const userId = await requireUser(ctx)
    const membership = await membershipOf(ctx, planId, userId)
    if (!membership) return
    if (membership.role === "owner") await deletePlan(ctx, planId)
    else await ctx.db.delete(membership._id)
  },
})

import { getAuthUserId } from "@convex-dev/auth/server"
import { ConvexError } from "convex/values"

import type { Doc, Id } from "../_generated/dataModel"
import type { QueryCtx } from "../_generated/server"

export async function requireUser(ctx: QueryCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx)
  if (!userId) throw new ConvexError("Not signed in")
  return userId
}

export async function membershipOf(
  ctx: QueryCtx,
  planId: Id<"plans">,
  userId: Id<"users">
) {
  return ctx.db
    .query("planMembers")
    .withIndex("by_plan_user", (q) =>
      q.eq("planId", planId).eq("userId", userId)
    )
    .unique()
}

/** The signed-in user's membership of a plan; throws for anyone else. */
export async function requireMember(
  ctx: QueryCtx,
  planId: Id<"plans">
): Promise<Doc<"planMembers">> {
  const userId = await requireUser(ctx)
  const membership = await membershipOf(ctx, planId, userId)
  if (!membership) throw new ConvexError("Not a member of this plan")
  return membership
}

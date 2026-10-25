import { ConvexError, v } from "convex/values"

import { mutation } from "./_generated/server"
import { membershipOf, requireMember, requireUser } from "./lib/access"
import { readField, writeField } from "./lib/fields"

type Member = { id: string; pending: boolean }

/** A link token for one member of the team. */
export const create = mutation({
  args: { planId: v.id("plans"), memberId: v.string() },
  handler: async (ctx, { planId, memberId }) => {
    await requireMember(ctx, planId)
    const token = crypto.randomUUID().replaceAll("-", "")
    await ctx.db.insert("invites", { token, planId, memberId })
    return token
  },
})

/**
 * Opening an invite joins the plan as that member. The same person
 * accepting again, from another device, is fine.
 */
export const accept = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const userId = await requireUser(ctx)
    const invite = await ctx.db
      .query("invites")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique()
    if (!invite || (invite.acceptedBy && invite.acceptedBy !== userId))
      throw new ConvexError("This invite is no longer valid")
    const { planId, memberId } = invite
    const existing = await membershipOf(ctx, planId, userId)
    if (!existing)
      await ctx.db.insert("planMembers", {
        planId,
        userId,
        role: "editor",
        memberId,
      })
    await ctx.db.patch(invite._id, { acceptedBy: userId })
    const members = (await readField<Member[]>(ctx, planId, "members")) ?? []
    await writeField(
      ctx,
      planId,
      "members",
      members.map((member) =>
        member.id === memberId ? { ...member, pending: false } : member
      )
    )
    return { planId, memberId: existing?.memberId ?? memberId }
  },
})

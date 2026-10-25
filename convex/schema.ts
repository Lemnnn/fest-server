import { authTables } from "@convex-dev/auth/server"
import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

/**
 * A plan is the app's `Plan`, split into one row per field so two people
 * editing different parts (guests, budget) never overwrite each other.
 */
export default defineSchema({
  ...authTables,

  plans: defineTable({
    createdBy: v.id("users"),
  }),

  /** Who can open a plan, and which member of its team they are. */
  planMembers: defineTable({
    planId: v.id("plans"),
    userId: v.id("users"),
    role: v.union(v.literal("owner"), v.literal("editor")),
    /** The `Member.id` inside the plan this account plays. */
    memberId: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_plan", ["planId"])
    .index("by_plan_user", ["planId", "userId"]),

  /** One `PlanFields` key of one plan; last write wins per key. */
  planFields: defineTable({
    planId: v.id("plans"),
    key: v.string(),
    value: v.any(),
    /** When it was written, ms; clients apply newer versions only. */
    version: v.number(),
    /** The browser tab that wrote it, so it can skip its own echo. */
    session: v.string(),
  }).index("by_plan_key", ["planId", "key"]),

  /** Public site addresses; the first plan to claim a slug keeps it. */
  sites: defineTable({
    slug: v.string(),
    planId: v.id("plans"),
  })
    .index("by_slug", ["slug"])
    .index("by_plan", ["planId"]),

  /** Links that let someone join a plan's team as a given member. */
  invites: defineTable({
    token: v.string(),
    planId: v.id("plans"),
    memberId: v.string(),
    acceptedBy: v.optional(v.id("users")),
  })
    .index("by_token", ["token"])
    .index("by_plan", ["planId"]),

  /** The event album: photos from the hosts and from guests. */
  photos: defineTable({
    planId: v.id("plans"),
    storageId: v.id("_storage"),
    addedBy: v.optional(v.id("users")),
  }).index("by_plan", ["planId"]),
})

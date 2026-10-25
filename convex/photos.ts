import { getAuthUserId } from "@convex-dev/auth/server"
import { ConvexError, v } from "convex/values"

import type { Id } from "./_generated/dataModel"
import { mutation, query, type QueryCtx } from "./_generated/server"
import { requireMember } from "./lib/access"
import { publishedPlan } from "./sites"

/**
 * A plan's album is open to its team by id, and to anyone with the site's
 * address once it is published (guests add photos from the QR code).
 */
const album = {
  planId: v.optional(v.id("plans")),
  slug: v.optional(v.string()),
}

async function albumPlan(
  ctx: QueryCtx,
  { planId, slug }: { planId?: Id<"plans">; slug?: string }
) {
  if (planId) return (await requireMember(ctx, planId)).planId
  const published = slug ? await publishedPlan(ctx, slug) : null
  if (!published) throw new ConvexError("This album is not public")
  return published
}

/** Newest first, with a URL each. */
export const list = query({
  args: album,
  handler: async (ctx, args) => {
    const planId = await albumPlan(ctx, args).catch(() => null)
    if (!planId) return []
    const photos = await ctx.db
      .query("photos")
      .withIndex("by_plan", (q) => q.eq("planId", planId))
      .order("desc")
      .collect()
    const urls = await Promise.all(
      photos.map((photo) => ctx.storage.getUrl(photo.storageId))
    )
    return photos.flatMap((photo, index) => {
      const url = urls[index]
      return url ? [{ id: photo._id, url }] : []
    })
  },
})

export const generateUploadUrl = mutation({
  args: album,
  handler: async (ctx, args) => {
    await albumPlan(ctx, args)
    return ctx.storage.generateUploadUrl()
  },
})

export const add = mutation({
  args: { ...album, storageId: v.id("_storage") },
  handler: async (ctx, { storageId, ...args }) => {
    const planId = await albumPlan(ctx, args)
    const addedBy = (await getAuthUserId(ctx)) ?? undefined
    await ctx.db.insert("photos", { planId, storageId, addedBy })
  },
})

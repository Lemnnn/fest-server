import { ConvexError, v } from "convex/values"

import type { Id } from "./_generated/dataModel"
import { mutation, query, type QueryCtx } from "./_generated/server"
import { ACTIVITY_LIMIT, PUBLIC_KEYS } from "./lib/consts"
import { readField, readFields, writeField } from "./lib/fields"
import { normalizeName, randomId } from "./lib/text"

type Site = { published?: boolean }
type Guest = { id: string; name: string }
type PlanEvent = { id: string }
type Activity = { id: string }

/** The plan behind a published site, or null. */
export async function publishedPlan(
  ctx: QueryCtx,
  slug: string
): Promise<Id<"plans"> | null> {
  const site = await ctx.db
    .query("sites")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .first()
  if (!site) return null
  const fields = await readField<Site>(ctx, site.planId, "site")
  return fields?.published ? site.planId : null
}

/** What a guest's browser needs to show the site: no guest list, no budget. */
export const bySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const planId = await publishedPlan(ctx, slug)
    if (!planId) return null
    const fields = await readFields(ctx, planId)
    return {
      planId,
      fields: Object.fromEntries(
        PUBLIC_KEYS.filter((key) => key in fields).map((key) => [
          key,
          fields[key].value,
        ])
      ),
    }
  },
})

const answerValidator = v.object({
  name: v.string(),
  rsvp: v.union(v.literal("yes"), v.literal("no")),
  plusOnes: v.number(),
  menu: v.string(),
})

/** Most plus-ones one answer can bring. */
const MAX_PLUS_ONES = 20
const MAX_NAME = 120

/**
 * A guest answers from the site: their row on the guest list is updated,
 * or added when the name isn't on it. Returns whether it was found.
 */
export const rsvp = mutation({
  args: {
    slug: v.string(),
    answer: answerValidator,
    /** The activity line, already worded in every language by the app. */
    activityText: v.record(v.string(), v.string()),
  },
  handler: async (ctx, { slug, answer, activityText }) => {
    const planId = await publishedPlan(ctx, slug)
    if (!planId) throw new ConvexError("This site is not published")
    const name = answer.name.trim()
    if (!name || name.length > MAX_NAME) throw new ConvexError("Invalid name")

    const guests = (await readField<Guest[]>(ctx, planId, "guests")) ?? []
    const events = (await readField<PlanEvent[]>(ctx, planId, "events")) ?? []
    const activity =
      (await readField<Activity[]>(ctx, planId, "activity")) ?? []
    const key = normalizeName(name)
    const match = guests.find((guest) => normalizeName(guest.name) === key)
    const patch = {
      rsvp: answer.rsvp,
      plusOnes: Math.max(0, Math.min(MAX_PLUS_ONES, Math.round(answer.plusOnes))),
      menu: answer.menu,
    }
    const next = match
      ? guests.map((guest) =>
          guest.id === match.id ? { ...guest, ...patch } : guest
        )
      : [
          ...guests,
          {
            id: randomId("g"),
            name,
            side: "one",
            relation: "other",
            eventIds: events.map((event) => event.id),
            ...patch,
          },
        ]
    const item = {
      id: randomId("a"),
      memberId: "guest",
      at: new Date().toISOString(),
      text: activityText,
    }
    await writeField(ctx, planId, "guests", next)
    await writeField(
      ctx,
      planId,
      "activity",
      [item, ...activity].slice(0, ACTIVITY_LIMIT)
    )
    return !!match
  },
})

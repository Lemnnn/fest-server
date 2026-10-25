import { getAuthUserId } from "@convex-dev/auth/server"

import { query } from "./_generated/server"

/** The signed-in account, or null. */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    const user = userId ? await ctx.db.get(userId) : null
    return user ? { id: user._id, email: user.email ?? null } : null
  },
})

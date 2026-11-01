/**
 * Every `PlanFields` key that is shared through the server. Who is using
 * the device (`currentMemberId`) stays on the device.
 */
export const PLAN_KEYS = [
  "profile",
  "events",
  "savedVendorIds",
  "completedTaskIds",
  "bookedCategories",
  "guests",
  "threads",
  "members",
  "taskAssignees",
  "budgetPayers",
  "tables",
  "seatingRules",
  "activity",
  "site",
  "timeline",
  "timelineSharedAt",
  "expenses",
  "startDismissed",
  "looks",
] as const

export type PlanKey = (typeof PLAN_KEYS)[number]

/** What guests on the public site may read, once the site is published. */
export const PUBLIC_KEYS: PlanKey[] = ["profile", "events", "site"]

/** Same as the app's ACTIVITY_LIMIT. */
export const ACTIVITY_LIMIT = 50

/** Written by the server itself, not by a browser tab. */
export const SERVER_SESSION = "server"

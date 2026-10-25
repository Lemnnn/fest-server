/** Same as the app's: accents and case don't matter when matching names. */
export const normalizeName = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()

/** Same shape as the app's `newId`. */
export const randomId = (prefix: string) =>
  `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`

# fest-server

Convex backend for [fest-next](../fest-next): accounts, plans shared live
between a team, the public event site with RSVP, and the photo album.

## Run it locally

```sh
pnpm install
pnpm dev                 # starts a local Convex backend on :3210 and pushes functions
pnpm setup:auth          # once per deployment, while `pnpm dev` runs
```

`pnpm dev` asks you to log in or pick a local deployment the first time.
Without an account, `CONVEX_AGENT_MODE=anonymous pnpm dev` runs a local one.

Then in fest-next, `.env.local` points at it:

```
NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3210
```

Without that variable the app runs on the device alone, as before.

## How the app uses it

- **Plans** are stored one field per row (`planFields`), so two people
  editing different parts never overwrite each other; last write wins per
  field. The app keeps reading and writing its local store; `lib/sync` in
  fest-next pushes changed fields and applies everyone else's.
- **Teams**: `planMembers` says who can open a plan and which `Member` of it
  they are. `invites` are link tokens (`/welcome?join=<token>`).
- **Public site**: `sites.bySlug` returns only the profile, events and site
  text, and only once the site is published. Guests' RSVPs go through
  `sites.rsvp`.
- **Album**: photos in Convex storage, open to the team and, once the site
  is published, to guests.

fest-next imports only the *types* of `convex/_generated/api`, through its
`@server/*` path alias, so commit `convex/_generated` and keep the two
folders side by side. When you add a plan field, add it to
`convex/lib/consts.ts` and to fest-next's `lib/sync/keys.ts`; the app stops
compiling until both match.

## Deploy

`npx convex login`, then `pnpm deploy`, `pnpm setup:auth https://your-app`,
and set `NEXT_PUBLIC_CONVEX_URL` in the app's hosting to the deployment URL.

// Sets the keys Convex Auth signs sessions with, and the app's address, on
// the current deployment. Run once per deployment, while it is running:
//   pnpm setup:auth [https://your-app.example]   (default http://localhost:3000)
import { execFileSync } from "node:child_process"
import { generateKeyPairSync } from "node:crypto"
import { fileURLToPath } from "node:url"

const siteUrl = process.argv[2] ?? "http://localhost:3000"
const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
})
const pem = privateKey
  .export({ type: "pkcs8", format: "pem" })
  .toString()
  .trimEnd()
  .replace(/\n/g, " ")
const jwks = JSON.stringify({
  keys: [{ use: "sig", alg: "RS256", ...publicKey.export({ format: "jwk" }) }],
})

// Call the CLI without a shell so the values reach it byte for byte.
const cli = fileURLToPath(
  new URL("../node_modules/convex/bin/main.js", import.meta.url)
)
for (const [name, value] of [
  ["JWT_PRIVATE_KEY", pem],
  ["JWKS", jwks],
  ["SITE_URL", siteUrl],
]) {
  execFileSync(process.execPath, [cli, "env", "set", "--", name, value], {
    stdio: "inherit",
  })
}

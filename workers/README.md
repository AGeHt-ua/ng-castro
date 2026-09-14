# Cloudflare Workers

This directory contains the production Workers for the NG Castro website.

- `auth` — Discord OAuth, signed state, encrypted session cookie and the minimal site profile (`ic`, `sid`).
- `join` — authenticated application submission, Discord bot message delivery and application-status synchronisation.

## Cloudflare resources

Create four KV namespaces, then replace the four placeholder IDs in the two `wrangler.jsonc` files:

1. `ng-castro-sessions` — bind as `SESSIONS` in both Workers.
2. `ng-castro-profiles` — bind as `PROFILES` in both Workers.
3. `ng-castro-join-tokens` — bind only in the join Worker as `JOIN_TOKENS`.
4. `ng-castro-applications` — bind only in the join Worker as `APPLICATIONS`.

The Workers own the subdomains `auth.family-castro.com` and `join.family-castro.com`; do not create CNAME records for those hostnames yourself. Wrangler creates the custom-domain DNS records and certificates during deployment. `api.family-castro.com` stays untouched because the existing shop and statistics API already uses it.

## Secrets

Set secrets with `wrangler secret put <NAME> --config <CONFIG>` — never place them in a config file or commit them.

Auth Worker:

- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `OAUTH_STATE_SECRET` (a new random 32+ byte value)

Join Worker:

- `DISCORD_BOT_TOKEN`

Join Worker variables (non-secret, set through `vars` or the Cloudflare dashboard):

- `GUILD_ID`
- `MEMBER_ROLE_ID`
- `PIAR_CHANNEL_ID`
- `FARM_CHANNEL_ID`
- `KAPT_CHANNEL_ID`

In the Discord Developer Portal, add this redirect URI to the OAuth application before deployment:

`https://auth.family-castro.com/auth/callback`

The Worker only requests the Discord `identify` scope. The bot token stays a Worker secret and is used only for the Discord REST endpoints that create, delete and inspect application messages.

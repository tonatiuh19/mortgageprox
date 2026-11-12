# MortgageProx

White-label workspace for mortgage brokerages. Vercel serverless, one API file, TiDB, passwordless email codes.

## Commands

```bash
npm install
npm run dev          # UI on :8080, API on :8081
npm test             # mocked Vitest, no live email or TiDB
npm run typecheck
npm run db:migrate
npm run deploy:prod
```

npm only. Do not use pnpm or yarn.

## Layout

- `api/index.ts` is the whole API. `import type` from `shared/` only.
- `database/schema.sql` is the structure. Changes go in `database/migrations/` first.
- `client/` is the React app. Data loads through Redux thunks.
- `.cursor/rules/` matches the Groundwork / Optimum Credit / Athlete Hub set.

## Roles

Platform: `platform_owner` (Alex Gomez, alex@disruptinglabs.com), `platform_support`, `platform_billing`.

Brokerage: `brokerage_owner`, `leadership`, `loan_officer`, `processor`, `partner`.

Borrower: `borrower`, separate portal.

## Plans

Seeded prices: Starter $149, Growth $349, Scale $699, Custom quoted. Starter, Growth and Scale open with a $299 start fee, then 30 days. The fee is collected with a branded Payment Element and credited to the first invoice if they continue. Custom does not have a trial or a start fee. Each plan includes a fixed amount of seats, open loans, emails, letters, text segments and calling minutes. Past that amount, emails, letters and open loans can take a one-time pack. Texts and calling minutes pause until the 1st. An extra seat is $29 a month, bought before the invite, and it stays billed until removed. Twilio credits are billed by Twilio, not on the MortgageProx invoice. The style studio is included in every plan. Twilio is an add-on. A custom domain is included on Scale and Custom. The wizard recommends the plan. Scale and Custom include the connection fee. The MCP connector is a Scale choice. It is read only, and each successful call is 3 cents of usage. Writes are not included. Campaigns are a Scale and Custom choice, off until the office turns them on. They include 800 contacts. Each extra 100 is $9 a month. The shared list holds 1,000 contacts until platform billing raises it. A quote can raise the included amount. Sends are not charged again.

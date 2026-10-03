![Millrow, an online store for a small coffee roaster built with Elements: the owner's sales dashboard with revenue for today, this week and this month, orders ready to ship, a 14-day revenue chart, top products and the latest orders.](https://elements.dev/demos/01a0f39d-0703-7846-ac3c-a5b583a5727c/poster?v=1cb43026fde4)

# Millrow

> A demo app built with [Elements](https://elements.dev).

Coffee by collection with size and grind variants, guest checkout by card, order and shipping emails with tracking, and live stock and sales for the owner.

**Demo:** [Millrow](https://elements.dev/demos/01a0f39d-0703-7846-ac3c-a5b583a5727c)

## Agent specs

- **Agent:** Claude Code, Opus 5.5 Medium
- **Time:** 29 min
- **Cost:** $9.35 at API rates, September 2026

## Get started

```bash
elements create millrow -scaffold=elementscode/demo-millrow
```

## Payments

Without a Stripe key, checkout runs through the built-in test checkout: the
Pay button opens an order summary inside the app, and paying there records the
order, holds the stock and sends the receipt exactly as a card payment would.
No card is taken.

For real Stripe Checkout, add a Stripe secret key as `STRIPE_SECRET_KEY` in
`config/env/development.env`. Sandbox keys are free: sign up at
dashboard.stripe.com/register and copy the secret key from Developers, API
keys. Pay with card 4242 4242 4242 4242, any future expiry and any CVC.

```text
STRIPE_SECRET_KEY=
```

Production requires the key: the build fails without it and the app will not
start with it empty. On the first checkout in production the app registers its
own Stripe webhook and keeps the signing secret, so there is nothing to set up
in the Stripe dashboard.

## How it's built

Millrow needed a catalog with size and grind variants, a cart, card checkout, order emails, and stock that updates while people shop. Each of those is a part of Elements, so the agent spent its 29 minutes on the store itself.

### What Elements gave the app

- **Live stock and orders.** Product variants and orders are LiveTables. An open product page shows "Only 4 left" the moment stock changes, the owner's orders list fills in as orders arrive, and a channel pushes each new sale to the sales dashboard.

- **Card checkout.** Checkout prices the cart on the server, holds the stock and sends the shopper to Stripe with the store's own prices. The order is recorded when the shopper returns and again when Stripe's webhook arrives, once either way. Without a Stripe key, the same button opens a test checkout inside the app that pays through the same code, and in production the app registers its own webhook on the first checkout.

- **Server calls as function calls.** The cart, order lookup and product editor call server functions straight from the page with `@rpc`, with types checked from the template to the database.

- **Background work.** A job sends order confirmations and tracking emails, and a one-line cron schedule returns stock held by unfinished checkouts every five minutes.

- **Data from SQL files.** Migrations define the store and seed 12 products with 59 variants and 20 orders. The project server applied each one the moment it was saved.

- **Sessions and roles.** Every admin page and server call shares one guard on the signed-in owner's role.

### What the project server gave the agent

The project server runs alongside the agent and answers as soon as a file is saved: it type-checks the templates, TypeScript and SQL, applies migrations and reruns the tests, so every question came back right away and the agent kept building.

### What shipped

The app type-checks with zero errors and all 25 tests pass. Every page works on desktop and phone. A real sandbox payment went through Stripe end to end.

## Seed data and demo account

The seed loads in every environment: three collections (Single Origin, Blends,
Gear), twelve products with 59 size and grind variants and two photos each,
and twenty orders from the last few weeks, paid, shipped and refunded. The
product photos are SVG illustrations; replace them from each product's edit
page.

The store owner signs in at `/signin`, and the sign-in page shows the login.

| Email                | Password        | Role  |
| -------------------- | --------------- | ----- |
| admin@millrow.coffee | `millrow-admin` | admin |

Shoppers do not need an account. `/orders` finds an order by email and order
number.

**Demo:** [Millrow](https://elements.dev/demos/01a0f39d-0703-7846-ac3c-a5b583a5727c)

## License

MIT. See [LICENSE](LICENSE).

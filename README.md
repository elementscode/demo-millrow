![An online store with card checkout, built by Claude Code on Elements: the owner's sales dashboard with revenue for today, this week and this month, orders ready to ship, a 14-day revenue chart, top products and the latest orders.](https://elements.dev/demos/01a0f39d-0703-7846-ac3c-a5b583a5727c/poster?v=1cb43026fde4)

# An online store with card checkout, built by Claude Code on Elements

> Millrow is a full-stack app built with Claude Code on Elements.

Coffee by collection with size and grind variants, guest checkout by card, order and shipping emails with tracking, and live stock and sales for the owner.

[Run this app on your machine](https://elements.dev/demos/01a0f39d-0703-7846-ac3c-a5b583a5727c). Use this demo as inspiration, or as the starting point for your own app. Your agent creates a new app with this one as the scaffold, and you prompt it to add whatever features you want.

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

- **Live stock and orders.** Product variants and orders are LiveTables. An open product page shows "Only 4 left" the moment stock changes, the owner's orders list fills in as orders arrive, and a channel pushes each new sale to the sales dashboard.

- **Card checkout.** Checkout prices the cart on the server, holds the stock and sends the shopper to Stripe with the store's own prices. The order is recorded when the shopper returns and again when Stripe's webhook arrives, once either way. Without a Stripe key, the same button opens a test checkout inside the app that pays through the same code, and in production the app registers its own webhook on the first checkout.

- **Server calls as function calls.** The cart, order lookup and product editor call server functions straight from the page with `@rpc`, with types checked from the template to the database.

- **Background work.** A job sends order confirmations and tracking emails, and a one-line cron schedule returns stock held by unfinished checkouts every five minutes.

- **Data from SQL files.** Migrations define the store and seed 12 products with 59 variants and 20 orders. The project server applied each one the moment it was saved.

- **Sessions and roles.** Every admin page and server call shares one guard on the signed-in owner's role.

## Why Elements

Elements is an integrated full-stack app framework and a project server. The project server checks the agent's work as it builds: it type-checks the server and browser code, analyzes the program, applies migrations and runs the tests, then reports the results to the agent. A security mistake, such as calling a server-only function from the browser, is a compile error. The agent reads the report and fixes its own mistakes before it tells you a feature is done. The same checks run on every feature you ask for next.

import { Request, Response, redirect, sql } from "@elements/app";
import { stripe, testCheckout } from "#app/shared/stripe";
import { releaseOrder } from "#app/shared/services/orders";

/**
 * The buyer backed out of Stripe or the test checkout. A Stripe session is
 * expired first, so it cannot be paid after the stock goes back on the shelf.
 */
export default async function checkoutCancel(req: Request, res: Response) {
  let order = sql<{ id: string; stripeSessionId: string | null }>(`
    select id, stripeSessionId from orders where id = ${String(req.query.order ?? "")}::uuid and status = 'pending'
  `).first();

  if (order?.stripeSessionId) {
    let session = await stripe().checkout.sessions.retrieve(order.stripeSessionId);

    if (session.status === "open") {
      await stripe().checkout.sessions.expire(order.stripeSessionId);
      releaseOrder(order.id);
    }
  } else if (order && testCheckout()) {
    releaseOrder(order.id);
  }

  redirect("/cart");
}

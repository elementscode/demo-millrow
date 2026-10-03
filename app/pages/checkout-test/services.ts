import { ForbiddenError, sql } from "@elements/app";
import { recordPayment } from "#app/shared/checkout";
import { testCheckout } from "#app/shared/stripe";

/**
 * Pays a pending order on the in-app test checkout. Development without a
 * Stripe key only. The amount is the order's own server-priced total, and the
 * payment goes through the same recordPayment a Stripe payment does.
 *
 * @rpc
 */
export function payTestOrder(orderId: string) {
  if (!testCheckout()) {
    throw new ForbiddenError("The test checkout is off.");
  }

  let order = sql<{ totalCents: number }>(`
    select totalCents
      from orders
     where id = ${orderId} and status = 'pending'
  `).firstOrThrow("order not found");

  recordPayment(`test_${orderId}`, orderId, order.totalCents, "usd", null);
}

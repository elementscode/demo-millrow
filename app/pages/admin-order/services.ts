import { NotFoundError, ValidationError, sql, tx } from "@elements/app";
import { isUserAdminOrThrow } from "#app/shared/services/admin";
import { OrderDetail, loadOrder } from "#app/shared/services/orders";
import { stripe } from "#app/shared/stripe";
import { SendOrderEmailJob } from "#app/jobs/send-order-email";

export const CARRIERS = ["USPS", "UPS", "FedEx", "DHL"];

export interface ShipForm {
  carrier: string;
  trackingNumber: string;
}

/**
 * Marks a paid order shipped and queues the customer's tracking email in the
 * same transaction, so the email goes out only if the update commits.
 */
export function shipOrder(orderId: string, form: ShipForm): OrderDetail {
  let tracking = form.trackingNumber.replace(/\s+/g, "").toUpperCase();

  if (!CARRIERS.includes(form.carrier)) {
    throw new ValidationError({ carrier: ["Pick a carrier"] });
  }

  if (tracking.length < 8) {
    throw new ValidationError({ trackingNumber: ["Enter the tracking number from the label"] });
  }

  tx(() => {
    let shipped = sql(`
      update orders
         set status = 'shipped', carrier = ${form.carrier}, trackingNumber = ${tracking}, shippedAt = now()
       where id = ${orderId} and status = 'paid'
   returning id
    `).first();

    if (!shipped) {
      throw new ValidationError("Only a paid order can be marked shipped.");
    }

    new SendOrderEmailJob({ orderId, kind: "shipped" }).schedule();
  });

  return loadOrder(orderId)!;
}

/** @rpc */
export function markShipped(orderId: string, form: ShipForm): OrderDetail {
  isUserAdminOrThrow();

  return shipOrder(orderId, form);
}

/**
 * Refunds the whole order. Orders paid through Stripe are refunded there first;
 * the seeded demo orders have no payment to refund and only change status.
 */
/** @rpc */
export async function refundOrder(orderId: string, restock: boolean): Promise<OrderDetail> {
  isUserAdminOrThrow();

  let order = sql<{ status: string; paymentIntentId: string | null }>(`
    select status, paymentIntentId from orders where id = ${orderId}
  `).first();

  if (!order) {
    throw new NotFoundError("no such order");
  }

  if (order.status !== "paid" && order.status !== "shipped") {
    throw new ValidationError("Only a paid or shipped order can be refunded.");
  }

  if (order.paymentIntentId) {
    await stripe().refunds.create({ payment_intent: order.paymentIntentId });
  }

  tx(() => {
    let refunded = sql(`
      update orders set status = 'refunded', refundedAt = now()
       where id = ${orderId} and status in ('paid', 'shipped')
   returning id
    `).first();

    if (refunded && restock) {
      sql(`
        update variants v
           set stock = v.stock + l.quantity
          from orderLines l
         where l.orderId = ${orderId} and l.variantId = v.id
      `);
    }
  });

  return loadOrder(orderId)!;
}

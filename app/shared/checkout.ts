import { getAppUrl, sql, tx, ValidationError, FieldErrors } from "@elements/app";
import { stripe, testCheckout } from "#app/shared/stripe";
import { ensureWebhook } from "#app/shared/stripe-webhook";
import { CartLine } from "#app/shared/cart";
import { priceLines } from "#app/shared/services/cart";
import { releaseOrder } from "#app/shared/services/orders";
import { SendOrderEmailJob } from "#app/jobs/send-order-email";

export interface CheckoutForm {
  email: string;
  name: string;
  address1: string;
  address2: string;
  city: string;
  region: string;
  postalCode: string;
  lines: CartLine[];
}

// Stripe's shortest allowed session. A pending order holds its stock this long.
const HOLD_MINUTES = 30;

export function validateCheckout(form: CheckoutForm): FieldErrors<CheckoutForm> {
  let errors: FieldErrors<CheckoutForm> = {};

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) {
    errors.email = ["Enter the email for your receipt"];
  }

  if (!form.name.trim()) {
    errors.name = ["Enter the name for the label"];
  }

  if (!form.address1.trim()) {
    errors.address1 = ["Enter a street address"];
  }

  if (!form.city.trim()) {
    errors.city = ["Enter a city"];
  }

  if (!/^\d{5}(-\d{4})?$/.test(form.postalCode.trim())) {
    errors.postalCode = ["Enter a 5 digit ZIP code"];
  }

  return errors;
}

/**
 * Creates a pending order, holds its stock, and returns the url to send the
 * buyer to: a Stripe Checkout Session, or the in-app test checkout when no
 * Stripe key is set in development.
 */
export async function placeOrder(form: CheckoutForm): Promise<string> {
  let errors = validateCheckout(form);
  if (Object.keys(errors).length > 0) {
    throw new ValidationError(errors);
  }

  let cart = priceLines(form.lines);
  if (cart.lines.length === 0) {
    throw new ValidationError("Your cart is empty.");
  }

  let orderId = tx(() => {
    let order = sql<{ id: string }>(`
      insert into orders (email, name, address1, address2, city, region, postalCode,
                          itemCount, subtotalCents, shippingCents, totalCents)
           values (${form.email.trim().toLowerCase()}, ${form.name.trim()}, ${form.address1.trim()}, ${form.address2.trim()},
                   ${form.city.trim()}, ${form.region.trim().toUpperCase()}, ${form.postalCode.trim()},
                   ${cart.itemCount}, ${cart.subtotalCents}, ${cart.shippingCents}, ${cart.totalCents})
        returning id
    `).firstOrThrow();

    for (let line of cart.lines) {
      // Hold the stock now; the conditional update is what stops two buyers
      // taking the last bag.
      let held = sql(`
        update variants set stock = stock - ${line.quantity}
         where id = ${line.variantId} and stock >= ${line.quantity}
     returning id
      `).first();

      if (!held) {
        let left = line.stock;
        throw new ValidationError(left > 0
          ? `Only ${left} left of ${line.productName} (${line.label}). Lower the quantity to check out.`
          : `${line.productName} (${line.label}) just sold out. Remove it to check out.`);
      }

      sql(`
        insert into orderLines (orderId, productId, variantId, productName, variantLabel, unitCents, quantity)
             values (${order.id}, ${line.productId}, ${line.variantId}, ${line.productName}, ${line.label}, ${line.unitCents}, ${line.quantity})
      `);
    }

    return order.id;
  });

  if (testCheckout()) {
    return `/checkout/test/${orderId}`;
  }

  try {
    await ensureWebhook();

    let session = await stripe().checkout.sessions.create({
      mode: "payment",
      customer_email: form.email.trim(),
      client_reference_id: orderId,
      expires_at: Math.floor(Date.now() / 1000) + HOLD_MINUTES * 60 + 60,
      line_items: [
        ...cart.lines.map((line) => ({
          quantity: line.quantity,
          price_data: {
            currency: "usd",
            unit_amount: line.unitCents,
            product_data: { name: `${line.productName}${line.label ? ` (${line.label})` : ""}` },
          },
        })),
        ...(cart.shippingCents > 0 ? [{
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: cart.shippingCents,
            product_data: { name: "Shipping" },
          },
        }] : []),
      ],
      success_url: `${getAppUrl()}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${getAppUrl()}/checkout/cancel?order=${orderId}`,
    });

    sql(`update orders set stripeSessionId = ${session.id} where id = ${orderId}`);

    return session.url!;
  } catch (err) {
    releaseOrder(orderId);
    throw err;
  }
}

/**
 * Records a paid session and returns its order id. Idempotent: the return page
 * and the webhook both call it, in either order, any number of times.
 */
export async function fulfillCheckout(sessionId: string): Promise<string | undefined> {
  let checkout = await stripe().checkout.sessions.retrieve(sessionId);
  let orderId = checkout.client_reference_id ?? undefined;

  if (!orderId) {
    return undefined;
  }

  if (checkout.payment_status !== "paid") {
    return orderId;
  }

  let paymentIntent = typeof checkout.payment_intent === "string" ? checkout.payment_intent : checkout.payment_intent?.id ?? null;

  recordPayment(checkout.id, orderId, checkout.amount_total!, checkout.currency!, paymentIntent);

  return orderId;
}

/**
 * The one place a payment is recorded, from Stripe or the test checkout. Marks
 * the order paid and sends the receipt, both only on the first call.
 */
export function recordPayment(sessionId: string, orderId: string, amountTotal: number, currency: string, paymentIntentId: string | null) {
  tx(() => {
    sql(`
      insert into payments (stripeSessionId, orderId, amountTotal, currency)
           values (${sessionId}, ${orderId}, ${amountTotal}, ${currency})
      on conflict (stripeSessionId) do nothing
    `);

    let paid = sql(`
      update orders
         set status = 'paid', paidAt = now(), paymentIntentId = ${paymentIntentId}
       where id = ${orderId} and status = 'pending'
   returning id
    `).first();

    // Only the first call gets here, so the receipt goes out once.
    if (paid) {
      new SendOrderEmailJob({ orderId, kind: "confirmation" }).schedule();
    }
  });
}

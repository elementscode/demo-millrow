import { Request, Response } from "@elements/app";
import { stripe } from "#app/shared/stripe";
import { webhookSecret } from "#app/shared/stripe-webhook";
import { fulfillCheckout } from "#app/shared/checkout";
import { releaseOrder } from "#app/shared/services/orders";

export default async function stripeWebhook(req: Request, res: Response) {
  let event;

  try {
    event = stripe().webhooks.constructEvent(
      req.bodyBuffer!,
      req.headers["stripe-signature"] as string,
      webhookSecret(),
    );
  } catch {
    res.status(400).send("invalid signature");
    return;
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      await fulfillCheckout(event.data.object.id);
      break;

    case "checkout.session.expired":
      if (event.data.object.client_reference_id) {
        releaseOrder(event.data.object.client_reference_id);
      }
      break;
  }

  return "ok";
}

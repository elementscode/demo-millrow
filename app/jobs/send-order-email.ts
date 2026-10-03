import { Job, email } from "@elements/app";
import { loadOrder } from "#app/shared/services/orders";
import OrderConfirmationEmail from "#app/emails/order-confirmation";
import OrderShippedEmail from "#app/emails/order-shipped";

export interface SendOrderEmailJobFields {
  orderId: string;
  kind: "confirmation" | "shipped";
}

/**
 * Sends an order's receipt or its shipping notice. Scheduled inside the write
 * that caused it, so a rolled-back write sends nothing.
 */
export class SendOrderEmailJob extends Job<SendOrderEmailJobFields> {
  static maxAttempts = 5;

  run() {
    let detail = loadOrder(this.fields.orderId);

    if (!detail) {
      return;
    }

    let { order } = detail;

    if (this.fields.kind === "confirmation") {
      email({
        to: order.email,
        subject: `Your Millrow order #${order.number}`,
        body: new OrderConfirmationEmail({ detail }),
      });
    } else {
      email({
        to: order.email,
        subject: `Order #${order.number} is on its way`,
        body: new OrderShippedEmail({ detail }),
      });
    }
  }
}

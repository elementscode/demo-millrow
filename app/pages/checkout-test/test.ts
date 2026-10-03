import { test, equal, assert, sql } from "@elements/app";
import { placeOrder, recordPayment } from "#app/shared/checkout";
import { testCheckout } from "#app/shared/stripe";
import { makeOrder, makeProduct, stockOf } from "#app/shared/fixtures";
import { payTestOrder } from "./services";

const ADDRESS = {
  email: "Ada@Example.com",
  name: "Ada Lovelace",
  address1: "1 Mill Row",
  address2: "",
  city: "Portland",
  region: "or",
  postalCode: "97205",
};

function receiptsFor(orderId: string): number {
  return sql<{ n: number }>(`
    select count(*)::int as n from elements.jobs
     where path like '%send-order-email%' and fields->>'orderId' = ${orderId}
  `).firstOrThrow().n;
}

function paymentsFor(orderId: string): number {
  return sql<{ n: number }>(`select count(*)::int as n from payments where orderId = ${orderId}`).firstOrThrow().n;
}

test("checkout-test", () => {
  test("recording a payment twice pays once and sends one receipt", () => {
    let { variantIds } = makeProduct({ variants: [[2000, 5]] });
    let order = makeOrder("pending", [{ variantId: variantIds[0], quantity: 1, unitCents: 2000 }]);

    recordPayment("cs_test_one", order.id, 2000, "usd", "pi_one");
    recordPayment("cs_test_one", order.id, 2000, "usd", "pi_one");

    let row = sql<{ status: string; paymentIntentId: string }>(`
      select status, paymentIntentId from orders where id = ${order.id}
    `).firstOrThrow();

    equal(row, { status: "paid", paymentIntentId: "pi_one" });
    equal(paymentsFor(order.id), 1);
    equal(receiptsFor(order.id), 1);
  });

  // Tests run against development's config: with no Stripe key the test
  // checkout is the payment path; once a key is set it must refuse.
  test("the test checkout pays an order end to end, only without a key", async () => {
    if (!testCheckout()) {
      let { variantIds } = makeProduct({ variants: [[2000, 5]] });
      let order = makeOrder("pending", [{ variantId: variantIds[0], quantity: 1, unitCents: 2000 }]);
      let refused = false;

      try {
        payTestOrder(order.id);
      } catch {
        refused = true;
      }

      assert(refused, "a Stripe key turns the test checkout off");
      equal(paymentsFor(order.id), 0);
      return;
    }

    let { variantIds } = makeProduct({ variants: [[1800, 5]] });

    let url = await placeOrder({ ...ADDRESS, lines: [{ variantId: variantIds[0], quantity: 2 }] });
    let orderId = url.replace("/checkout/test/", "");

    assert(url.startsWith("/checkout/test/"), "without a key, checkout stays in the app");
    equal(stockOf(variantIds[0]), 3);

    payTestOrder(orderId);

    let order = sql<{ status: string; email: string; totalCents: number }>(`
      select status, email, totalCents from orders where id = ${orderId}
    `).firstOrThrow();

    equal(order, { status: "paid", email: "ada@example.com", totalCents: 3600 + 600 });

    let payment = sql<{ stripeSessionId: string; amountTotal: number }>(`
      select stripeSessionId, amountTotal from payments where orderId = ${orderId}
    `).firstOrThrow();

    equal(payment, { stripeSessionId: `test_${orderId}`, amountTotal: 4200 });
    equal(receiptsFor(orderId), 1);

    let again = false;
    try {
      payTestOrder(orderId);
    } catch {
      again = true;
    }

    assert(again, "a paid order is no longer payable");
    equal(paymentsFor(orderId), 1);
  });
});

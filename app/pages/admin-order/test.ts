import { test, equal, assert, sql, AuthError, ValidationError } from "@elements/app";
import { markShipped, shipOrder } from "./services";
import { loginAdmin, makeOrder, makeProduct } from "#app/shared/fixtures";

function paidOrder() {
  let { variantIds } = makeProduct();

  return makeOrder("paid", [{ variantId: variantIds[0], quantity: 1, unitCents: 2000 }]);
}

test("shipping an order", () => {
  test("records the carrier and a cleaned-up tracking number", () => {
    let order = paidOrder();
    let detail = shipOrder(order.id, { carrier: "UPS", trackingNumber: " 1z 999 aa1 0123456784 " });

    equal(detail.order.status, "shipped");
    equal(detail.order.trackingNumber, "1Z999AA10123456784");
    assert(detail.order.shippedAt !== null);
  });

  test("queues the tracking email with the update", () => {
    let order = paidOrder();
    shipOrder(order.id, { carrier: "USPS", trackingNumber: "9400111899223355778800" });

    let jobs = sql<{ n: number }>(`select count(*)::int as n from elements.jobs where fields::text like ${"%" + order.id + "%"}`).firstOrThrow();
    equal(jobs.n, 1);
  });

  test("refuses an order that is not paid", () => {
    let { variantIds } = makeProduct();
    let order = makeOrder("refunded", [{ variantId: variantIds[0], quantity: 1, unitCents: 2000 }]);
    let threw = false;

    try {
      shipOrder(order.id, { carrier: "USPS", trackingNumber: "9400111899223355778800" });
    } catch (err) {
      threw = err instanceof ValidationError;
    }

    assert(threw);
  });

  test("is admin only", () => {
    let order = paidOrder();
    let threw = false;

    try {
      markShipped(order.id, { carrier: "USPS", trackingNumber: "9400111899223355778800" });
    } catch (err) {
      threw = err instanceof AuthError;
    }

    assert(threw);
  });

  test("works for the owner", () => {
    loginAdmin();
    let order = paidOrder();

    equal(markShipped(order.id, { carrier: "FedEx", trackingNumber: "123456789012" }).order.carrier, "FedEx");
  });
});

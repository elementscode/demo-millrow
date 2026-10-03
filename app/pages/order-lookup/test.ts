import { test, equal, assert, NotFoundError } from "@elements/app";
import { findOrder } from "./template";
import { makeOrder, makeProduct } from "#app/shared/fixtures";

test("order lookup", () => {
  test("finds an order by email and number, in any case, with or without #", () => {
    let { variantIds } = makeProduct();
    let order = makeOrder("paid", [{ variantId: variantIds[0], quantity: 1, unitCents: 2000 }], "ada@example.com");

    equal(findOrder(" ADA@example.com ", `#${order.number}`), order.id);
  });

  test("a number with the wrong email is not found", () => {
    let { variantIds } = makeProduct();
    let order = makeOrder("paid", [{ variantId: variantIds[0], quantity: 1, unitCents: 2000 }], "ada@example.com");
    let threw = false;

    try {
      findOrder("someone@else.com", String(order.number));
    } catch (err) {
      threw = err instanceof NotFoundError;
    }

    assert(threw);
  });
});

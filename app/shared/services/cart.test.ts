import { test, equal } from "@elements/app";
import { priceLines } from "#app/shared/services/cart";
import { makeProduct } from "#app/shared/fixtures";

test("cart pricing", () => {
  test("prices come from the database, not the browser", () => {
    let { variantIds } = makeProduct({ variants: [[2200, 5], [5800, 5]] });
    let cart = priceLines([{ variantId: variantIds[0], quantity: 2 }, { variantId: variantIds[1], quantity: 1 }]);

    equal(cart.subtotalCents, 2200 * 2 + 5800);
    equal(cart.itemCount, 3);
  });

  test("free shipping at $50, $6 under", () => {
    let { variantIds } = makeProduct({ variants: [[2000, 9]] });

    equal(priceLines([{ variantId: variantIds[0], quantity: 1 }]).shippingCents, 600);
    equal(priceLines([{ variantId: variantIds[0], quantity: 3 }]).shippingCents, 0);
  });

  test("drops unknown variants, unpublished products and bad quantities", () => {
    let live = makeProduct();
    let hidden = makeProduct({ published: false });
    let cart = priceLines([
      { variantId: live.variantIds[0], quantity: 1 },
      { variantId: live.variantIds[0], quantity: 2 },
      { variantId: hidden.variantIds[0], quantity: 1 },
      { variantId: "01a0f000-0000-7000-8000-000000000000", quantity: 1 },
      { variantId: live.variantIds[0], quantity: -4 },
    ]);

    equal(cart.lines.length, 1);
    equal(cart.lines[0].quantity, 3);
  });

  test("an empty cart ships free and costs nothing", () => {
    let cart = priceLines([]);

    equal(cart.totalCents, 0);
    equal(cart.shippingCents, 0);
  });
});

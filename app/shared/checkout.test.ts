import { test, equal, assert } from "@elements/app";
import { validateCheckout } from "#app/shared/checkout";
import { releaseOrder } from "#app/shared/services/orders";
import { makeOrder, makeProduct, stockOf } from "#app/shared/fixtures";

const GOOD = {
  email: "ada@example.com",
  name: "Ada Lovelace",
  address1: "1 Mill Row",
  address2: "",
  city: "Portland",
  region: "OR",
  postalCode: "97205",
  lines: [],
};

test("checkout", () => {
  test("a complete address passes", () => {
    equal(validateCheckout(GOOD), {});
  });

  test("each missing field is named", () => {
    let errors = validateCheckout({ ...GOOD, email: "nope", city: "", postalCode: "12" });

    equal(Object.keys(errors).sort(), ["city", "email", "postalCode"]);
  });

  test("releasing an unpaid order returns its stock once", () => {
    let { variantIds } = makeProduct({ variants: [[2000, 3]] });
    let order = makeOrder("pending", [{ variantId: variantIds[0], quantity: 2, unitCents: 2000 }]);

    assert(releaseOrder(order.id));
    equal(stockOf(variantIds[0]), 5);

    assert(!releaseOrder(order.id), "a second release is a no-op");
    equal(stockOf(variantIds[0]), 5);
  });

  test("a paid order is never released", () => {
    let { variantIds } = makeProduct({ variants: [[2000, 3]] });
    let order = makeOrder("paid", [{ variantId: variantIds[0], quantity: 1, unitCents: 2000 }]);

    assert(!releaseOrder(order.id));
    equal(stockOf(variantIds[0]), 3);
  });
});

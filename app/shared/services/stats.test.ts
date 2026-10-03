import { test, equal } from "@elements/app";
import { loadDashboard } from "#app/shared/services/stats";
import { makeOrder, makeProduct } from "#app/shared/fixtures";

test("dashboard", () => {
  test("counts paid and shipped orders, not refunded or pending", () => {
    // The dashboard aggregates every order, seed included, so compare against
    // a reading taken before this test's orders. The price is high enough to
    // put this test's product in the top five.
    let before = loadDashboard();

    let { variantIds } = makeProduct({ variants: [[500000, 50]] });
    let line = [{ variantId: variantIds[0], quantity: 1, unitCents: 500000 }];

    makeOrder("paid", line);
    makeOrder("shipped", line);
    makeOrder("refunded", line);
    makeOrder("pending", line);

    let dash = loadDashboard();

    equal(dash.today.orders, before.today.orders + 2);
    equal(dash.today.revenueCents, before.today.revenueCents + 1000000);
    equal(dash.toShip, before.toShip + 1);
    equal(dash.days.length, 14);
    equal(dash.top.find((p) => p.name === "Test Coffee")?.units, 2);
  });
});

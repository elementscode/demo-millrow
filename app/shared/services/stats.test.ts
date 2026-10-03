import { test, equal, sql } from "@elements/app";
import { loadDashboard } from "#app/shared/services/stats";
import { makeOrder, makeProduct } from "#app/shared/fixtures";

test("dashboard", () => {
  test("counts paid and shipped orders, not refunded or pending", () => {
    // The dashboard aggregates every order, so start from an empty table; the
    // transaction rolls back and the seed's orders are untouched.
    sql(`delete from orders`);

    let { variantIds } = makeProduct({ variants: [[2000, 50]] });
    let line = [{ variantId: variantIds[0], quantity: 1, unitCents: 2000 }];

    makeOrder("paid", line);
    makeOrder("shipped", line);
    makeOrder("refunded", line);
    makeOrder("pending", line);

    let dash = loadDashboard();

    equal(dash.today.orders, 2);
    equal(dash.today.revenueCents, 4000);
    equal(dash.toShip, 1);
    equal(dash.days.length, 14);
    equal(dash.top[0].units, 2);
  });
});

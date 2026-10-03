import { App, getEnv } from "@elements/app";
import config from "#config";
import home from "#app/pages/home";
import notFound from "#app/pages/errors/not-found";
import unhandled from "#app/pages/errors/unhandled";
import serveMedia from "#app/routes/media";
import collection from "#app/pages/collection";
import product from "#app/pages/product";
import cart from "#app/pages/cart";
import checkout from "#app/pages/checkout";
import checkoutReturn from "#app/pages/checkout-return";
import checkoutTest from "#app/pages/checkout-test";
import order from "#app/pages/order";
import orderLookup from "#app/pages/order-lookup";
import signin from "#app/pages/signin";
import adminDashboard from "#app/pages/admin-dashboard";
import adminOrders from "#app/pages/admin-orders";
import adminOrder from "#app/pages/admin-order";
import adminProducts from "#app/pages/admin-products";
import adminProduct from "#app/pages/admin-product";
import checkoutCancel from "#app/routes/checkout-cancel";
import stripeWebhook from "#app/routes/stripe-webhook";
import { ReleaseExpiredOrdersJob } from "#app/jobs/release-expired-orders";
import { stripeConfigured } from "#app/shared/stripe";

if (getEnv() === "production" && !stripeConfigured()) {
  throw new Error("STRIPE_SECRET_KEY is required in production.");
}

const app = new App();

app.route("/", home);
app.route("/media/:id/:hash", serveMedia);
app.route("/collections/:slug", collection);
app.route("/products/:slug", product);
app.route("/cart", cart);
app.route("/checkout", checkout);
app.route("/checkout/return", checkoutReturn);
app.route("/checkout/cancel", checkoutCancel);
app.route("/checkout/test/:orderId", checkoutTest);
app.route({ method: "post", path: "/stripe/webhook", handler: stripeWebhook });
app.route("/order/:id", order);
app.route("/orders", orderLookup);
app.route("/signin", signin);
app.route("/admin", adminDashboard);
app.route("/admin/orders", adminOrders);
app.route("/admin/orders/:id", adminOrder);
app.route("/admin/products", adminProducts);
app.route("/admin/products/:id", adminProduct);

app.cron("every 5m", "release expired orders", () => new ReleaseExpiredOrdersJob().schedule());

app.error((req, res, err) => {
  switch (err.statusCode) {
    case 404:
      return notFound(req, res, err);

    default:
      return unhandled(req, res, err);
  }
});

app.start(config);

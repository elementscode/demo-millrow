import { NotFoundError, Request, Response, redirect } from "@elements/app";
import { testCheckout } from "#app/shared/stripe";
import { loadOrder } from "#app/shared/services/orders";
import { currentUserIsAdmin } from "#app/shared/services/admin";
import html from "./template";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function route(req: Request, res: Response) {
  if (!testCheckout()) {
    throw new NotFoundError();
  }

  let id = String(req.params.orderId);
  let detail = UUID.test(id) ? loadOrder(id) : undefined;

  if (!detail) {
    throw new NotFoundError("no such order");
  }

  // Paid, or released by a cancel or the expiry job: nothing left to pay.
  if (detail.order.status !== "pending") {
    redirect(detail.order.status === "cancelled" ? "/cart" : `/order/${id}`);
    return;
  }

  return new html({ detail, isAdmin: currentUserIsAdmin() });
}

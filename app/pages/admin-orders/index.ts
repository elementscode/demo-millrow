import { Request, Response } from "@elements/app";
import { adminPageOrRedirect } from "#app/shared/services/admin";
import { orders } from "#app/shared/services/orders";
import html from "./template";

const FILTERS = ["all", "paid", "shipped", "refunded"];

export default function route(req: Request, res: Response) {
  if (!adminPageOrRedirect()) {
    return;
  }

  let status = String(req.query.status ?? "all");

  return new html({
    orders: orders.view(),
    initialStatus: FILTERS.includes(status) ? status : "all",
  });
}

import { Request, Response } from "@elements/app";
import { adminPageOrRedirect } from "#app/shared/services/admin";
import { loadDashboard, storeActivity } from "#app/shared/services/stats";
import { orders } from "#app/shared/services/orders";
import html from "./template";

export default function route(req: Request, res: Response) {
  if (!adminPageOrRedirect()) {
    return;
  }

  return new html({
    initial: loadDashboard(),
    activity: storeActivity.listen(),
    orders: orders.view(),
  });
}

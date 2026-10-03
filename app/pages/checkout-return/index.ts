import { Request, Response, redirect } from "@elements/app";
import { fulfillCheckout } from "#app/shared/checkout";

export default async function route(req: Request, res: Response) {
  let orderId = await fulfillCheckout(String(req.query.session_id ?? ""));

  redirect(orderId ? `/order/${orderId}?placed=1` : "/cart");
}

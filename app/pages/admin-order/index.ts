import { NotFoundError, Request, Response } from "@elements/app";
import { adminPageOrRedirect } from "#app/shared/services/admin";
import { loadOrder } from "#app/shared/services/orders";
import html from "./template";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function route(req: Request, res: Response) {
  if (!adminPageOrRedirect()) {
    return;
  }

  let id = String(req.params.id);
  let detail = UUID.test(id) ? loadOrder(id) : undefined;

  if (!detail) {
    throw new NotFoundError("no such order");
  }

  return new html({ initial: detail });
}

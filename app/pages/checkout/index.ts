import { Request, Response } from "@elements/app";
import { testCheckout } from "#app/shared/stripe";
import { currentUserIsAdmin } from "#app/shared/services/admin";
import html from "./template";

export default function route(req: Request, res: Response) {
  return new html({ testMode: testCheckout(), isAdmin: currentUserIsAdmin() });
}

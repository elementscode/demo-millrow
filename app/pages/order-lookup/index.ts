import { Request, Response } from "@elements/app";
import { currentUserIsAdmin } from "#app/shared/services/admin";
import html from "./template";

export default function route(req: Request, res: Response) {
  return new html({ isAdmin: currentUserIsAdmin() });
}

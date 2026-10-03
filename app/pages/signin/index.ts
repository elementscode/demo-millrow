import { Request, Response, getEnv, redirect, session } from "@elements/app";
import html from "./template";

export default function route(req: Request, res: Response) {
  if (session.isLoggedIn()) {
    redirect("/admin");
    return;
  }

  // The demo admin exists only in the development seed.
  return new html({ showDemo: getEnv() === "development" });
}

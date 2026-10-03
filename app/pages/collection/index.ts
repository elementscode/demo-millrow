import { NotFoundError, Request, Response } from "@elements/app";
import { findCollection, listCollections, listProducts } from "#app/shared/services/catalog";
import { currentUserIsAdmin } from "#app/shared/services/admin";
import html from "./template";

export default function route(req: Request, res: Response) {
  let collection = findCollection(String(req.params.slug));

  if (!collection) {
    throw new NotFoundError("no such collection");
  }

  return new html({
    collection,
    collections: listCollections(),
    products: listProducts(collection.id),
    isAdmin: currentUserIsAdmin(),
  });
}

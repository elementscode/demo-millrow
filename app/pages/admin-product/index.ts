import { NotFoundError, Request, Response, sql } from "@elements/app";
import { adminPageOrRedirect } from "#app/shared/services/admin";
import { Product, listPhotos, variants } from "#app/shared/services/catalog";
import html from "./template";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function route(req: Request, res: Response) {
  if (!adminPageOrRedirect()) {
    return;
  }

  let id = String(req.params.id);
  let product = UUID.test(id) ? sql<Product>(`
    select id, collectionId, slug, name, tagline, description, notes, origin, process, roast, published, featured
      from products where id = ${id}
  `).first() : undefined;

  if (!product) {
    throw new NotFoundError("no such product");
  }

  return new html({
    product,
    collections: sql<{ id: string; name: string }>(`select id, name from collections order by position`).all(),
    photos: listPhotos(product.id),
    variants: variants.view({ productId: product.id }),
  });
}

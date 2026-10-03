import { NotFoundError, Request, Response, sql } from "@elements/app";
import { Variant, findProduct, listPhotos, variants } from "#app/shared/services/catalog";
import { currentUserIsAdmin } from "#app/shared/services/admin";
import html from "./template";

export default function route(req: Request, res: Response) {
  let product = findProduct(String(req.params.slug));

  if (!product || !product.published) {
    throw new NotFoundError("no such product");
  }

  let collection = sql<{ slug: string; name: string }>(`
    select slug, name from collections where id = ${product.collectionId}
  `).firstOrThrow();

  // Open on the first variant that can be bought, so the button starts live.
  let first = sql<Variant>(`
    select size, grind from variants
     where productId = ${product.id}
     order by (stock > 0) desc, position
     limit 1
  `).first();

  return new html({
    product,
    collection,
    photos: listPhotos(product.id),
    variants: variants.view({ productId: product.id }),
    initialSize: first?.size ?? "",
    initialGrind: first?.grind ?? "",
    isAdmin: currentUserIsAdmin(),
  });
}

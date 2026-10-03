import { Request, Response, sql } from "@elements/app";
import { adminPageOrRedirect } from "#app/shared/services/admin";
import { variants } from "#app/shared/services/catalog";
import html, { AdminProduct } from "./template";

export default function route(req: Request, res: Response) {
  if (!adminPageOrRedirect()) {
    return;
  }

  let products = sql<AdminProduct>(`
    select p.id, p.slug, p.name, p.published, p.featured, c.name as collectionName, c.position as collectionPosition, p.position,
           ph.id as photoId, ph.hash as photoHash
      from products p
      join collections c on c.id = p.collectionId
      left join lateral (
        select id, hash from productPhotos where productId = p.id order by position limit 1
      ) ph on true
     order by c.position, p.position, p.createdAt
  `).all();

  let collections = sql<{ id: string; name: string }>(`select id, name from collections order by position`).all();

  return new html({ products, collections, variants: variants.view() });
}

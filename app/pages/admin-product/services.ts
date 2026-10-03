import { File, NotFoundError, ValidationError, sql, tx } from "@elements/app";
import { isUserAdminOrThrow } from "#app/shared/services/admin";
import { Photo, Product, listPhotos } from "#app/shared/services/catalog";

export interface ProductForm {
  name: string;
  slug: string;
  collectionId: string;
  tagline: string;
  description: string;
  notes: string;
  origin: string;
  process: string;
  roast: string;
  published: boolean;
  featured: boolean;
}

// Uploads are raster only: an svg is a document that can carry script.
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);

const MAX_BYTES = 5 * 1024 * 1024;

/** @rpc */
export function saveProduct(id: string, form: ProductForm): Product {
  isUserAdminOrThrow();

  let slug = form.slug.trim().toLowerCase();

  if (!form.name.trim()) {
    throw new ValidationError({ name: ["A product needs a name"] });
  }

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    throw new ValidationError({ slug: ["Lowercase letters, numbers and dashes only"] });
  }

  if (!sql(`select 1 from products where slug = ${slug} and id <> ${id}`).empty()) {
    throw new ValidationError({ slug: ["Another product already uses this url"] });
  }

  return sql<Product>(`
    update products
       set name = ${form.name.trim()}, slug = ${slug}, collectionId = ${form.collectionId},
           tagline = ${form.tagline.trim()}, description = ${form.description.trim()}, notes = ${form.notes.trim()},
           origin = ${form.origin.trim()}, process = ${form.process.trim()}, roast = ${form.roast.trim()},
           published = ${form.published}, featured = ${form.featured}
     where id = ${id}
 returning id, collectionId, slug, name, tagline, description, notes, origin, process, roast, published, featured
  `).firstOrThrow();
}

/** @rpc */
export function uploadPhotos(productId: string, files: File[]): Photo[] {
  isUserAdminOrThrow();

  for (let f of files) {
    if (!ALLOWED.has(f.contentType)) {
      throw new ValidationError(`${f.name} is not a PNG, JPEG or WebP image.`);
    }

    if (f.size > MAX_BYTES) {
      throw new ValidationError(`${f.name} is over 5 MB.`);
    }
  }

  tx(() => {
    for (let f of files) {
      sql(`
        insert into productPhotos (productId, name, alt, contentType, data, position)
             values (${productId}, ${f.name}, '', ${f.contentType}, ${f.data},
                     (select coalesce(max(position), -1) + 1 from productPhotos where productId = ${productId}))
      `);
    }
  });

  return listPhotos(productId);
}

/** @rpc */
export function deletePhoto(photoId: string): Photo[] {
  isUserAdminOrThrow();

  let photo = sql<{ productId: string }>(`
    delete from productPhotos where id = ${photoId} returning productId
  `).first();

  if (!photo) {
    throw new NotFoundError("that photo is already gone");
  }

  return listPhotos(photo.productId);
}

/** Moves a photo to the front: it becomes the one on cards and the cart. */
/** @rpc */
export function makePrimary(photoId: string): Photo[] {
  isUserAdminOrThrow();

  let photo = sql<{ productId: string }>(`select productId from productPhotos where id = ${photoId}`).firstOrThrow();

  sql(`
    update productPhotos p
       set position = o.n
      from (
        select id, row_number() over (order by (id = ${photoId}) desc, position, createdAt) - 1 as n
          from productPhotos where productId = ${photo.productId}
      ) o
     where p.id = o.id
  `);

  return listPhotos(photo.productId);
}

import { LiveTable, sql } from "@elements/app";
import { isUserAdminOrThrow } from "#app/shared/services/admin";

export interface Collection {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
}

export interface Photo {
  id: string;
  productId: string;
  alt: string;
  hash: string;
  position: number;
}

export interface ProductCard {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  roast: string;
  collectionSlug: string;
  collectionName: string;
  fromCents: number;
  inStock: boolean;
  photoId: string | null;
  photoHash: string | null;
  photoAlt: string | null;
}

export interface Product {
  id: string;
  collectionId: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  notes: string;
  origin: string;
  process: string;
  roast: string;
  published: boolean;
  featured: boolean;
}

export interface Variant {
  id: string;
  productId: string;
  size: string;
  grind: string;
  priceCents: number;
  stock: number;
  position: number;
}

/**
 * Every write to variants is broadcast by the variantsNotify trigger, whatever
 * made it: checkout, a payment, the admin, psql. The channel is pinned so the
 * trigger and the views agree on it.
 */
export let variants: LiveTable<Variant> = new LiveTable<Variant>({
  channel: (partition) => (partition ? `variants:${partition}` : "variants"),
  fields: ["productId", "size", "grind", "priceCents", "stock", "position"],

  insert: (item) => {
    isUserAdminOrThrow();

    return variants.insert(item);
  },

  update: (item) => {
    isUserAdminOrThrow();

    return variants.update(item);
  },

  delete: (item) => {
    isUserAdminOrThrow();
    variants.delete(item);
  },
});

export function photoUrl(p: { id: string; hash: string }): string {
  return `/media/${p.id}/${p.hash}`;
}

export function cardPhotoUrl(p: ProductCard): string {
  return p.photoId && p.photoHash ? photoUrl({ id: p.photoId, hash: p.photoHash }) : "";
}

export function listCollections(): Collection[] {
  return sql<Collection>(`
    select id, slug, name, tagline, description
      from collections
     order by position
  `).all();
}

export function findCollection(slug: string): Collection | undefined {
  return sql<Collection>(`
    select id, slug, name, tagline, description from collections where slug = ${slug}
  `).first();
}

function cardSelect() {
  return sql.raw(`
  select p.id, p.slug, p.name, p.tagline, p.roast,
         c.slug as collectionSlug, c.name as collectionName,
         coalesce((select min(v.priceCents) from variants v where v.productId = p.id), 0)::int as fromCents,
         exists (select 1 from variants v where v.productId = p.id and v.stock > 0) as inStock,
         ph.id as photoId, ph.hash as photoHash, ph.alt as photoAlt
    from products p
    join collections c on c.id = p.collectionId
    left join lateral (
      select id, hash, alt from productPhotos where productId = p.id order by position limit 1
    ) ph on true
  `);
}

export function listProducts(collectionId?: string): ProductCard[] {
  if (collectionId) {
    return sql<ProductCard>(`
      ${cardSelect()}
      where p.published and p.collectionId = ${collectionId}
      order by p.position
    `).all();
  }

  return sql<ProductCard>(`
    ${cardSelect()}
    where p.published
    order by c.position, p.position
  `).all();
}

export function listFeatured(): ProductCard[] {
  return sql<ProductCard>(`
    ${cardSelect()}
    where p.published and p.featured
    order by c.position, p.position
    limit 4
  `).all();
}

export function findProduct(slug: string): Product | undefined {
  return sql<Product>(`
    select id, collectionId, slug, name, tagline, description, notes, origin, process, roast, published, featured
      from products
     where slug = ${slug}
  `).first();
}

export function listPhotos(productId: string): Photo[] {
  return sql<Photo>(`
    select id, productId, alt, hash, position
      from productPhotos
     where productId = ${productId}
     order by position, createdAt
  `).all();
}

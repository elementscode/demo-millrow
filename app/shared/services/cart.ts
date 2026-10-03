import { sql } from "@elements/app";
import { CartLine } from "#app/shared/cart";
import { shippingFor, variantLabel } from "#app/shared/money";

export interface PricedLine {
  variantId: string;
  productId: string;
  slug: string;
  productName: string;
  size: string;
  grind: string;
  label: string;
  unitCents: number;
  quantity: number;
  stock: number;
  photoId: string | null;
  photoHash: string | null;
}

export interface PricedCart {
  lines: PricedLine[];
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  itemCount: number;
}

/**
 * Prices a cart from the database. The browser sends only variant ids and
 * quantities; every amount comes from here.
 */
export function priceLines(lines: CartLine[]): PricedCart {
  let wanted = new Map<string, number>();

  for (let l of lines) {
    let quantity = Math.floor(Number(l.quantity));
    if (quantity > 0 && typeof l.variantId === "string") {
      wanted.set(l.variantId, (wanted.get(l.variantId) ?? 0) + Math.min(quantity, 99));
    }
  }

  let ids = [...wanted.keys()];
  let rows = ids.length === 0 ? [] : sql<Omit<PricedLine, "label" | "quantity">>(`
    select v.id as variantId, p.id as productId, p.slug, p.name as productName,
           v.size, v.grind, v.priceCents as unitCents, v.stock,
           ph.id as photoId, ph.hash as photoHash
      from variants v
      join products p on p.id = v.productId
      left join lateral (
        select id, hash from productPhotos where productId = p.id order by position limit 1
      ) ph on true
     where v.id = any(${ids}::uuid[]) and p.published
  `).all();

  let byId = new Map(rows.map((r) => [r.variantId, r]));
  let priced: PricedLine[] = [];

  for (let id of ids) {
    let row = byId.get(id);
    if (row) {
      priced.push({ ...row, label: variantLabel(row), quantity: wanted.get(id)! });
    }
  }

  let subtotalCents = priced.reduce((s, l) => s + l.unitCents * l.quantity, 0);
  let shippingCents = shippingFor(subtotalCents);

  return {
    lines: priced,
    subtotalCents,
    shippingCents,
    totalCents: subtotalCents + shippingCents,
    itemCount: priced.reduce((n, l) => n + l.quantity, 0),
  };
}

/** @rpc */
export function priceCart(lines: CartLine[]): PricedCart {
  return priceLines(lines);
}

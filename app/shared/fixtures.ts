import { session, sql } from "@elements/app";

/**
 * Rows for tests. Each test builds the catalog it needs inside its own
 * rolled-back transaction, with slugs that never collide with the seed's.
 */
export function makeProduct(opts: { slug?: string; published?: boolean; variants?: [number, number][] } = {}) {
  let collection = sql<{ id: string }>(`
    insert into collections (slug, name) values (${"c-" + Math.random().toString(36).slice(2)}, 'Test') returning id
  `).firstOrThrow();

  let product = sql<{ id: string }>(`
    insert into products (collectionId, slug, name, published)
         values (${collection.id}, ${opts.slug ?? "p-" + Math.random().toString(36).slice(2)}, 'Test Coffee', ${opts.published ?? true})
      returning id
  `).firstOrThrow();

  let variantIds = (opts.variants ?? [[2000, 10]]).map(([priceCents, stock], i) => sql<{ id: string }>(`
    insert into variants (productId, size, grind, priceCents, stock, position)
         values (${product.id}, '12 oz', ${"Grind " + i}, ${priceCents}, ${stock}, ${i})
      returning id
  `).firstOrThrow().id);

  return { collectionId: collection.id, productId: product.id, variantIds };
}

export function makeOrder(status: string, lines: { variantId: string; quantity: number; unitCents: number }[], email = "buyer@example.com") {
  let total = lines.reduce((s, l) => s + l.unitCents * l.quantity, 0);
  let order = sql<{ id: string; number: number }>(`
    insert into orders (status, email, name, address1, city, region, postalCode, itemCount, subtotalCents, totalCents)
         values (${status}::orderStatus, ${email}, 'Buyer', '1 Main St', 'Portland', 'OR', '97205', ${lines.length}, ${total}, ${total})
      returning id, number
  `).firstOrThrow();

  for (let l of lines) {
    sql(`
      insert into orderLines (orderId, variantId, productName, variantLabel, unitCents, quantity)
           values (${order.id}, ${l.variantId}, 'Test Coffee', '12 oz', ${l.unitCents}, ${l.quantity})
    `);
  }

  return order;
}

export function loginAdmin() {
  let user = sql<{ id: string }>(`
    insert into users (email, name, passwordHash, role)
         values ('owner@example.com', 'Owner', crypt('pw', genSalt('bf', 4)), 'admin')
      returning id
  `).firstOrThrow();

  session.login({ userId: user.id, userName: "Owner" });
}

export function stockOf(variantId: string): number {
  return sql<{ stock: number }>(`select stock from variants where id = ${variantId}`).firstOrThrow().stock;
}

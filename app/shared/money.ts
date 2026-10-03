import config from "#config";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function money(cents: number): string {
  return usd.format(cents / 100);
}

/** Whole dollars when there are no cents: $22 rather than $22.00. */
export function price(cents: number): string {
  return cents % 100 === 0 ? `$${cents / 100}` : money(cents);
}

export function shippingFor(subtotalCents: number): number {
  if (subtotalCents === 0 || subtotalCents >= config.store.freeShippingCents) {
    return 0;
  }

  return config.store.shippingCents;
}

export function variantLabel(v: { size: string; grind: string }): string {
  return [v.size, v.grind].filter(Boolean).join(" · ");
}

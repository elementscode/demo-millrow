import { LiveTable, sql, tx } from "@elements/app";

export type OrderStatus = "pending" | "paid" | "shipped" | "refunded" | "cancelled";

/** The row the admin list and the dashboard hold live. */
export interface OrderRow {
  id: string;
  number: number;
  status: OrderStatus;
  email: string;
  name: string;
  city: string;
  region: string;
  itemCount: number;
  totalCents: number;
  carrier: string;
  trackingNumber: string;
  createdAt: Date;
}

export interface Order extends OrderRow {
  address1: string;
  address2: string;
  postalCode: string;
  country: string;
  subtotalCents: number;
  shippingCents: number;
  paymentIntentId: string | null;
  paidAt: Date | null;
  shippedAt: Date | null;
  refundedAt: Date | null;
}

export interface OrderItem {
  id: string;
  productName: string;
  variantLabel: string;
  unitCents: number;
  quantity: number;
  slug: string | null;
  photoId: string | null;
  photoHash: string | null;
}

export interface OrderDetail {
  order: Order;
  items: OrderItem[];
}

/**
 * Orders are written by checkout, Stripe, jobs and the admin, all through sql;
 * the ordersNotify trigger turns each write into this table's broadcast.
 */
export let orders: LiveTable<OrderRow> = new LiveTable<OrderRow>({
  channel: (partition) => (partition ? `orders:${partition}` : "orders"),

  select: () => sql<OrderRow>(`
    select id, number, status, email, name, city, region, itemCount, totalCents,
           carrier, trackingNumber, createdAt
      from orders
     where status <> 'pending' and status <> 'cancelled'
  `),

  insert: () => {
    throw new Error("orders are placed through checkout");
  },

  update: () => {
    throw new Error("orders change through their own rpc");
  },

  delete: () => {
    throw new Error("orders are never deleted");
  },
});

export function carrierUrl(carrier: string, tracking: string): string {
  let n = encodeURIComponent(tracking);

  switch (carrier) {
    case "UPS":
      return `https://www.ups.com/track?tracknum=${n}`;

    case "FedEx":
      return `https://www.fedex.com/fedextrack/?trknbr=${n}`;

    case "DHL":
      return `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${n}`;

    default:
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`;
  }
}

export function statusLabel(status: OrderStatus): string {
  switch (status) {
    case "pending":
      return "Awaiting payment";

    case "paid":
      return "Paid, preparing to ship";

    case "shipped":
      return "Shipped";

    case "refunded":
      return "Refunded";

    default:
      return "Cancelled";
  }
}

export function statusIntent(status: OrderStatus): string {
  switch (status) {
    case "paid":
      return "is-info";

    case "shipped":
      return "is-success";

    case "refunded":
      return "is-warning";

    case "cancelled":
      return "is-danger";

    default:
      return "";
  }
}

export function loadOrder(id: string): OrderDetail | undefined {
  let order = sql<Order>(`
    select id, number, status, email, name, address1, address2, city, region, postalCode, country,
           itemCount, subtotalCents, shippingCents, totalCents, carrier, trackingNumber,
           paymentIntentId, createdAt, paidAt, shippedAt, refundedAt
      from orders
     where id = ${id}
  `).first();

  if (!order) {
    return undefined;
  }

  let items = sql<OrderItem>(`
    select l.id, l.productName, l.variantLabel, l.unitCents, l.quantity, p.slug,
           ph.id as photoId, ph.hash as photoHash
      from orderLines l
      left join products p on p.id = l.productId
      left join lateral (
        select id, hash from productPhotos where productId = l.productId order by position limit 1
      ) ph on true
     where l.orderId = ${id}
     order by l.createdAt, l.id
  `).all();

  return { order, items };
}

/**
 * Puts a pending order's stock back and cancels it. Safe to call twice: only
 * the call that moves the order out of pending restores anything.
 */
export function releaseOrder(orderId: string): boolean {
  return tx(() => {
    let cancelled = sql(`
      update orders set status = 'cancelled' where id = ${orderId} and status = 'pending' returning id
    `).first();

    if (!cancelled) {
      return false;
    }

    sql(`
      update variants v
         set stock = v.stock + l.quantity
        from orderLines l
       where l.orderId = ${orderId} and l.variantId = v.id
    `);

    return true;
  });
}

import { Channel, sql } from "@elements/app";
import { isUserAdminOrThrow } from "#app/shared/services/admin";

/**
 * The ordersNotify trigger fires this on every order write, so the dashboard
 * hears about a sale however it happened.
 */
export const storeActivity = new Channel<{ orderId: string }>("storeActivity");

export interface Period {
  revenueCents: number;
  orders: number;
}

export interface DayRevenue {
  day: Date;
  revenueCents: number;
  orders: number;
}

export interface TopProduct {
  name: string;
  slug: string | null;
  units: number;
  revenueCents: number;
}

export interface Dashboard {
  today: Period;
  week: Period;
  month: Period;
  toShip: number;
  days: DayRevenue[];
  top: TopProduct[];
}

/** Refunded orders are not revenue; pending and cancelled never were. */
export function loadDashboard(): Dashboard {
  let periods = sql<{
    todayCents: number; todayOrders: number;
    weekCents: number; weekOrders: number;
    monthCents: number; monthOrders: number;
    toShip: number;
  }>(`
    select coalesce(sum(totalCents) filter (where createdAt >= date_trunc('day', now())), 0)::int as todayCents,
           (count(*) filter (where createdAt >= date_trunc('day', now())))::int as todayOrders,
           coalesce(sum(totalCents) filter (where createdAt >= date_trunc('week', now())), 0)::int as weekCents,
           (count(*) filter (where createdAt >= date_trunc('week', now())))::int as weekOrders,
           coalesce(sum(totalCents) filter (where createdAt >= date_trunc('month', now())), 0)::int as monthCents,
           (count(*) filter (where createdAt >= date_trunc('month', now())))::int as monthOrders,
           (select count(*) from orders where status = 'paid')::int as toShip
      from orders
     where status in ('paid', 'shipped')
  `).firstOrThrow();

  let days = sql<DayRevenue>(`
    select d.day,
           coalesce(sum(o.totalCents), 0)::int as revenueCents,
           count(o.id)::int as orders
      from generate_series(date_trunc('day', now()) - interval '13 days', date_trunc('day', now()), interval '1 day') as d(day)
      left join orders o
        on o.createdAt >= d.day and o.createdAt < d.day + interval '1 day' and o.status in ('paid', 'shipped')
     group by d.day
     order by d.day
  `).all();

  let top = sql<TopProduct>(`
    select l.productName as name, p.slug,
           sum(l.quantity)::int as units,
           sum(l.quantity * l.unitCents)::int as revenueCents
      from orderLines l
      join orders o on o.id = l.orderId
      left join products p on p.id = l.productId
     where o.status in ('paid', 'shipped') and o.createdAt >= date_trunc('month', now())
     group by l.productName, p.slug
     order by revenueCents desc
     limit 5
  `).all();

  return {
    today: { revenueCents: periods.todayCents, orders: periods.todayOrders },
    week: { revenueCents: periods.weekCents, orders: periods.weekOrders },
    month: { revenueCents: periods.monthCents, orders: periods.monthOrders },
    toShip: periods.toShip,
    days,
    top,
  };
}

/** @rpc */
export function fetchDashboard(): Dashboard {
  isUserAdminOrThrow();

  return loadDashboard();
}

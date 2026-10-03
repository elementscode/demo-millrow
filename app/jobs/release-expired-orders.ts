import { Job, sql } from "@elements/app";
import { releaseOrder } from "#app/shared/services/orders";

export interface ReleaseExpiredOrdersJobFields {}

/**
 * Cancels orders whose Checkout Session has expired unpaid and returns their
 * held stock to the shelf.
 */
export class ReleaseExpiredOrdersJob extends Job<ReleaseExpiredOrdersJobFields> {
  run() {
    let stale = sql<{ id: string }>(`
      select id from orders where status = 'pending' and createdAt < now() - interval '35 minutes'
    `).all();

    for (let o of stale) {
      releaseOrder(o.id);
    }
  }
}

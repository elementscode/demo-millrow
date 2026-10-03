import { sql, session, redirect, ForbiddenError } from "@elements/app";

export function isUserAdmin(userId: string): boolean {
  return !sql(`select 1 from users where id = ${userId} and role = 'admin'`).empty();
}

export function isUserAdminOrThrow() {
  session.isLoggedInOrThrow();

  if (!isUserAdmin(session.getOrThrow("userId"))) {
    throw new ForbiddenError("admin access required");
  }
}

/** For the storefront header: true only for a signed-in admin. */
export function currentUserIsAdmin(): boolean {
  let userId = session.get("userId");

  return userId !== undefined && isUserAdmin(userId);
}

/**
 * The guard for admin page routes. A visitor with no session is sent to sign
 * in; a signed-in non-admin still gets the 403.
 */
export function adminPageOrRedirect(): boolean {
  if (!session.isLoggedIn()) {
    redirect("/signin");
    return false;
  }

  isUserAdminOrThrow();

  return true;
}

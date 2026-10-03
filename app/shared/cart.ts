export interface CartLine {
  variantId: string;
  quantity: number;
}

export interface Cart {
  lines: CartLine[];
}

const KEY = "millrow.cart";

/**
 * A guest has no session, so the cart lives in the browser and is priced by
 * the server whenever it is shown. Call from oninit: it reads localStorage.
 */
export function loadCart(cart: Cart) {
  try {
    let lines = JSON.parse(localStorage.getItem(KEY) ?? "[]") as CartLine[];
    cart.lines = lines.filter((l) => typeof l.variantId === "string" && l.quantity > 0);
  } catch {
    cart.lines = [];
  }
}

export function saveCart(cart: Cart) {
  localStorage.setItem(KEY, JSON.stringify(cart.lines));
}

export function addToCart(cart: Cart, variantId: string, quantity: number) {
  let line = cart.lines.find((l) => l.variantId === variantId);

  if (line) {
    line.quantity += quantity;
  } else {
    cart.lines.push({ variantId, quantity });
  }

  saveCart(cart);
}

export function setQuantity(cart: Cart, variantId: string, quantity: number) {
  if (quantity <= 0) {
    cart.lines = cart.lines.filter((l) => l.variantId !== variantId);
  } else {
    let line = cart.lines.find((l) => l.variantId === variantId);
    if (line) {
      line.quantity = quantity;
    }
  }

  saveCart(cart);
}

export function clearCart(cart: Cart) {
  cart.lines = [];
  saveCart(cart);
}

export function cartCount(cart: Cart): number {
  return cart.lines.reduce((n, l) => n + l.quantity, 0);
}

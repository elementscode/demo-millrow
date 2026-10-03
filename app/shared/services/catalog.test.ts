import { test, equal, assert, AuthError } from "@elements/app";
import { listProducts, variants } from "#app/shared/services/catalog";
import { loginAdmin, makeProduct, stockOf } from "#app/shared/fixtures";

test("catalog", () => {
  test("a card shows the lowest price and whether anything is in stock", () => {
    let { collectionId } = makeProduct({ variants: [[5800, 0], [2200, 0]] });
    let [card] = listProducts(collectionId);

    equal(card.fromCents, 2200);
    equal(card.inStock, false);
  });

  test("drafts stay out of the shop", () => {
    let { collectionId } = makeProduct({ published: false });

    equal(listProducts(collectionId).length, 0);
  });

  test("a shopper cannot change stock", () => {
    let { productId, variantIds } = makeProduct({ variants: [[2000, 4]] });
    let view = variants.view({ productId });
    let threw = false;

    try {
      view.update({ ...view.get(variantIds[0])!, stock: 999 });
    } catch (err) {
      threw = true;
      assert(err instanceof AuthError, `got ${err}`);
    }

    assert(threw);
    equal(stockOf(variantIds[0]), 4);
  });

  test("the owner can", () => {
    loginAdmin();
    let { productId, variantIds } = makeProduct({ variants: [[2000, 4]] });
    let view = variants.view({ productId });

    view.update({ ...view.get(variantIds[0])!, stock: 12 });

    equal(stockOf(variantIds[0]), 12);
  });
});

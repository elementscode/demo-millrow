import { test, equal, assert, sql, AuthError } from "@elements/app";
import { createProduct, slugify } from "./template";
import { loginAdmin, makeProduct } from "#app/shared/fixtures";

test("creating a product", () => {
  test("slugs drop accents and punctuation", () => {
    equal(slugify("Colombia Huila El Paraíso!"), "colombia-huila-el-paraiso");
  });

  test("starts as a draft with a unique url", () => {
    loginAdmin();
    let { collectionId } = makeProduct({ slug: "house-blend" });
    let id = createProduct("House Blend", collectionId);

    let p = sql<{ slug: string; published: boolean }>(`select slug, published from products where id = ${id}`).firstOrThrow();
    equal(p.slug, "house-blend-2");
    equal(p.published, false);
  });

  test("is admin only", () => {
    let { collectionId } = makeProduct();
    let threw = false;

    try {
      createProduct("Sneaky", collectionId);
    } catch (err) {
      threw = err instanceof AuthError;
    }

    assert(threw);
  });
});

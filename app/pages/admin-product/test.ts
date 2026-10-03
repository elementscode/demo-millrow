import { test, equal, assert, ValidationError } from "@elements/app";
import { saveProduct } from "./services";
import { loginAdmin, makeProduct } from "#app/shared/fixtures";

function form(collectionId: string, slug: string) {
  return {
    name: "Renamed", slug, collectionId, tagline: "", description: "", notes: "",
    origin: "", process: "", roast: "", published: true, featured: false,
  };
}

test("editing a product", () => {
  test("saves the details", () => {
    loginAdmin();
    let { productId, collectionId } = makeProduct();

    equal(saveProduct(productId, form(collectionId, "renamed")).name, "Renamed");
  });

  test("rejects a url another product uses", () => {
    loginAdmin();
    makeProduct({ slug: "taken" });
    let { productId, collectionId } = makeProduct();
    let err: any;

    try {
      saveProduct(productId, form(collectionId, "taken"));
    } catch (e) {
      err = e;
    }

    assert(err instanceof ValidationError, `got ${err}`);
    assert(err.errors?.slug !== undefined);
  });
});

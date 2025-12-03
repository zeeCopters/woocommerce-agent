import { tool } from "langchain";
import { client } from "../services/wcClient.js";
import * as z from "zod";

const ProductSchema = z.object({
  id: z.number(),
  name: z.string(),
  sku: z.string().optional(),
  price: z.union([z.string(), z.number()]).optional(),
});

const ProductsArray = z.array(ProductSchema);

export const getProductsTool = tool(
  async (input = {}) => {
    //console.log("Get Products Tool called");
    try {
      const all = [];
      const perPage = 100;
      let page = 1;
      while (true) {
        const res = await client.get("/products", {
          params: { per_page: perPage, page },
        });
        const products = res.data;
        if (!Array.isArray(products) || products.length === 0) break;
        all.push(...products);
        if (products.length < perPage) break;
        page += 1;
      }
      // validate best-effort
      const safe = ProductsArray.parse(
        all.map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          price: p.price ?? p.regular_price ?? p.sale_price,
        }))
      );
      return JSON.stringify({ total: safe.length, products: safe }, null, 2);
    } catch (err) {
      return `ERROR fetching products: ${err.message}`;
    }
  },
  {
    name: "get_products",
    description:
      "Get the list of products from the WooCommerce API. Returns JSON.",
  }
);

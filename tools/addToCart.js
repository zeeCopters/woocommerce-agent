import { tool } from "langchain";
import * as z from "zod";
import {
  ensureAgentSessionCookie,
  addOrUpdateCartItem,
  findProductIdByName,
} from "../services/cartService.js";

import { setCartForSession } from "../utils/sessionStore.js";

const AddToCartSchema = z.object({
  productName: z.string(),
  quantity: z.number().int().positive(),
});

export const addToCartTool = tool(
  async (input) => {
    try {
      const payload = AddToCartSchema.parse(input);

      const sessionId = await ensureAgentSessionCookie();

      const pid = await findProductIdByName(payload.productName);
      if (!pid) return `Product "${payload.productName}" not found.`;

      const updatedOrder = await addOrUpdateCartItem(
        sessionId,
        pid,
        payload.quantity
      );

      // 🔥 VERY IMPORTANT — store cart ID
      setCartForSession(sessionId, updatedOrder.id);

      const items = (updatedOrder.line_items || []).map((it) => ({
        id: it.id,
        product_id: it.product_id,
        quantity: it.quantity,
        subtotal: it.subtotal,
        total: it.total,
      }));

      return JSON.stringify(
        {
          message: "Item added to cart",
          cart_order_id: updatedOrder.id,
          items,
          order_status: updatedOrder.status,
        },
        null,
        2
      );
    } catch (err) {
      if (err?.errors) {
        return `Invalid input: ${JSON.stringify(err.errors)}`;
      }
      return `AddToCart error: ${err.message}`;
    }
  },
  {
    name: "add_to_cart",
    description:
      "Add a product to the cart. Input: { productName: string, quantity: number }",
    schema: AddToCartSchema,
  }
);

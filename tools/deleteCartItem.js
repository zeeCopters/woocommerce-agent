import { tool } from "langchain";
import * as z from "zod";
import { client } from "../services/wcClient.js";
import {
  getAgentSessionId,
  getCartForSession,
  setCartForSession,
} from "../utils/sessionStore.js";

const DeleteItemSchema = z.object({
  productName: z.string(),
});

export const deleteCartItemTool = tool(
  async (input) => {
    try {
      const { productName } = DeleteItemSchema.parse(input);

      const sessionId = getAgentSessionId();
      if (!sessionId) return "No active session found.";

      const orderId = getCartForSession(sessionId);
      if (!orderId) return "Cart is empty.";

      const res = await client.get(`/orders/${orderId}`);
      const order = res.data;

      const item = (order.line_items || []).find(
        (li) => li.name.toLowerCase() === productName.toLowerCase()
      );

      if (!item) return `Item "${productName}" not found in cart.`;

      await client.put(`/orders/${orderId}`, {
        line_items: [
          {
            id: item.id,
            quantity: 0,
          },
        ],
      });

      // 🔥 Check if cart is now empty
      const updated = await client.get(`/orders/${orderId}`);
      if (!updated.data.line_items.length) {
        setCartForSession(sessionId, null);
      }

      return `🗑️ Removed "${productName}" from your cart.`;
    } catch (err) {
      console.error("deleteCartItem error:", err.response?.data || err.message);
      return `Failed to delete item: ${err.message}`;
    }
  },
  {
    name: "delete_cart_item",
    description:
      "Delete a specific item from the cart. Input: { productName: string }",
    schema: DeleteItemSchema,
  }
);

// import { tool } from "langchain";
// import * as z from "zod";
// import { client } from "../services/wcClient.js";
// import { getAgentSessionId, getCartForSession } from "../utils/sessionStore.js";

// const DeleteItemSchema = z.object({
//   productName: z.string(),
// });

// export const deleteCartItemTool = tool(
//   async (input) => {
//     try {
//       const { productName } = DeleteItemSchema.parse(input);

//       const sessionId = getAgentSessionId();
//       if (!sessionId) return "No active session found.";

//       const orderId = getCartForSession(sessionId);
//       if (!orderId) return "Cart is empty.";

//       const res = await client.get(`/orders/${orderId}`);
//       const order = res.data;

//       const item = (order.line_items || []).find(
//         (li) => li.name.toLowerCase() === productName.toLowerCase()
//       );

//       if (!item) return `Item "${productName}" not found in cart.`;

//       // WooCommerce required deletion format
//       const updateRes = await client.put(`/orders/${orderId}`, {
//         line_items: [
//           {
//             id: item.id,
//             quantity: 0, // ← THIS DELETES THE ITEM
//           },
//         ],
//       });

//       return `🗑️ Removed "${productName}" from your cart.`;
//     } catch (err) {
//       console.error("deleteCartItem error:", err.response?.data || err.message);
//       return `Failed to delete item: ${err.message}`;
//     }
//   },
//   {
//     name: "delete_cart_item",
//     description:
//       "Delete a specific item from the cart. Input: { productName: string }",
//     schema: DeleteItemSchema,
//   }
// );

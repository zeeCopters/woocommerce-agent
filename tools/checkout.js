// import { tool } from "@langchain/core/tools";
// import WooCommerceService from "../services/wooService.js";
// import SessionService from "../services/sessionService.js";

// export const checkoutTool = tool({
//   name: "checkout",
//   description:
//     "Finalize a WooCommerce order using stored shipping/billing + cart items.",
//   func: async ({ sessionId }) => {
//     try {
//       const woo = new WooCommerceService();
//       const session = new SessionService();

//       // Load saved data
//       const billing = session.get(`billing_${sessionId}`);
//       const shipping = session.get(`shipping_${sessionId}`);
//       const orderId = session.get(`current_order_${sessionId}`);

//       if (!orderId) {
//         return "No active order found. Your cart seems empty.";
//       }
//       if (!billing || !shipping) {
//         return "Missing billing or shipping details before checkout.";
//       }

//       // 1️⃣ Fetch the existing Woo order (cart)
//       const order = await woo.getOrder(orderId);

//       if (!order.line_items || order.line_items.length === 0) {
//         return "Your cart is empty.";
//       }

//       // 2️⃣ Build minimal line_items for WooCommerce update
//       const itemsForUpdate = order.line_items.map((li) => ({
//         id: li.id, // WooCommerce requires line item ID when updating an existing order
//         product_id: li.product_id,
//         quantity: li.quantity,
//       }));

//       // 3️⃣ Update order → billing, shipping, status, line_items
//       const updatedOrder = await woo.updateOrder(orderId, {
//         billing,
//         shipping,
//         status: "completed",
//         line_items: itemsForUpdate, // IMPORTANT: send minimal valid fields only
//       });

//       // 4️⃣ Clear session cart after successful checkout
//       session.delete(`current_order_${sessionId}`);
//       session.delete(`cart_items_${sessionId}`);

//       return `✅ Order #${updatedOrder.id} has been placed successfully!`;
//     } catch (err) {
//       console.error("Checkout error:", err.response?.data || err.message);
//       return "Checkout failed. " + (err.response?.data?.message || err.message);
//     }
//   },
//   schema: {
//     type: "object",
//     properties: {
//       sessionId: { type: "string" },
//     },
//     required: ["sessionId"],
//   },
// });

import { tool } from "langchain";
import * as z from "zod";

export const checkoutTool = tool(
  async ({ sessionId, sessionStore, client }) => {
    if (!sessionId) return "No active session.";

    const billing = sessionStore.get(`billing_${sessionId}`);
    const shipping = sessionStore.get(`shipping_${sessionId}`);
    const orderId = sessionStore.get(`cart_${sessionId}`);
    const line_items = sessionStore.get(`cart_items_${sessionId}`); // <- USE THIS

    if (!billing) return "Please provide your billing details first.";
    if (!shipping) return "Please provide your shipping details first.";
    if (!orderId || !line_items?.length) return "Your cart is empty.";

    const itemsForUpdate = line_items.map((li) => ({
      id: li.id, // required if updating existing line item
      product_id: li.product_id,
      quantity: li.quantity,
      // optionally variation_id or meta_data if needed
    }));

    const updatedOrder = await client.put(`/orders/${orderId}`, {
      billing,
      shipping,
      status: "completed",
      line_items: itemsForUpdate,
    });

    sessionStore.set(`customer_${sessionId}`, updatedOrder.data.customer_id);

    return `✅ Order #${updatedOrder.data.id} has been placed successfully!`;
  },
  {
    name: "checkout",
    description: "Finalize the order with billing & shipping details.",
    schema: z.object({
      sessionId: z.string(),
      sessionStore: z.any(),
      client: z.any(),
    }),
  }
);

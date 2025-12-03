// tools/checkout.js
import { tool } from "langchain";
import * as z from "zod";
import { setCustomerId, setCartForSession } from "../utils/sessionStore.js";

export const checkoutTool = tool(
  async ({ sessionId, sessionStore, client }) => {
    if (!sessionId) return "No active session.";

    // read saved data
    const billing = sessionStore.get(`billing_${sessionId}`);
    const shipping = sessionStore.get(`shipping_${sessionId}`);
    const orderId = sessionStore.get(`cart_${sessionId}`);

    if (!billing) return "Please provide your billing details first.";
    if (!shipping) return "Please provide your shipping details first.";
    if (!orderId) return "Your cart is empty.";

    // 1) fetch current order from WooCommerce to get line_item ids
    const currentOrderRes = await client.get(`/orders/${orderId}`);
    const currentOrder = currentOrderRes.data;

    // 2) prepare minimal line_items update array accepted by WooCommerce:
    // use { id, quantity } for existing line items.
    const line_items_update = (currentOrder.line_items || []).map((li) => {
      // li.id is the line item id within the order (not product_id)
      // If li.id exists, use it. Otherwise fallback to product_id + quantity.
      if (li.id) {
        return { id: li.id, quantity: li.quantity };
      }
      return { product_id: li.product_id, quantity: li.quantity };
    });

    // 3) update order: include billing, shipping, status and minimal line_items
    const updatedRes = await client.put(`/orders/${orderId}`, {
      billing,
      shipping,
      status: "completed",
      line_items: line_items_update,
    });

    const updatedOrder = updatedRes.data;

    // 4) set optional customer id in session and clear the cart mapping
    if (updatedOrder.customer_id) {
      setCustomerId(sessionId, updatedOrder.customer_id);
    }

    // remove the cart pointer so the session has no "pending cart"
    setCartForSession(sessionId, null);

    return `✅ Order #${updatedOrder.id} has been placed successfully!`;
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

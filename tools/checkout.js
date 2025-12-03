import { tool } from "langchain";
import * as z from "zod";

export const checkoutTool = tool(
  async ({ sessionId, sessionStore, client }) => {
    if (!sessionId) return "No active session.";

    const billing = sessionStore.get(`billing_${sessionId}`);
    const shipping = sessionStore.get(`shipping_${sessionId}`);
    const orderId = sessionStore.get(`cart_${sessionId}`);

    if (!billing) return "Please provide your billing details first.";
    if (!shipping) return "Please provide your shipping details first.";
    if (!orderId) return "Your cart is empty.";

    // ✅ Get current cart items from your session/cartService
    const currentOrderRes = await client.get(`/orders/${orderId}`);
    const currentOrder = currentOrderRes.data;

    const line_items = (currentOrder.line_items || []).map((li) => ({
      product_id: li.product_id,
      quantity: li.quantity,
    }));

    if (!line_items.length) {
      return "Your cart is empty. Cannot checkout.";
    }

    // ✅ Finalize the order
    const updatedOrder = await client.put(`/orders/${orderId}`, {
      billing,
      shipping,
      status: "completed",
      line_items, // send the items properly
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

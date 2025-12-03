import { tool } from "langchain";
import * as z from "zod";
import { setCustomerId } from "../utils/sessionStore.js";

export const checkoutTool = tool(
  async ({ sessionId, sessionStore, client }) => {
    if (!sessionId) return "No active session.";

    const billing = sessionStore.get(`billing_${sessionId}`);
    const shipping = sessionStore.get(`shipping_${sessionId}`);
    const orderId = sessionStore.get(`cart_${sessionId}`);

    if (!billing) return "Please provide your billing details first.";
    if (!shipping) return "Please provide your shipping details first.";
    if (!orderId) return "Your cart is empty.";

    // ✅ Only update billing, shipping, and status
    const updatedOrder = await client.put(`/orders/${orderId}`, {
      billing,
      shipping,
      status: "completed",
    });

    // Save customer ID in session
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

// export const checkoutTool = tool(
//   async ({ sessionId, sessionStore, client }) => {
//     if (!sessionId) return "No active session.";

//     const billing = sessionStore.get(`billing_${sessionId}`);
//     const shipping = sessionStore.get(`shipping_${sessionId}`);
//     const orderId = sessionStore.get(`cart_${sessionId}`);

//     if (!billing) return "Please provide your billing details first.";
//     if (!shipping) return "Please provide your shipping details first.";
//     if (!orderId) return "Your cart is empty.";

//     const order = await client.put(`/orders/${orderId}`, {
//       billing,
//       shipping,
//       status: "completed",
//     });

//     setCustomerId(sessionId, order.customer_id);

//     return `✅ Order #${order.data.id} has been placed successfully!`;
//   },
//   {
//     name: "checkout",
//     description: "Finalize the order with billing & shipping details.",
//     schema: z.object({
//       sessionId: z.string(),
//       sessionStore: z.any(),
//       client: z.any(),
//     }),
//   }
// );

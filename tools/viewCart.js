import { tool } from "langchain";
import { client } from "../services/wcClient.js";
import { getAgentSessionId, getCartForSession } from "../utils/sessionStore.js";

export const viewCartTool = tool(
  async () => {
    try {
      const sessionId = getAgentSessionId();
      if (!sessionId) return "No session found. Your cart is empty.";

      const orderId = getCartForSession(sessionId);
      if (!orderId) return "Your cart is empty.";

      const res = await client.get(`/orders/${orderId}`);
      const order = res.data;

      if (!order.line_items.length) return "Your cart is empty.";

      const summary = order.line_items
        .map((i) => `${i.name} x ${i.quantity}`)
        .join("\n");

      return `Cart contents:\n${summary}`;
    } catch (err) {
      return `ERROR: ${err.message}`;
    }
  },
  {
    name: "view_cart",
    description: "Returns the current cart contents for the session",
  }
);

import { tool } from "langchain";
import { client } from "../services/wcClient.js";
import {
  getCartForSession,
  getAgentSessionId,
  setCartForSession,
} from "../utils/sessionStore.js";

export const clearCartTool = tool(
  async () => {
    try {
      const sessionId = getAgentSessionId();
      if (!sessionId) return "No active session found.";

      const orderId = getCartForSession(sessionId);
      if (!orderId) return "Cart is already empty.";

      const res = await client.get(`/orders/${orderId}`);
      const order = res.data;

      if (!order.line_items.length) return "Cart is already empty.";

      const removeAllItems = order.line_items.map((item) => ({
        id: item.id,
        quantity: 0,
      }));

      await client.put(`/orders/${orderId}`, {
        line_items: removeAllItems,
      });

      // 🔥 CLEAR SESSION CART
      setCartForSession(sessionId, null);

      return "🧹 Cart has been cleared successfully.";
    } catch (err) {
      console.error("clearCart error:", err.response?.data || err.message);
      return `Failed to clear cart: ${err.message}`;
    }
  },
  {
    name: "clear_cart",
    description: "Remove all items from cart for the current session.",
  }
);

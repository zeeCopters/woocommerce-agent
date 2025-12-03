import { tool } from "langchain";
import { client } from "../services/wcClient.js";
import { getAgentSessionId, getCustomerId } from "../utils/sessionStore.js";

export const getMyOrdersTool = tool(
  async () => {
    try {
      const sessionId = getAgentSessionId();
      if (!sessionId) return "No active session found.";

      // Fetch WooCommerce customer ID mapped to this LLM session
      const customerId = getCustomerId(sessionId);
      if (!customerId) return "No WooCommerce customer found for this session.";

      // Fetch all orders for this customer
      const res = await client.get("/orders", {
        params: {
          customer: customerId,
          per_page: 20,
          orderby: "date",
          order: "desc",
        },
      });

      const orders = res.data;

      if (!orders.length) return "You have no previous orders.";

      return orders.map((order) => ({
        order_id: order.id,
        status: order.status,
        total: order.total,
        created_at: order.date_created,
        items: order.line_items.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          total: i.total,
        })),
      }));
    } catch (err) {
      console.error(
        "getMyOrdersTool error:",
        err.response?.data || err.message
      );
      return `Failed to fetch your orders: ${err.message}`;
    }
  },
  {
    name: "get_my_orders",
    description: "Fetches the user's previous WooCommerce orders.",
  }
);

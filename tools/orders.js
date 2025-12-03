import { tool } from "langchain";
import * as z from "zod";
import { client } from "../services/wcClient.js";

const OrdersSchema = z.object({
  email: z.string().optional(), // If not provided → fallback to last used email
  orderId: z.number().optional(), // Fetch a specific order
});

export const ordersTool = tool(
  async (input) => {
    try {
      const { email, orderId } = OrdersSchema.parse(input);

      if (!email && !orderId) {
        return { message: "No email or orderId provided.", orders: [] };
      }

      // Fetch a specific order by ID
      if (orderId) {
        const res = await client.get(`/orders/${orderId}`);
        const order = res.data;

        const items = (order.line_items || []).map((li) => ({
          name: li.name,
          qty: li.quantity,
          total: li.total,
        }));

        return {
          message: `Order #${order.id} details.`,
          orders: [
            {
              id: order.id,
              status: order.status,
              total: order.total,
              items,
            },
          ],
        };
      }

      // Fetch orders by email (guest checkout supported)
      const res = await client.get("/orders", {
        params: {
          billing_email: email,
          status: "completed", // you wanted only completed orders
        },
      });

      const ordersData = res.data || [];

      const orders = ordersData.map((order) => {
        const items = (order.line_items || []).map((li) => ({
          name: li.name,
          qty: li.quantity,
          total: li.total,
        }));

        return {
          id: order.id,
          status: order.status,
          total: order.total,
          items,
        };
      });

      return {
        message: `Found ${orders.length} completed order(s) for ${email}.`,
        orders,
      };
    } catch (err) {
      console.error("ordersTool error:", err.response?.data || err.message);
      return { message: `Failed to load orders: ${err.message}`, orders: [] };
    }
  },
  {
    name: "get_orders",
    description: "Fetch WooCommerce orders by billing email or order ID.",
    schema: OrdersSchema,
  }
);

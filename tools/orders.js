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

// import { tool } from "langchain";
// import * as z from "zod";
// import { client } from "../services/wcClient.js";

// const OrdersSchema = z.object({
//   email: z.string().optional(), // If not provided → fallback to last used email
//   orderId: z.number().optional(), // Fetch a specific order
// });

// export const ordersTool = tool(
//   async (input) => {
//     try {
//       const { email, orderId } = OrdersSchema.parse(input);

//       // 1) If user asks for a specific order
//       if (orderId) {
//         const res = await client.get(`/orders/${orderId}`);
//         return res.data;
//       }

//       if (!email) {
//         return "Please provide email to fetch order history.";
//       }

//       // 2) Fetch orders using billing email (guest checkout supported)
//       const res = await client.get("/orders", {
//         params: {
//           billing_email: email,
//           status: "completed",
//         },
//       });

//       if (!res.data || res.data.length === 0) {
//         return `No orders found for email: ${email}`;
//       }

//       return {
//         message: `Found ${res.data.length} order(s) for ${email}.`,
//         orders: res.data.map((order) => ({
//           id: order.id,
//           status: order.status,
//           total: order.total,
//           items: order.line_items.map((li) => ({
//             name: li.name,
//             qty: li.quantity,
//             total: li.total,
//           })),
//         })),
//       };
//     } catch (err) {
//       console.error("ordersTool error:", err.response?.data || err.message);
//       return `Failed to load orders: ${err.message}`;
//     }
//   },
//   {
//     name: "get_orders",
//     description: "Fetch WooCommerce orders by billing email or order ID.",
//     schema: OrdersSchema,
//   }
// );

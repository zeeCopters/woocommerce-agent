import { tool } from "langchain";
import * as z from "zod";
import { setShippingDetails } from "../utils/sessionStore.js";

export const ShippingSchema = z.object({
  first_name: z.string(),
  last_name: z.string(),
  address_1: z.string(),
  city: z.string(),
  country: z.string(),
});

export const shippingDetailsTool = tool(
  async (data) => {
    const { sessionId, ...fields } = data;

    if (!sessionId) return "No active session.";

    const validated = ShippingSchema.parse(fields);

    setShippingDetails(sessionId, validated);

    return "Shipping details saved.";
  },
  {
    name: "set_shipping_details",
    description: "Stores shipping details.",
    schema: ShippingSchema.extend({
      sessionId: z.string(),
    }),
  }
);

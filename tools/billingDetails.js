import { tool } from "langchain";
import * as z from "zod";
import { setBillingDetails } from "../utils/sessionStore.js";

export const BillingSchema = z.object({
  first_name: z.string(),
  last_name: z.string(),
  email: z.string(),
  phone: z.string(),
  address_1: z.string(),
  city: z.string(),
  country: z.string(),
});

export const billingDetailsTool = tool(
  async (data) => {
    const { sessionId, ...fields } = data;

    if (!sessionId) return "No active session.";

    const validated = BillingSchema.parse(fields);
    setBillingDetails(sessionId, validated);

    return "Billing details saved.";
  },
  {
    name: "set_billing_details",
    description: "Stores billing details.",
    schema: BillingSchema.extend({
      sessionId: z.string(),
    }),
  }
);

import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import dotenv from "dotenv";
import { createAgent } from "langchain";
import { ChatGroq } from "@langchain/groq";

// Tools
import { getProductsTool } from "./tools/getProducts.js";
import { addToCartTool } from "./tools/addToCart.js";
import { viewCartTool } from "./tools/viewCart.js";
import { clearCartTool } from "./tools/clearCart.js";
import { deleteCartItemTool } from "./tools/deleteCartItem.js";
import { checkoutTool } from "./tools/checkout.js";
import { shippingDetailsTool } from "./tools/shippingDetails.js";
import { billingDetailsTool } from "./tools/billingDetails.js";
import { ordersTool } from "./tools/orders.js";

import { ensureAgentSessionCookie } from "./services/cartService.js";

import {
  getAgentSessionId,
  getBillingDetails,
  getShippingDetails,
  getCartForSession,
} from "./utils/sessionStore.js";

import { store } from "./utils/sessionStore.js";
import { client } from "./services/wcClient.js";

dotenv.config();

// -----------------------------------------------------
// LLM INIT
// -----------------------------------------------------
const llm = new ChatGroq({
  model: "openai/gpt-oss-120b",
  apiKey: process.env.GROQ_API_KEY,
  temperature: 0,
  maxRetries: 2,
});

const tools = [
  getProductsTool,
  addToCartTool,
  viewCartTool,
  clearCartTool,
  deleteCartItemTool,
  checkoutTool,
  shippingDetailsTool,
  billingDetailsTool,
  ordersTool,
];

// -----------------------------------------------------
// SESSION INIT
// -----------------------------------------------------
let sessionId = getAgentSessionId();
if (!sessionId) {
  sessionId = await ensureAgentSessionCookie();
}

// -----------------------------------------------------
// MAIN
// -----------------------------------------------------
async function main() {
  const rl = readline.createInterface({ input, output });
  console.log("WooCommerce CLI (type /bye to exit)\n");

  let checkoutStep = null;
  let ordersStep = null;

  while (true) {
    const query = await rl.question("You: ");
    if (!query) continue;
    if (query.trim() === "/bye") break;

    try {
      const userMsg = query.toLowerCase();

      // -----------------------------------------------------
      // STOP checkout when cart empty
      // -----------------------------------------------------
      const cartId = getCartForSession(sessionId);
      const cartIsEmpty = !cartId;

      // User checkout intent
      const isCheckoutIntent = [
        "checkout",
        "place my order",
        "complete my order",
        "proceed to checkout",
        "i want to checkout",
      ].some((cmd) => userMsg.includes(cmd));

      // User intent to buy something (should NOT trigger checkout)
      const isBuyIntent = userMsg.startsWith("i want to buy");

      // If user says "I want to buy the cap" → DO NOT CHECKOUT
      if (isBuyIntent) {
        // Let the LLM decide product lookup + add_to_cart
        const response = await createAgent({ model: llm, tools }).invoke({
          messages: [{ role: "user", content: query }],
        });
        const lastMsg = response.messages.at(-1)?.content || "";
        console.log("\nLLM:\n" + lastMsg + "\n");
        continue;
      }

      // -----------------------------------------------------
      // Checkout flow (manual controlled)
      // -----------------------------------------------------
      if (isCheckoutIntent) {
        if (cartIsEmpty) {
          console.log("\nLLM:\nYour cart is empty. Please add items first.\n");
          continue;
        }

        const billing = getBillingDetails(sessionId);
        const shipping = getShippingDetails(sessionId);

        if (!billing) {
          console.log(
            "\nLLM:\nPlease provide your billing details:\nfirst_name, last_name, email, phone, address, city, country.\n"
          );
          checkoutStep = "waiting_billing";
          continue;
        }

        if (!shipping) {
          console.log(
            "\nLLM:\nNow please provide your shipping details:\nfirst_name, last_name, address, city, country.\n"
          );
          checkoutStep = "waiting_shipping";
          continue;
        }

        // Billing + shipping + cart → finalize order
        const checkoutResponse = await checkoutTool.invoke({
          sessionId,
          sessionStore: store,
          client,
        });

        await clearCartTool.invoke({ sessionId });

        console.log("\nLLM:\n" + checkoutResponse + "\n");

        checkoutStep = null;
        continue;
      }

      // -----------------------------------------------------
      // BILLING STEP
      // -----------------------------------------------------
      if (checkoutStep === "waiting_billing") {
        await billingDetailsTool.invoke({
          sessionId,
          ...parseBilling(query),
        });

        console.log(
          "\nLLM:\nBilling saved. Now provide shipping details:\nfirst_name, last_name, address, city, country.\n"
        );
        checkoutStep = "waiting_shipping";
        continue;
      }

      // -----------------------------------------------------
      // SHIPPING STEP
      // -----------------------------------------------------
      if (checkoutStep === "waiting_shipping") {
        await shippingDetailsTool.invoke({
          sessionId,
          ...parseShipping(query),
        });

        console.log("\nLLM:\nShipping saved. You may now type 'checkout'.\n");
        checkoutStep = null;
        continue;
      }

      // ---------------------------------------------
      // VIEW MY ORDERS FLOW
      // ---------------------------------------------
      if (
        ["view my orders", "my orders", "show my orders", "orders"].some(
          (cmd) => userMsg.includes(cmd)
        )
      ) {
        const billing = getBillingDetails(sessionId);

        if (billing?.email) {
          // Already have email → directly fetch orders
          const orders = await ordersTool.invoke({
            email: billing.email,
          });

          //console.log("\nLLM:\nYour orders:\n", orders, "\n");
          console.log("\nLLM:\n" + prettyOrders(orders) + "\n");

          continue;
        }

        // No billing → ask user for email
        console.log(
          "\nLLM:\nPlease provide the email you used for your order.\n"
        );
        ordersStep = "waiting_email_for_orders";
        continue;
      }

      // When waiting for email
      if (ordersStep === "waiting_email_for_orders") {
        const email = userMsg.trim();

        // Basic validation
        if (!email.includes("@") || !email.includes(".")) {
          console.log("\nLLM:\nPlease enter a valid email address.\n");
          continue;
        }

        // Fetch orders using provided email
        const orders = await ordersTool.invoke({
          email,
        });

        //console.log("\nLLM:\nYour orders:\n", orders, "\n");
        console.log("\nLLM:\n" + prettyOrders(orders) + "\n");

        ordersStep = null;
        continue;
      }

      // -----------------------------------------------------
      // DEFAULT → LLM handles normal user queries + tools
      // -----------------------------------------------------
      const response = await createAgent({ model: llm, tools }).invoke({
        messages: [{ role: "user", content: query }],
      });

      const lastMsg =
        response.messages?.length > 0
          ? response.messages[response.messages.length - 1].content
          : "[no response]";

      console.log("\nLLM:\n" + lastMsg + "\n");
    } catch (err) {
      console.error("Agent error:", err);
    }
  }

  rl.close();
}

// -----------------------------------------------------
// PARSERS
// -----------------------------------------------------
function parseBilling(input) {
  const [first_name, last_name, email, phone, address_1, city, country] = input
    .split(",")
    .map((s) => s.trim());
  return { first_name, last_name, email, phone, address_1, city, country };
}

function parseShipping(input) {
  const [first_name, last_name, address_1, city, country] = input
    .split(",")
    .map((s) => s.trim());
  return { first_name, last_name, address_1, city, country };
}

function prettyOrders(orders) {
  if (!orders || !Array.isArray(orders.orders) || orders.orders.length === 0) {
    return "No orders found.";
  }

  return orders.orders
    .map((o) => {
      const items =
        o.items && o.items.length > 0
          ? o.items
              .map((i) => `  - ${i.name} (x${i.qty}) — $${i.total}`)
              .join("\n")
          : "  (No items)";

      return `Order #${o.id} — ${o.status}, Total: $${o.total}\nItems:\n${items}`;
    })
    .join("\n\n");
}

main();

// import readline from "node:readline/promises";
// import { stdin as input, stdout as output } from "node:process";
// import dotenv from "dotenv";
// import { createAgent } from "langchain";
// import { ChatGroq } from "@langchain/groq";

// import { getProductsTool } from "./tools/getProducts.js";
// import { addToCartTool } from "./tools/addToCart.js";
// import { viewCartTool } from "./tools/viewCart.js";
// import { clearCartTool } from "./tools/clearCart.js";
// import { deleteCartItemTool } from "./tools/deleteCartItem.js";
// import { checkoutTool } from "./tools/checkout.js";
// import { shippingDetailsTool } from "./tools/shippingDetails.js";
// import { billingDetailsTool } from "./tools/billingDetails.js";
// import { getMyOrdersTool } from "./tools/getMyOrders.js";
// import { ordersTool } from "./tools/orders.js";

// import { ensureAgentSessionCookie } from "./services/cartService.js";

// import {
//   getAgentSessionId,
//   getBillingDetails,
//   getShippingDetails,
// } from "./utils/sessionStore.js";
// import { store } from "./utils/sessionStore.js";
// import { client } from "./services/wcClient.js";

// dotenv.config();

// const llm = new ChatGroq({
//   model: "openai/gpt-oss-120b",
//   apiKey: process.env.GROQ_API_KEY,
//   temperature: 0,
//   maxRetries: 2,
// });

// // Tools list
// const tools = [
//   getProductsTool,
//   addToCartTool,
//   viewCartTool,
//   clearCartTool,
//   deleteCartItemTool,
//   checkoutTool,
//   shippingDetailsTool,
//   billingDetailsTool,
//   getMyOrdersTool,
//   ordersTool,
// ];

// // Initialize session ID if not already
// let sessionId = getAgentSessionId();
// if (!sessionId) {
//   sessionId = await ensureAgentSessionCookie();
// }

// async function main() {
//   const rl = readline.createInterface({ input, output });
//   console.log("WooCommerce CLI (type /bye to exit)\n");

//   // Track checkout state explicitly
//   let checkoutStep = null;

//   while (true) {
//     const query = await rl.question("You: ");
//     if (!query) continue;
//     if (query.trim() === "/bye") break;

//     try {
//       // Handle checkout workflow explicitly
//       const userMsg = query.toLowerCase();

//       // Step 0: user triggers checkout
//       if (
//         [
//           "checkout",
//           "place my order",
//           "proceed to checkout",
//           "complete my order",
//           "i want to buy",
//         ].some((cmd) => userMsg.includes(cmd))
//       ) {
//         const billing = getBillingDetails(sessionId);
//         console.log("Billing details: ", billing);
//         const shipping = getShippingDetails(sessionId);
//         console.log("Shipping details: ", shipping);

//         if (!billing) {
//           console.log(
//             "\nLLM:\nPlease provide your billing details:\nfirst_name, last_name, email, phone, address, city, country.\n"
//           );
//           checkoutStep = "waiting_billing";
//           continue;
//         }

//         if (!shipping) {
//           console.log(
//             "\nLLM:\nThanks! Now please provide your shipping details:\nfirst_name, last_name, address, city, country.\n"
//           );
//           checkoutStep = "waiting_shipping";
//           continue;
//         }

//         // Both exist → call checkout
//         const checkoutResponse = await checkoutTool.invoke({
//           sessionId,
//           sessionStore: store,
//           client, // your WooCommerce client
//         });
//         console.log("\nLLM:\n" + checkoutResponse + "\n");
//         checkoutStep = null;
//         continue;
//       }

//       // Step 1: waiting for billing details
//       if (checkoutStep === "waiting_billing") {
//         await billingDetailsTool.invoke({
//           sessionId, // send it to tool
//           ...parseUserInputBilling(query),
//         });
//         console.log(
//           "\nLLM:\nBilling details saved. Now please provide shipping details:\nfirst_name, last_name, address, city, country.\n"
//         );
//         checkoutStep = "waiting_shipping";
//         continue;
//       }

//       // Step 2: waiting for shipping details
//       if (checkoutStep === "waiting_shipping") {
//         console.log("Session ID before Tool Call", sessionId);
//         await shippingDetailsTool.invoke({
//           sessionId, // send it to tool
//           ...parseUserInputShipping(query),
//         });
//         console.log(
//           "\nLLM:\nShipping details saved. You may now proceed to checkout.\n"
//         );
//         checkoutStep = null;
//         continue;
//       }

//       // All other commands go to LLM agent
//       const response = await createAgent({ model: llm, tools }).invoke({
//         messages: [{ role: "user", content: query }],
//       });

//       const lastMsg =
//         response.messages && response.messages.length
//           ? response.messages[response.messages.length - 1].content
//           : "[no response]";

//       console.log("\nLLM:\n" + lastMsg + "\n");
//     } catch (err) {
//       console.error("Agent error:", err);
//     }
//   }

//   rl.close();
// }

// // Helper to parse user billing input into object
// function parseUserInputBilling(input) {
//   const [first_name, last_name, email, phone, address_1, city, country] = input
//     .split(",")
//     .map((s) => s.trim());
//   return { first_name, last_name, email, phone, address_1, city, country };
// }

// // Helper to parse user shipping input into object
// function parseUserInputShipping(input) {
//   const [first_name, last_name, address_1, city, country] = input
//     .split(",")
//     .map((s) => s.trim());
//   return { first_name, last_name, address_1, city, country };
// }

// main();

// Billing Details
// Zeeshan, Ahmed, zeeshan@gmail.com, +923422884417, ABC Address, Karachi, Pakistan.

// Shipping Details
// Zeeshan, Ahmed, ABC Address, Karachi, Pakistan.

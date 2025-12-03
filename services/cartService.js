import { client, jar } from "./wcClient.js";
import {
  setAgentSessionId,
  getCartForSession,
  setCartForSession,
} from "../utils/sessionStore.js";

async function ensureAgentSessionCookie() {
  const cookies = await jar.getCookies(client.defaults.baseURL);
  let sessionCookie = cookies.find((c) => c.key === "agent_session");

  if (!sessionCookie) {
    const sid = `s_${Math.random().toString(36).slice(2, 12)}`;

    await jar.setCookie(
      `agent_session=${sid}; Path=/; HttpOnly; Max-Age=604800`,
      client.defaults.baseURL
    );

    setAgentSessionId(sid);
    return sid;
  }

  setAgentSessionId(sessionCookie.value);
  return sessionCookie.value;
}

async function createCartOrder(sessionId) {
  const res = await client.post("/orders", {
    status: "pending",
    billing: {},
    shipping: {},
    line_items: [],
  });

  const order = res.data;
  setCartForSession(sessionId, order.id);
  return order;
}

async function addOrUpdateCartItem(sessionId, productId, quantity) {
  // 1️⃣ Get existing order ID for this session
  let orderId = getCartForSession(sessionId);

  // 2️⃣ If no order exists, create a new one
  if (!orderId) {
    const created = await createCartOrder(sessionId);
    orderId = created.id;
  }

  // 3️⃣ Fetch current order from WooCommerce
  const currentRes = await client.get(`/orders/${orderId}`);
  const currentOrder = currentRes.data;

  // 4️⃣ Find if the product already exists in the cart
  const existing = currentOrder.line_items.find(
    (li) => li.product_id === productId
  );

  let newLineItems;

  if (existing) {
    // 5️⃣ Update quantity if product already exists
    newLineItems = currentOrder.line_items.map((li) =>
      li.product_id === productId
        ? { id: li.id, product_id: productId, quantity }
        : { id: li.id, product_id: li.product_id, quantity: li.quantity }
    );
  } else {
    // 6️⃣ Add new product to the cart
    newLineItems = [
      ...currentOrder.line_items.map((li) => ({
        id: li.id,
        product_id: li.product_id,
        quantity: li.quantity,
      })),
      { product_id: productId, quantity },
    ];
  }

  // 7️⃣ Update WooCommerce order with new line_items
  const updateRes = await client.put(`/orders/${orderId}`, {
    line_items: newLineItems,
  });

  const updatedOrder = updateRes.data;

  // 8️⃣ Store cart ID in session (important)
  setCartForSession(sessionId, updatedOrder.id);

  // 9️⃣ Store cart items in session for checkout
  store.set(
    `cart_items_${sessionId}`,
    updatedOrder.line_items.map((li) => ({
      id: li.id,
      product_id: li.product_id,
      quantity: li.quantity,
    }))
  );

  return updatedOrder;
}

// async function addOrUpdateCartItem(sessionId, productId, quantity) {
//   let orderId = getCartForSession(sessionId);

//   if (!orderId) {
//     const created = await createCartOrder(sessionId);
//     orderId = created.id;
//   }

//   const current = await client.get(`/orders/${orderId}`);
//   const currentOrder = current.data;

//   const existing = currentOrder.line_items.find(
//     (li) => li.product_id === productId
//   );

//   let newLineItems;

//   if (existing) {
//     newLineItems = currentOrder.line_items.map((li) =>
//       li.product_id === productId
//         ? { id: li.id, product_id: productId, quantity }
//         : { id: li.id, product_id: li.product_id, quantity: li.quantity }
//     );
//   } else {
//     newLineItems = [
//       ...currentOrder.line_items.map((li) => ({
//         id: li.id,
//         product_id: li.product_id,
//         quantity: li.quantity,
//       })),
//       { product_id: productId, quantity },
//     ];
//   }

//   const updateRes = await client.put(`/orders/${orderId}`, {
//     line_items: newLineItems,
//   });

//   return updateRes.data;
// }

async function findProductIdByName(name) {
  const res = await client.get("/products", {
    params: { search: name, per_page: 20 },
  });

  const items = res.data;
  if (!items.length) return null;

  const exact = items.find((p) => p.name.toLowerCase() === name.toLowerCase());

  return (exact || items[0]).id;
}

async function removeCartItem(sessionId, itemId) {
  const orderId = getCartForSession(sessionId);
  if (!orderId) throw new Error("Cart is empty.");

  const res = await client.put(`/orders/${orderId}`, {
    line_items: [
      { id: itemId, quantity: 0 }, // WooCommerce delete rule
    ],
  });

  return res.data;
}

export {
  ensureAgentSessionCookie,
  createCartOrder,
  addOrUpdateCartItem,
  findProductIdByName,
  removeCartItem,
};

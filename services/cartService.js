import { client, jar } from "./wcClient.js";
import {
  store,
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
  // try to get existing order id associated with this session
  let orderId = getCartForSession(sessionId);

  // create a pending order if none exists
  if (!orderId) {
    const createRes = await client.post("/orders", {
      status: "pending",
      billing: {},
      shipping: {},
      line_items: [],
    });
    const createdOrder = createRes.data;
    orderId = createdOrder.id;
    setCartForSession(sessionId, orderId);
  }

  // fetch current order to check existing line_items
  const currentRes = await client.get(`/orders/${orderId}`);
  const currentOrder = currentRes.data;

  // find existing line item in order by product_id
  const existing = (currentOrder.line_items || []).find(
    (li) => li.product_id === productId
  );

  let line_items_payload;

  if (existing) {
    // update quantity for that existing line item (use id)
    line_items_payload = (currentOrder.line_items || []).map((li) =>
      li.product_id === productId
        ? { id: li.id, quantity }
        : { id: li.id, quantity: li.quantity }
    );
  } else {
    // append a new item: for new items just send product_id + quantity
    line_items_payload = [
      ...(currentOrder.line_items || []).map((li) => ({
        id: li.id,
        quantity: li.quantity,
      })),
      { product_id: productId, quantity },
    ];
  }

  // send minimal update payload accepted by WooCommerce
  const updateRes = await client.put(`/orders/${orderId}`, {
    line_items: line_items_payload,
  });

  // ensure cart id stored (defensive)
  setCartForSession(sessionId, updateRes.data.id);

  return updateRes.data;
}

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

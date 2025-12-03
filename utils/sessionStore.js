export const store = new Map();

/* ---------------- Session ID ---------------- */
export function getAgentSessionId() {
  return store.get("agent_session_id") || null;
}

export function setAgentSessionId(sessionId) {
  store.set("agent_session_id", sessionId);
}

/* ---------------- Cart Storage ---------------- */
// stores WooCommerce orderId (cart)
export function getCartForSession(sessionId) {
  return store.get(`cart_${sessionId}`) || null;
}

export function setCartForSession(sessionId, orderId) {
  store.set(`cart_${sessionId}`, orderId);
}

/* ---------------- Billing ---------------- */
export function setBillingDetails(sessionId, details) {
  store.set(`billing_${sessionId}`, details);
}

export function getBillingDetails(sessionId) {
  return store.get(`billing_${sessionId}`);
}

/* ---------------- Shipping ---------------- */
export function setShippingDetails(sessionId, details) {
  store.set(`shipping_${sessionId}`, details);
}

export function getShippingDetails(sessionId) {
  return store.get(`shipping_${sessionId}`);
}

export function setCustomerId(sessionId, customerId) {
  store.set(`customer_${sessionId}`, customerId);
}

export function getCustomerId(sessionId) {
  return store.get(`customer_${sessionId}`);
}

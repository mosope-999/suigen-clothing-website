// Verifies a Paystack payment on the server. Needs the environment variable PAYSTACK_SECRET_KEY.
const catalog = require("./catalog.json");

const reply = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  body: JSON.stringify(body)
});

// Works out what the order should cost from the items and state stored in the payment's metadata.
function expectedKobo(meta) {
  if (!meta || !Array.isArray(meta.items) || !meta.items.length) return null;
  let total = 0;
  for (const it of meta.items) {
    const price = catalog.prices[String(it.id)];
    const qty = Number(it.qty);
    if (!Number.isFinite(price) || !Number.isInteger(qty) || qty < 1 || qty > 20) return null;
    total += price * qty;
  }
  const fee = catalog.deliveryRates[meta.state];
  if (!Number.isFinite(fee)) return null;
  return (total + fee) * 100;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") return reply(405, { verified: false, status: "method-not-allowed" });
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return reply(503, { verified: false, status: "unconfigured" });
  const reference = (event.queryStringParameters || {}).reference || "";
  if (!/^[A-Za-z0-9._=-]{6,64}$/.test(reference)) return reply(400, { verified: false, status: "bad-reference" });
  let body;
  try {
    const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secret}` }
    });
    body = await res.json();
    if (!res.ok || !body.status || !body.data) return reply(502, { verified: false, status: "lookup-failed" });
  } catch (e) {
    return reply(502, { verified: false, status: "lookup-failed" });
  }
  const d = body.data;
  const expected = expectedKobo(d.metadata);
  const verified = d.status === "success" && d.currency === "NGN" && d.reference === reference &&
    expected !== null && d.amount === expected;
  return reply(200, { verified, status: d.status, reference: d.reference, amountMatches: expected !== null && d.amount === expected });
};
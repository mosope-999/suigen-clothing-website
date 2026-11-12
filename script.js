// ================= Settings: change these =================
const CONFIG = {
  whatsapp: "2348132023763",            // country code first, no + or spaces
  currency: "₦",
  paystackKey: "pk_test_xxxxxxxxxxxxxxxx", // Paystack PUBLIC key (pk_test_ or pk_live_). Never put the secret key here.
  verifyUrl: "/.netlify/functions/verify-payment",
  // Delivery fee in naira per state, for example { "Lagos": 3000 }.
  // These fees are placeholder estimates in three tiers (3,500 / 5,000 / 6,500). Replace them with your courier's real prices.
  // A state with no fee here gets a WhatsApp quote and cannot pay online.
  // If you change a price or fee, change it in netlify/functions/catalog.json too.
  deliveryRates: {
    "Federal Capital Territory": 3500, "Kaduna": 3500, "Niger": 3500, "Nasarawa": 3500, "Kogi": 3500, "Plateau": 3500, "Kwara": 3500,
    "Lagos": 5000, "Ogun": 5000, "Oyo": 5000, "Osun": 5000, "Ondo": 5000, "Ekiti": 5000, "Edo": 5000, "Delta": 5000, "Anambra": 5000, "Enugu": 5000, "Ebonyi": 5000, "Imo": 5000, "Abia": 5000, "Benue": 5000, "Kano": 5000, "Katsina": 5000, "Jigawa": 5000, "Bauchi": 5000, "Gombe": 5000, "Zamfara": 5000, "Sokoto": 5000, "Kebbi": 5000,
    "Rivers": 6500, "Bayelsa": 6500, "Akwa Ibom": 6500, "Cross River": 6500, "Adamawa": 6500, "Taraba": 6500, "Yobe": 6500, "Borno": 6500
  }
};
const MAX_QTY = 20;
const STATES = ["Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno","Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","Federal Capital Territory","Gombe","Imo","Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara","Lagos","Nasarawa","Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers","Sokoto","Taraba","Yobe","Zamfara"];

// ================= Products: replace with your real items =================
const PRODUCTS = [
  { id: 1, image: "images/oversized-tee.jpg", name: "Oversized heavy tee", cat: "streetwear", price: 18000, sizes: ["S","M","L","XL"] },
  { id: 2, image: "images/zip-hoodie.jpg", name: "Boxy zip hoodie", cat: "streetwear", price: 35000, sizes: ["S","M","L","XL"] },
  { id: 3, image: "images/cargo-trousers.jpg", name: "Cargo trousers", cat: "streetwear", price: 32000, sizes: ["S","M","L","XL"] },
  { id: 4, image: "images/agbada-set.jpg", name: "Agbada set", cat: "traditional", price: 95000, sizes: ["M","L","XL","XXL"] },
  { id: 5, image: "images/senator-kaftan.jpg", name: "Senator kaftan", cat: "traditional", price: 45000, sizes: ["M","L","XL","XXL"] },
  { id: 6, image: "images/wrap-dress.jpg", name: "Tailored wrap dress", cat: "traditional", price: 52000, sizes: ["S","M","L","XL"] },
  { id: 7, image: "images/branded-polo.jpg", name: "Branded polo (per piece)", cat: "uniforms", price: 12000, sizes: ["S","M","L","XL","XXL"] },
  { id: 8, image: "images/team-jersey.jpg", name: "Team jersey (per piece)", cat: "uniforms", price: 14000, sizes: ["S","M","L","XL","XXL"],
    options: [
      { label: "Club or country", required: true, groups: {
        "Clubs": ["Arsenal","Chelsea","Liverpool","Manchester City","Manchester United","Tottenham","Real Madrid","Barcelona","Atletico Madrid","Bayern Munich","PSG","Juventus","AC Milan","Inter Milan"],
        "Countries": ["Nigeria","Ghana","Senegal","Cameroon","Brazil","Argentina","France","England","Germany","Spain","Portugal","Netherlands"] } },
      { label: "Kit", required: true, choices: ["Home","Away"] },
      { label: "Name on back (optional)", text: true, prefix: "Name: " },
      { label: "Number (optional)", text: true, prefix: "No. " }
    ] }
];

// ================= Helpers =================
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (n) => CONFIG.currency + Number(n).toLocaleString("en-NG");
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};

function setErr(id, msg) {
  const el = $("#" + id);
  if (!el) return;
  let s = el.parentElement.querySelector(`[data-err="${id}"]`);
  if (!msg) { s && s.remove(); el.removeAttribute("aria-invalid"); el.removeAttribute("aria-describedby"); return; }
  if (!s) { s = document.createElement("small"); s.className = "field-error"; s.dataset.err = id; s.id = id + "-err"; el.after(s); }
  s.textContent = msg;
  el.setAttribute("aria-invalid", "true");
  el.setAttribute("aria-describedby", s.id);
}
function showErrs(errs, ids) {
  ids.forEach((id) => setErr(id, errs[id] || ""));
  const first = ids.find((id) => errs[id]);
  if (first) $("#" + first).focus();
  return !first;
}
const PHONE_RE = /^(\+?234|0)\d{10}$/;
const EMAIL_RE = /^\S+@\S+\.\S+$/;

// ================= Cart =================
function loadCart() {
  return store.get("suigen-cart", []).map((c) => {
    const p = PRODUCTS.find((x) => x.id == c.id);
    const qty = Math.floor(Number(c.qty));
    if (!p || !p.sizes.includes(c.size) || !(qty > 0)) return null;
    return { id: p.id, name: p.name, price: p.price, size: c.size, variant: String(c.variant || "").slice(0, 120), qty: Math.min(qty, MAX_QTY) };
  }).filter(Boolean);
}
let cart = Array.isArray(store.get("suigen-cart", [])) ? loadCart() : [];
const lineKey = (c) => [c.id, c.size, c.variant || ""].join("|");
const subtotal = () => cart.reduce((n, c) => n + c.price * c.qty, 0);
function addLine(item) {
  const line = cart.find((c) => lineKey(c) === lineKey(item));
  if (line) line.qty = Math.min(line.qty + 1, MAX_QTY); else cart.push({ ...item, qty: 1 });
}
function setQty(i, q) {
  q = Math.floor(Number(q));
  if (!cart[i] || !Number.isFinite(q)) return;
  if (q <= 0) cart.splice(i, 1); else cart[i].qty = Math.min(q, MAX_QTY);
}
function deliveryFor(state) {
  if (!state) return { status: "none" };
  const r = CONFIG.deliveryRates[state];
  return Number.isFinite(r) ? { status: "fee", amount: r } : { status: "quote" };
}
function totals() {
  const sub = subtotal(), d = deliveryFor($("#c-state").value);
  return { sub, d, total: d.status === "fee" ? sub + d.amount : null };
}
function orderRef() {
  const d = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  return `SUI-${d}-${Date.now().toString(36).slice(-4).toUpperCase()}${Math.random().toString(36).slice(2, 4).toUpperCase()}`;
}
function saveCart() { store.set("suigen-cart", cart); renderCart(); }

function renderCart() {
  const t = totals(), state = $("#c-state").value;
  $("#cart-count").textContent = cart.reduce((n, c) => n + c.qty, 0);
  $("#cart-empty").hidden = cart.length > 0;
  $("#cart-items").innerHTML = cart.map((c, i) => `
    <li>
      <div>${esc(c.name)}<small>Size ${esc(c.size)}${c.variant ? " · " + esc(c.variant) : ""}</small>
        <div class="qty"><button type="button" data-dec="${i}" aria-label="Decrease quantity">−</button><span aria-live="polite">${c.qty}</span><button type="button" data-inc="${i}" aria-label="Increase quantity">+</button></div>
        <button type="button" data-remove="${i}">Remove</button></div>
      <span>${money(c.price * c.qty)}</span>
    </li>`).join("");
  $("#sum-sub").textContent = money(t.sub);
  $("#sum-del").textContent = t.d.status === "fee" ? (t.d.amount ? money(t.d.amount) : "Free") : t.d.status === "quote" ? "Quote required" : "Choose a state";
  $("#cart-total").textContent = t.d.status === "fee" ? money(t.total) : money(t.sub) + " + delivery";
  $("#delivery-note").textContent = t.d.status === "fee" ? `Delivery to ${state}: ${t.d.amount ? money(t.d.amount) : "free"}.`
    : t.d.status === "quote" ? `We have no online delivery rate for ${state} yet. Order on WhatsApp and we will confirm the delivery fee before you pay.`
    : "Choose your state to see the delivery fee.";
  const canPay = cart.length > 0 && t.d.status === "fee";
  $("#pay-card").disabled = !canPay;
  $("#pay-transfer").disabled = !canPay;
  $("#checkout").disabled = cart.length === 0;
}

$("#cart-items").addEventListener("click", (e) => {
  const d = e.target.dataset;
  if (d.inc !== undefined) setQty(+d.inc, cart[+d.inc].qty + 1);
  else if (d.dec !== undefined) setQty(+d.dec, cart[+d.dec].qty - 1);
  else if (d.remove !== undefined) setQty(+d.remove, 0);
  else return;
  saveCart();
});

let lastFocus = null;
function setInert(on) { document.querySelectorAll("header,main,footer").forEach((el) => { el.inert = on; }); }
function openCart() {
  lastFocus = document.activeElement;
  $("#drawer").classList.add("open"); $("#drawer").setAttribute("aria-hidden", "false"); $("#scrim").hidden = false;
  setInert(true); $("#close-cart").focus();
}
function closeCart() {
  $("#drawer").classList.remove("open"); $("#drawer").setAttribute("aria-hidden", "true"); $("#scrim").hidden = true;
  setInert(false); lastFocus && lastFocus.focus && lastFocus.focus();
}
$("#open-cart").addEventListener("click", openCart);
$("#close-cart").addEventListener("click", closeCart);
$("#scrim").addEventListener("click", closeCart);
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  closeCart();
  $("#main-nav").classList.remove("open"); $("#menu-btn").setAttribute("aria-expanded", "false");
});
$("#c-state").innerHTML = '<option value="">State</option>' + STATES.map((s) => `<option>${esc(s)}</option>`).join("");
$("#c-state").addEventListener("change", renderCart);

// ================= Shop: filter, search, sort =================
const view = { filter: "all", q: "", sort: "default" };

function optionHtml(o) {
  if (o.text) return `<input data-opt data-prefix="${esc(o.prefix)}" maxlength="14" placeholder="${esc(o.label)}" aria-label="${esc(o.label)}">`;
  const opts = o.groups
    ? Object.entries(o.groups).map(([g, l]) => `<optgroup label="${esc(g)}">${l.map((x) => `<option>${esc(x)}</option>`).join("")}</optgroup>`).join("")
    : o.choices.map((x) => `<option>${esc(x)}</option>`).join("");
  return `<select data-opt data-required="${!!o.required}" aria-label="${esc(o.label)}"><option value="">${esc(o.label)}</option>${opts}</select>`;
}

function renderProducts() {
  let list = PRODUCTS.filter((p) => (view.filter === "all" || p.cat === view.filter) && (!view.q || (p.name + " " + p.cat).toLowerCase().includes(view.q)));
  if (view.sort === "price-asc") list.sort((a, b) => a.price - b.price);
  if (view.sort === "price-desc") list.sort((a, b) => b.price - a.price);
  if (view.sort === "name") list.sort((a, b) => a.name.localeCompare(b.name));
  $("#no-results").hidden = list.length > 0;
  $("#product-grid").innerHTML = list.map((p) => `
    <article class="card">
      <div class="img"><img src="${p.image}" alt="${esc(p.name)}" width="400" height="500" loading="lazy" onerror="this.remove()"><span>${esc(p.name)}</span></div>
      <h3>${esc(p.name)}</h3>
      <div class="meta"><span>${money(p.price)}</span></div>
      <select data-size aria-label="Size for ${esc(p.name)}">${p.sizes.map((s) => `<option>${s}</option>`).join("")}</select>
      ${p.options ? p.options.map(optionHtml).join("") + '<p class="error card-error" hidden>Choose your club or country and kit.</p>' : ""}
      <a class="size-link" href="#size-guide">Size guide</a>
      <button class="btn" type="button" data-add="${p.id}">Add to cart</button>
    </article>`).join("");
  reveal();
}

function setFilter(f) {
  view.filter = f;
  document.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c.dataset.filter === f));
  renderProducts();
}
document.querySelectorAll("[data-filter]").forEach((el) => el.addEventListener("click", () => setFilter(el.dataset.filter)));
$("#q").addEventListener("input", (e) => { view.q = e.target.value.trim().toLowerCase(); renderProducts(); });
$("#sort").addEventListener("change", (e) => { view.sort = e.target.value; renderProducts(); });

$("#product-grid").addEventListener("click", (e) => {
  const id = e.target.dataset.add;
  if (!id) return;
  const p = PRODUCTS.find((x) => x.id == id);
  const card = e.target.closest(".card");
  const opts = [...card.querySelectorAll("[data-opt]")];
  if (opts.some((el) => el.dataset.required === "true" && !el.value)) { card.querySelector(".card-error").hidden = false; return; }
  if (opts.length) card.querySelector(".card-error").hidden = true;
  const variant = opts.filter((el) => el.value.trim()).map((el) => (el.dataset.prefix || "") + el.value.trim()).join(", ");
  addLine({ id: p.id, name: p.name, price: p.price, size: card.querySelector("[data-size]").value, variant });
  saveCart();
  openCart();
});

// ================= Checkout =================
const CUST_IDS = ["c-name", "c-email", "c-phone", "c-state", "c-city", "c-address"];
const readCustomer = () => ({
  name: $("#c-name").value.trim(), email: $("#c-email").value.trim(), phone: $("#c-phone").value.replace(/[\s()-]/g, ""),
  state: $("#c-state").value, city: $("#c-city").value.trim(), address: $("#c-address").value.trim(), notes: $("#c-notes").value.trim()
});
function validateCustomer(v, needEmail) {
  const e = {};
  if (v.name.length < 2) e["c-name"] = "Enter your full name.";
  if (needEmail ? !EMAIL_RE.test(v.email) : v.email && !EMAIL_RE.test(v.email)) e["c-email"] = "Enter a valid email address.";
  if (!PHONE_RE.test(v.phone)) e["c-phone"] = "Enter a valid Nigerian phone number, for example 0813 202 3763.";
  if (!v.state) e["c-state"] = "Choose your state.";
  if (v.city.length < 2) e["c-city"] = "Enter your city or town.";
  if (v.address.length < 8) e["c-address"] = "Enter your full delivery address.";
  return e;
}
function buildOrder() {
  const t = totals();
  return { ref: orderRef(), items: cart.map((c) => ({ ...c })), sub: t.sub, delivery: t.d, total: t.total, customer: readCustomer() };
}
function orderText(o, header) {
  const c = o.customer, d = o.delivery;
  return [header, `Order reference: ${o.ref}`, "Items:",
    ...o.items.map((i) => `- ${i.name}, size ${i.size}${i.variant ? ", " + i.variant : ""}, qty ${i.qty} (${money(i.price * i.qty)})`),
    `Subtotal: ${money(o.sub)}`,
    `Delivery: ${d.status === "fee" ? (d.amount ? money(d.amount) : "Free") : "to be quoted for " + c.state}`,
    d.status === "fee" ? `Total: ${money(o.total)}` : `Total: ${money(o.sub)} plus delivery (quote needed)`,
    `Name: ${c.name}`, `Phone: ${c.phone}`, c.email ? `Email: ${c.email}` : "", `Deliver to: ${c.address}, ${c.city}, ${c.state}`,
    c.notes ? `Notes: ${c.notes}` : ""].filter(Boolean).join("\n");
}
const waLink = (text) => `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(text)}`;
function payMsg(msg) { const el = $("#pay-error"); el.textContent = msg; el.hidden = !msg; }
function logOrder(o, status) {
  const log = store.get("suigen-orders", []).filter((x) => x.ref !== o.ref);
  log.push({ ref: o.ref, total: o.total, status, at: new Date().toISOString() });
  store.set("suigen-orders", log.slice(-20));
}

$("#checkout").addEventListener("click", () => {
  payMsg("");
  if (!showErrs(validateCustomer(readCustomer(), false), CUST_IDS)) return;
  const o = buildOrder();
  logOrder(o, "whatsapp-sent");
  window.open(waLink(orderText(o, "Hello Suigen, I would like to place an order.")), "_blank");
});

function showDone(title, msg, ref, waText) {
  $("#checkout-box").hidden = true; $("#cart-items").hidden = true; $("#cart-empty").hidden = true;
  $("#pay-done").hidden = false;
  $("#pay-title").textContent = title; $("#pay-msg").textContent = msg; $("#pay-ref").textContent = ref;
  $("#pay-wa").hidden = !waText; if (waText) $("#pay-wa").href = waLink(waText);
}
$("#pay-close").addEventListener("click", () => {
  $("#pay-done").hidden = true; $("#checkout-box").hidden = false; $("#cart-items").hidden = false; renderCart(); closeCart();
});

async function afterPayment(o, reference) {
  showDone("Checking your payment", "Please wait while we confirm your payment with Paystack.", o.ref, "");
  let state = "pending";
  try {
    const r = await fetch(`${CONFIG.verifyUrl}?reference=${encodeURIComponent(reference)}`);
    const d = await r.json();
    state = d.verified ? "confirmed" : (d.status === "failed" || d.status === "abandoned") ? "failed" : "pending";
  } catch (e) { state = "pending"; }
  logOrder(o, state);
  if (state === "confirmed") {
    cart = []; saveCart();
    showDone("Payment confirmed", "Thank you. Your payment is verified. Send your order details so we can start.", o.ref,
      orderText(o, `Hello Suigen, my payment is confirmed (Paystack ref ${reference}).`));
  } else if (state === "pending") {
    cart = []; saveCart();
    showDone("Payment received, confirmation pending", "Paystack reported a payment but we could not verify it automatically yet. We check every payment in Paystack before production starts. Keep your reference and send your details on WhatsApp.", o.ref,
      orderText(o, `Hello Suigen, I paid via Paystack (ref ${reference}) and am waiting for confirmation.`));
  } else {
    showDone("Payment not completed", `Paystack did not confirm this payment, so your order has not been placed and your cart is saved. If you were charged, message us on WhatsApp with Paystack reference ${reference}.`, o.ref, "");
  }
}

function pay(channels) {
  payMsg("");
  if (!cart.length) return;
  if (!showErrs(validateCustomer(readCustomer(), true), CUST_IDS)) return;
  if (totals().d.status !== "fee") { payMsg("Delivery to this state needs a quote. Order on WhatsApp and we will confirm it before you pay."); return; }
  if (CONFIG.paystackKey.includes("xxxx") || typeof PaystackPop === "undefined") { payMsg("Online payment is not switched on yet. Please use Order on WhatsApp."); return; }
  const o = buildOrder();
  logOrder(o, "started");
  let paid = false;
  PaystackPop.setup({
    key: CONFIG.paystackKey, email: o.customer.email, amount: o.total * 100, currency: "NGN", channels, ref: o.ref,
    metadata: { order_ref: o.ref, state: o.customer.state, items: o.items.map((i) => ({ id: i.id, qty: i.qty })),
      custom_fields: [
        { display_name: "Name", variable_name: "name", value: o.customer.name },
        { display_name: "Phone", variable_name: "phone", value: o.customer.phone },
        { display_name: "Address", variable_name: "address", value: `${o.customer.address}, ${o.customer.city}, ${o.customer.state}` }
      ] },
    callback: function (res) { paid = true; afterPayment(o, res.reference); },
    onClose: function () { if (!paid) payMsg("Payment window closed. No payment was taken and your cart is saved."); }
  }).openIframe();
}
$("#pay-card").addEventListener("click", () => pay(["card"]));
$("#pay-transfer").addEventListener("click", () => pay(["bank_transfer", "bank", "ussd"]));

// ================= Custom quote form =================
const QUOTE_IDS = ["q-name", "q-phone", "q-email", "q-item", "q-qty", "q-file"];
const FILE_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
function quoteText(f) {
  return ["Hello Suigen, I would like a custom quote.", `Name: ${f.get("name")}`, `Phone: ${f.get("phone")}`, f.get("email") ? `Email: ${f.get("email")}` : "",
    `Item: ${f.get("item")}`, `Quantity: ${f.get("qty")}`, `Preferred size: ${f.get("size")}`, f.get("colours") ? `Colours: ${f.get("colours")}` : "",
    `Details: ${f.get("notes") || "None"}`, "I will send my reference image on WhatsApp."].filter(Boolean).join("\n");
}
$("#quote-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target, f = new FormData(form), err = {};
  if (String(f.get("name")).trim().length < 2) err["q-name"] = "Enter your name.";
  if (!PHONE_RE.test(String(f.get("phone")).replace(/[\s()-]/g, ""))) err["q-phone"] = "Enter a valid Nigerian phone number.";
  if (f.get("email") && !EMAIL_RE.test(String(f.get("email")))) err["q-email"] = "Enter a valid email address.";
  if (!f.get("item")) err["q-item"] = "Choose an item.";
  const q = Number(f.get("qty"));
  if (!Number.isInteger(q) || q < 1 || q > 1000) err["q-qty"] = "Enter a quantity from 1 to 1000.";
  const file = $("#q-file").files[0];
  if (file && !FILE_TYPES.includes(file.type)) err["q-file"] = "Upload a JPG, PNG, WebP or PDF file.";
  else if (file && file.size > 5 * 1024 * 1024) err["q-file"] = "The file is larger than 5 MB.";
  $("#form-error").hidden = true;
  if (!showErrs(err, QUOTE_IDS)) { $("#form-error").textContent = "Please fix the highlighted fields."; $("#form-error").hidden = false; return; }
  const btn = $("#q-submit"); btn.disabled = true; btn.textContent = "Sending...";
  const wa = waLink(quoteText(f));
  let ok = false;
  try { ok = (await fetch("/", { method: "POST", body: f })).ok; } catch (x) { ok = false; }
  btn.disabled = false; btn.textContent = "Send quote request";
  $("#quote-success").hidden = false; $("#q-wa").href = wa;
  if (ok) {
    $("#q-title").textContent = "Request received";
    $("#q-msg").textContent = "Thank you. We will reply within one working day with a price and timeline. To speed things up, you can also send it on WhatsApp.";
    form.reset();
  } else {
    $("#q-title").textContent = "We could not send the form online";
    $("#q-msg").textContent = "Your request was not submitted. Please send it on WhatsApp instead using the button below. Your answers are filled in for you.";
  }
  $("#quote-success").scrollIntoView({ block: "nearest" });
});

// ================= Mobile menu =================
$("#menu-btn").addEventListener("click", () => {
  const open = $("#main-nav").classList.toggle("open");
  $("#menu-btn").setAttribute("aria-expanded", String(open));
});
$("#main-nav").addEventListener("click", (e) => {
  if (e.target.tagName === "A") { $("#main-nav").classList.remove("open"); $("#menu-btn").setAttribute("aria-expanded", "false"); }
});

// ================= Gallery of past custom work: add photos to images/gallery/ and edit captions =================
const GALLERY = [1, 2, 3, 4, 5, 6].map((n) => ({ image: `images/gallery/work-${n}.jpg`, caption: `Custom order ${n}` }));
GALLERY.forEach((g) => {
  const fig = document.createElement("figure"), img = new Image();
  img.alt = g.caption; img.loading = "lazy"; img.src = g.image;
  img.onload = () => { $("#work").hidden = false; };
  img.onerror = () => fig.remove();
  const cap = document.createElement("figcaption"); cap.textContent = g.caption;
  fig.append(img, cap); $("#gallery").append(fig);
});

// ================= Scroll reveal =================
document.documentElement.classList.add("js");
const io = "IntersectionObserver" in window
  ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.12 })
  : null;
function reveal() {
  document.querySelectorAll(".section h2,.card,.steps li,.gallery figure,.custom form,.tile,.why>div").forEach((el) => {
    if (el.classList.contains("reveal")) return;
    el.classList.add("reveal");
    io ? io.observe(el) : el.classList.add("in");
  });
}

$("#year").textContent = new Date().getFullYear();
renderProducts();
renderCart();
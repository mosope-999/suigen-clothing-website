# Suigen website: deploy notes

## Folder layout (keep exactly this)
```
index.html  styles.css  script.js  netlify.toml  robots.txt  sitemap.xml  README.md
images/                      product photos, collection textures, gallery/ (your work photos)
netlify/functions/           verify-payment.js  catalog.json
```

## Before you take real orders
1. **Delivery fees.** In `script.js`, fill `CONFIG.deliveryRates`, for example `{ "Lagos": 3000, "Federal Capital Territory": 4000 }`.
   States without a fee get a WhatsApp quote and cannot pay online. Put the same fees in `netlify/functions/catalog.json`.
2. **Prices.** If you change a price in `PRODUCTS`, change it in `catalog.json` too. The server uses `catalog.json` to check every payment.
3. **Paystack public key.** Put it in `CONFIG.paystackKey` (`pk_test_...` while testing, `pk_live_...` when live).
4. **Paystack secret key.** In Netlify: Project configuration, Environment variables, add `PAYSTACK_SECRET_KEY`. Never put it in any file.
5. **Deploy so the function runs.** Functions are not built by drag and drop. Deploy from GitHub, or with the Netlify CLI (`npm i -g netlify-cli`, then `netlify deploy --prod` in this folder).
   Check it: open `https://suigen-clothing.netlify.app/.netlify/functions/verify-payment?reference=test-ref` . A JSON reply (even "bad-reference" or "unconfigured") means it is live.
6. **Custom quote form.** It uses Netlify Forms. After deploying, open Netlify, Forms, and check "custom-quote" is listed. Submissions and uploaded files appear there.

## What happens at payment
Paystack popup, then the browser asks the function to verify the reference. The function checks the status, currency, reference and that the amount matches the items and state stored with the payment. Only then does the customer see "Payment confirmed". If the function cannot be reached, the customer sees "confirmation pending" and you confirm in the Paystack dashboard before making the order.

## Still placeholders
Gallery photos (`images/gallery/work-1.jpg` to `work-6.jpg`), real product photos, and your Instagram link.

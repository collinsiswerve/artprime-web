# Art Prime Interiors

A static catalogue on GitHub Pages, with catalogue management in Google Sheets and order enquiries sent to WhatsApp. No server, customer accounts or online payment gateway is required.

## Catalogue management

Keep the current spreadsheet columns in this order:

| Column | Value |
| --- | --- |
| A | Unique, stable product ID (number or text) |
| B | Product name |
| C | Public image URL |
| D | Regular price in KES |
| E | Sale price in KES, when applicable |
| F | New arrival: TRUE/FALSE |
| G | Best seller: TRUE/FALSE |
| H | On sale: TRUE/FALSE |
| I | Product description |
| J | Sold out: TRUE/FALSE |

Use positive prices. A sale is shown only when its price is lower than the regular price. Blank rows are ignored; duplicate product IDs prevent loading so that orders cannot target the wrong product. Keep IDs unchanged when editing a product, since saved carts and shared links use them. Add natural search words to names and descriptions, such as “mirror”, “brass” and “wall”.

Search checks names and descriptions, handles spaces, plurals and word order, and offers small spelling corrections when there are no exact matches. The existing All, New Arrivals, Best Sellers and Sale filters still apply to search results.

## Product sharing and orders

Each product has a Share product button (or Copy product link on browsers without native sharing). Links use `?product=ID` on the existing GitHub Pages address and open the selected product after the catalogue loads. If automatic copying is unavailable, the page displays a selectable link.

Returning customers keep their cart selections. Ordering remains disabled until current prices and availability load successfully. Sold-out or removed products are removed from the cart, and changed prices are updated. A loading failure preserves saved selections and offers a retry. The WhatsApp message labels the amount as an items subtotal; availability, payment and delivery are confirmed in the conversation.

## Development and checks

`assets/catalogue.js` contains the parsing, search, cart and link helpers. `assets/storefront.js` manages the page. Product and cart content is rendered as text and DOM elements rather than inserted as HTML. Images fall back to a local placeholder when an image is invalid or fails to load.

Run `npm test` with Node 18 or newer. The tests use Node's built-in test runner and require no installed dependencies.

Before merging a storefront change, check the page on desktop and mobile: search, product links, sharing/copy fallback, keyboard navigation, cart refresh and WhatsApp handoff. To preview locally, serve this directory with any static HTTP server. Opening a file directly is insufficient for checking network and sharing behavior.

Publishing still uses the repository's existing GitHub Pages setup. The Tailwind CDN and Google Fonts remain external runtime dependencies; compiling and self-hosting CSS is a separate performance improvement.

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

The published site uses the checked-in, minified `assets/styles.css`. Tailwind is a development dependency only; visitors do not download or run its compiler. To change styles, run `npm ci`, edit `styles/input.css`, the HTML or the storefront classes, then run `npm run build` and commit the generated stylesheet with the source changes. Use `npm run dev:css` to watch changes locally. The build scans both HTML and JavaScript so that dynamically created product cards, badges and cart controls retain their styles.

The header and page spacing share one height setting, and the logo grows at the desktop breakpoint. The hero uses local WebP files with separate phone crops and desktop sizes, plus a JPEG fallback. Its lighter heading and dark overlay improve text contrast. Google Fonts connections start early, and the fonts still use `display=swap`.

Product images stay managed in the spreadsheet. Unsplash and Pexels image URLs receive responsive sizes for cards, recommendations, the cart and the product view. Addresses from other hosts, including signed URLs, remain intact. For final catalogue photos, use sharp source images and a host that supports resizing; uploading a large original to a host without that feature still requires preparing a smaller image yourself.

The hero files are optimized versions of the existing photograph: https://images.unsplash.com/photo-1618221195710-dd6b41faaea6. The JPEG fallback also supplies the site's social preview image.

Before merging a storefront change, check the page on desktop and mobile: search, product links, sharing/copy fallback, keyboard navigation, cart refresh and WhatsApp handoff. To preview locally, serve this directory with any static HTTP server. Opening a file directly is insufficient for checking network and sharing behavior.

Publishing still uses the repository's existing GitHub Pages setup. The compiled stylesheet and hero files are committed, so GitHub Pages does not need a Node build step. Catalogue loading, Google Fonts and externally hosted product photographs still require their respective services.

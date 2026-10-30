# Art Prime Interiors

This is the website for Art Prime Interiors in Nairobi. I keep the shop easy to browse and use the Studio to showcase our interior design work. Product and project content lives in Google Sheets so I can update it without changing the website code.

- [Visit the website](https://collinsiswerve.github.io/artprime-web/)
- [Open the admin workbook](https://docs.google.com/spreadsheets/d/1A7pErif9dQMJ8Q-yclWOFDSgKzUNg4qLFbm6u-_Be5k/edit)
- [Publish the website](https://github.com/collinsiswerve/artprime-web/actions/workflows/publish-site.yml)
- [Read the detailed Studio guide](docs/STUDIO_CONTENT.md)

The site is static HTML, CSS and JavaScript, hosted on GitHub Pages. Customers can search the collection, save a cart and send an enquiry through WhatsApp. There are no customer accounts or online payments on the website.

## Where I make changes

| What I want to change | Where I edit it | When it appears |
| --- | --- | --- |
| Shop products, prices, availability and photos | `Sheet1` in the admin workbook | On a fresh page load after Google serves the change |
| Studio project details and cover photos | `Projects` | After importing and publishing through GitHub Actions |
| Studio gallery photographs | `ProjectImages` | After importing and publishing through GitHub Actions |
| Day-to-day instructions | `Instructions` in the workbook | Immediately in the workbook; this tab is not displayed on the website |
| Page wording, layout, contacts and social links | The HTML and assets in this repository | After the change reaches `main` and deployment succeeds |
| Privacy policy and terms | `privacy.html` and `terms.html` | After deployment succeeds |

**Keep `Sheet1` first in the workbook.** The shop reads the default tab, while the Studio importer reads its two tabs by name. Do not rename the Studio tabs or move the instructions tab ahead of the shop.

The workbook is publicly readable for the catalogue integration. It contains public product and portfolio content only. Client addresses, private project details, orders, payment records, passwords and API secrets belong elsewhere. An unchecked `published` box keeps a project off the Studio page; it does not make that row or its image links private.

## Updating the shop

Start in row 2 of `Sheet1`, with one product per row. Keep these columns in this order:

| Column | Header | What I enter |
| --- | --- | --- |
| A | `id` | A unique, permanent product ID. Numbers or text work. |
| B | `name` | The product's public name. |
| C | `image` | One direct, public image URL. |
| D | `originalPrice` | The regular price in KES, entered as a positive number. |
| E | `salePrice` | A positive sale price lower than the regular price, when applicable. |
| F | `isNewArrival` | `TRUE` to include it in New Arrivals; otherwise `FALSE`. |
| G | `isBestSeller` | `TRUE` to include it in Best Sellers; otherwise `FALSE`. |
| H | `isOnSale` | `TRUE` to show a valid sale price and include it in Sale. |
| I | `description` | A plain-text description, including useful material, size and search words. |
| J | `isSoldOut` | `TRUE` to show Sold Out and prevent ordering; `FALSE` when available. |

Enter prices as numbers such as `25000`, without `KES` or currency symbols. A filled sale price alone does not activate a sale: column H must also be `TRUE`, and the sale price must be lower than the regular price.

I keep IDs unchanged when editing an item because saved carts and shared links use them. To add a product, fill a new row. To mark it unavailable, set J to `TRUE`. To remove it entirely, clear the whole product row without touching row 1. Blank rows are ignored; duplicate IDs stop the catalogue from loading so an order cannot point at the wrong item.

After editing, allow Google a short time to serve the change, then reload the shop and check the item. A GitHub publication is not needed for shop-only changes.

### Search, sharing and the cart

Search uses names and descriptions. It handles spacing, plurals and word order, and offers small spelling corrections when no exact match is found. The All, New Arrivals, Best Sellers and Sale filters apply to the search results.

Product links use `?product=ID`; the Share product button opens native sharing or copies the link, with a selectable-link fallback. Studio links use `studio.html?project=ID` and open the project's gallery.

The cart is saved in the visitor's browser under `artPrimeCart`. It is checked against current prices and stock after the catalogue loads. Removed or sold-out items are taken out, and changed prices are updated. If the catalogue cannot load, saved selections remain and ordering is disabled until a retry succeeds.

The WhatsApp button prepares an editable message with the selected products, quantities and items subtotal. It does not take payment or reserve stock. We confirm availability, specifications, charges, payment and delivery in the conversation. Customers review and send the message themselves.

## Updating the Studio

The `Projects` and `ProjectImages` tabs are already set up. Add content from row 2. Each published project needs a permanent ID, title, category, cover image and cover description. Use plain text throughout.

### Projects: one row per project

| Column | Header | What I enter |
| --- | --- | --- |
| A | `id` | A unique ID such as `nairobi-residence`; lowercase letters, numbers and hyphens, up to 64 characters. |
| B | `title` | The public project title. |
| C | `location` | A general public location, such as `Nairobi`. Optional. |
| D | `category` | A consistent category such as `Residential`, `Commercial` or `Styling`. |
| E | `year` | Completion year, or blank if not needed. |
| F | `description` | The brief, materials and design decisions. |
| G | `coverImage` | A direct HTTPS URL for the main photograph. |
| H | `coverAlt` | A useful description of what is visible in the photograph. Required. |
| I | `sortOrder` | `1`, `2`, `3`… Lower numbers appear first. |
| J | `published` | Tick when ready to show it on the Studio page. |
| K | `featured` | Tick to include it in the opening slideshow. |

Only published projects appear on the website. If none of them is marked featured, all published projects are used in the opening slideshow. Categories create the portfolio filters automatically, so I keep their spelling consistent.

### ProjectImages: one row per photograph

| Column | Header | What I enter |
| --- | --- | --- |
| A | `projectId` | The exact ID from `Projects` column A, repeated for each photo in that gallery. |
| B | `imageUrl` | A direct HTTPS image URL. |
| C | `alt` | A brief description of this particular view. Required. |
| D | `caption` | An optional caption. |
| E | `sortOrder` | The photograph's position within the gallery: `1`, `2`, `3`… |

About 6–12 well-chosen photographs is a useful starting point. If a project has no gallery rows, its cover becomes its gallery image. Rows for unpublished projects are left out of the snapshot. A photo pointing to an unknown project ID stops the import and needs correcting.

The prepared input rules cover Projects rows 2–201 and ProjectImages rows 2–1001. If I need more space, I copy a blank prepared row's formatting and validation into the added rows and extend any validation references and filter ranges as needed.

### Publishing project changes

1. Upload the photographs, fill the two tabs and check the project IDs and image descriptions.
2. Tick `published` for the projects that are ready. Tick `featured` for the opening selection.
3. Open [Actions → Publish website](https://github.com/collinsiswerve/artprime-web/actions/workflows/publish-site.yml) and choose **Run workflow**.
4. Select **main** and leave **Import the latest Projects and ProjectImages tabs before publishing** checked.
5. Run it, wait for a successful deployment, then reload the Studio and check the covers, galleries and shared links.

The workflow reads both public tabs, validates them, runs the tests, builds the site, saves the portfolio snapshot and deploys it. If reading or validation fails, the previous live site remains available. Read the failed step's message, correct the sheet and run it again.

**Do not import the blank Studio tabs until the real content is ready.** An import with no published projects creates an empty portfolio and replaces the illustrative studies. The current bundled studies are labelled as illustrative; they are not presented as completed Art Prime commissions. Importing real content replaces them.

To replace a photograph, update its URL and publish again. To hide a project, untick `published` and publish again. To change its position, edit `sortOrder` and publish. Keep published IDs stable so existing links keep working.

A normal push to `main` publishes the snapshot already in the repository; it does not import new Studio rows. Running the workflow with the import option unchecked does the same. The workflow does not run on feature branches.

## Preparing images

Postimages still works. I use the **direct image link**, usually beginning `https://i.postimg.cc/`, rather than a `postimg.cc` page containing the image. The link should open the photograph itself in a private browser window without signing in. Paste only the URL, without Markdown, HTML or quotation marks.

For Postimages, prepare a sharp WebP or JPEG before uploading because this site leaves its URLs intact. Aim for roughly 1,200–1,600 pixels on the long edge for product photos and around 1,600–2,000 for large portfolio views. Adjust compression to the photograph; a few hundred KB is a useful target where the detail allows it. Keep the original files separately. Replacing a photo with a new URL helps avoid stale browser caches.

Cloudinary is an optional alternative when I want automatic resizing. Public delivery URLs receive responsive widths and automatic format and quality. Unsplash and Pexels delivery URLs also receive responsive sizes. Signed URLs are preserved. A shared Google Drive page is not a direct image URL.

Local optimized images can also live in `assets/studio/`; use their full public website URLs in the sheet. The bundled Studio studies have 640px and 1600px WebP versions. Cards load lazily, the opening image is prioritised and the gallery loads views as needed. No autoplay, embedded social feeds or animation framework is required.

Before publishing client work, I confirm permission to use the photographs and remove identifying details that should stay private. A general location is usually enough for the public portfolio.

## Policies, contacts and social pages

The privacy policy explains the saved cart, WhatsApp handoff, external requests, enquiry information and privacy rights. The terms explain the catalogue, written order confirmation, pricing, delivery, changes, returns and separate design agreements. They preserve applicable Kenyan consumer rights. Order-specific fees, deposits, lead times and return arrangements are confirmed before an order is agreed; the website does not set a universal deposit or returns window.

I review the policies whenever the site's data use or our ordering process changes, and update the revision dates. Adding analytics, forms, payments, an email list or an embedded social feed needs a fresh privacy review before it goes live. Reference points are the [ODPC's guidance on data subject rights](https://www.odpc.go.ke/rights-of-a-data-subject/) and the [Kenyan Consumer Protection Act](https://new.kenyalaw.org/akn/ke/act/2012/46/eng@2022-12-31).

These social pages are linked in the footer of all four pages:

| Platform | Page |
| --- | --- |
| TikTok | https://www.tiktok.com/@artprimeinteriorsltd |
| Instagram | https://www.instagram.com/artprimeinteriorsltd/ |
| Facebook | https://www.facebook.com/share/18mP6CK5UX/ |
| X | https://x.com/artprime_Int |

The TikTok and Instagram links omit the tracking parameters from the shared addresses. The Facebook share link is kept as supplied. These are plain links, with no platform scripts or embeds.

Contact details: **+254 748 649 103**, **artprimeinteriorsltd@gmail.com**, **Spur Mall, Thika Road, Nairobi, Kenya**. If these change, update all four HTML pages and the WhatsApp links in `assets/catalogue.js` and `assets/studio.js`, along with this README and the workbook instructions.

## Running and maintaining the code

### Typography and motion

The visual direction follows [Studio Nato’s Studio page](https://www.studionato.com/studio): Rauschen A typography, warm paper backgrounds, fine rules and generous spacing. The same typeface runs through the shop, cart, Studio, galleries and policy pages. The Studio process rows expand with a plus-to-minus transition.

The Studio opens with a full-viewport portfolio, following the browsing style of [Studio Nato’s Projects page](https://www.studionato.com/projects). Scroll or swipe vertically between photographs, choose a side dot, or use the arrow controls. A small centered title opens the current project gallery, and clicking the photograph does the same. The first and last projects join in a continuous loop. “All projects” and “The studio” lead to the overview and approach below. The height follows the available screen on desktop and phones, including browser-bar and orientation changes.

`assets/studio-stage.js` handles the portfolio selection, native vertical scroll snapping, boundary copies and keyboard controls. `assets/studio-stage.css` keeps these rules on the Studio page. The `featured` checkbox continues to choose the opening selection; when none are featured, all published projects are shown. Reduced-motion preferences make button and dot navigation immediate.

`assets/site-motion.js` controls the 900ms linear fades, the navigation that moves away while scrolling down and returns while scrolling up, and the phone menu. It also registers cards after a catalogue search or portfolio filter. Keyboard focus reveals content immediately, and reduced-motion preferences turn off the transitions. The page remains readable when JavaScript or animation support is unavailable.

The font source is defined in `assets/typography.css`. It currently uses the public Squarespace font URL used by the reference site, so its availability depends on that external source. For independent hosting, I need my own licensed Rauschen A webfont and can replace that URL with the licensed hosting location. This repository contains the font declaration rather than a copy of the font file. If the source changes, the pages fall back to Arial. The font preload in each HTML page must match the URL in `typography.css`.

### Local checks

Use Node 18 or newer; the publishing workflow uses Node 24. Install the pinned dependencies before rebuilding:

```sh
npm ci
npm test
npm run build:site
```

`npm run build` compiles the minified Tailwind stylesheet into `assets/styles.css`. `npm run dev:css` watches style changes. Commit the generated stylesheet when it changes. `npm run build:site` also copies the four HTML pages and assets into `dist/`, the GitHub Pages deployment folder. Visitors download CSS, not the Tailwind compiler.

Serve the repository or `dist/` with a static HTTP server to test it; opening HTML directly from the filesystem does not reproduce fetch and sharing behaviour. `npm run sync:studio` imports the live sheet into the local snapshot, so I run it only when I intend to publish those rows.

| File or folder | Purpose |
| --- | --- |
| `index.html` | Shop, product view and cart |
| `studio.html` | Featured interiors, project index and gallery |
| `privacy.html`, `terms.html` | Public policy pages |
| `assets/atelier.css` | Shared visual styling and policy layouts |
| `assets/typography.css` | Rauschen A webfont declaration and fallback |
| `assets/site-motion.js` | Scroll fades, shared navigation and phone menu |
| `assets/studio-stage.js`, `assets/studio-stage.css` | Full-screen Studio portfolio, vertical scrolling and project selection |
| `styles/input.css`, `tailwind.config.cjs`, `assets/styles.css` | Tailwind source, scanned pages and compiled output |
| `assets/catalogue.js` | Product parsing, search, cart, image and sharing helpers |
| `assets/storefront.js` | Shop interactions and live catalogue loading |
| `assets/studio-model.js`, `assets/studio.js` | Portfolio validation and page interactions |
| `assets/studio-config.json` | Public workbook ID and Studio tab names |
| `assets/studio-projects.json` | Validated portfolio snapshot served to visitors |
| `scripts/sync-studio.cjs` | Reads and validates the Studio tabs before replacing the snapshot |
| `scripts/prepare-site.cjs` | Copies the website into `dist/` |
| `.github/workflows/publish-site.yml` | Import, tests, build and GitHub Pages deployment |
| `tests/` | Catalogue, image, production-asset and portfolio checks |
| `docs/STUDIO_CONTENT.md` | Detailed Studio workflow and image credits |

GitHub Pages uses **Settings → Pages → Source: GitHub Actions**. No private API key or paid database is needed for the current public catalogue. Google Sheets, the external Squarespace font source and externally hosted photographs still depend on their respective services.

Before merging website changes, I check desktop and phone layouts, policy and social links, search, product details, product and project deep links, keyboard navigation, cart refresh and the WhatsApp message. A successful build is followed by a check of the deployed pages.

## If something is wrong

| What I see | What I check |
| --- | --- |
| A product photo is missing | Open the URL directly without signing in. Replace page links, duplicated URLs or deleted images. The site displays a placeholder when an image fails. |
| A sale price is not showing | Check H is `TRUE` and E is a positive number below D. |
| The shop will not load | Check `Sheet1` is first, the public endpoint is still readable, the A–J column order is intact and product IDs are unique. Retry loading. |
| A Studio edit is missing | Check `published`, then run the workflow with import checked and confirm deployment succeeded. |
| A Studio import fails | Read its error. Check exact tab names, headers, unique IDs, gallery IDs, direct HTTPS URLs and required alt descriptions. |
| A photo is cropped unexpectedly | Choose a cover with room around the subject and check both phone and desktop crops. Use a gallery view for the full composition. |
| Old styling or a previous image remains | Reload without cache. Use a new photo URL or update the stylesheet version when appropriate. |

The home hero is an optimized local version of [this Unsplash photograph](https://images.unsplash.com/photo-1618221195710-dd6b41faaea6), with phone crops, desktop WebP sizes and a JPEG fallback. The Studio photograph sources are recorded in the detailed guide.

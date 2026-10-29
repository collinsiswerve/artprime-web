# Updating the Art Prime Studio

The Studio is a fast, static portfolio. Visitors read `assets/studio-projects.json` from the website, not Google Sheets. The publishing workflow validates the sheet and replaces this snapshot only after the import succeeds. If an import fails, the previously published website stays available.

The included interior studies are clearly marked **illustrative photographs**. They show the portfolio layout and are not completed Art Prime commissions. Publishing the real project rows removes the illustrative notice automatically.

## The workbook is ready

The [Art Prime Admin workbook](https://docs.google.com/spreadsheets/d/1A7pErif9dQMJ8Q-yclWOFDSgKzUNg4qLFbm6u-_Be5k/edit) already has **Projects**, **ProjectImages** and **Instructions** tabs. Start entering project content in row 2. The headings below are a reference; do not paste a second header into the data rows.

Keep **Sheet1** first because the shop reads the workbook's default tab. Keep the exact Studio tab names and row 1 headings. The workbook is publicly readable, so I put only public portfolio content here. Unpublished rows are still readable in the workbook and are not private storage for client details.

After entering the first projects, open **Actions → Publish website → Run workflow**, choose `main`, keep **Import the latest Projects and ProjectImages tabs before publishing** checked, and run it. A failed import explains what needs correcting and leaves the previous live website available. GitHub Pages uses **Settings → Pages → Source: GitHub Actions** and publishes the shop, Studio and both policy pages together.

An import with no published projects replaces the illustrative studies with an empty portfolio. I leave the import until the real project rows are ready. A normal push to `main` publishes the saved snapshot without importing the sheet.

The workbook ID and tab names are in `assets/studio-config.json`. No API keys, database subscription or server are needed for this public portfolio workflow. Product updates continue to use the existing product sheet as before.

## Projects tab — one row per project

The existing header row is shown below for reference (tabs separate the columns):

```text
id	title	location	category	year	description	coverImage	coverAlt	sortOrder	published	featured
```

| Column | Heading | What to enter |
| --- | --- | --- |
| A | id | A permanent ID such as `nairobi-residence`. Lowercase letters, numbers and hyphens; unique per project. Keep it unchanged so shared links continue to work. |
| B | title | The public project title. |
| C | location | A public location, or a general label such as `Private residence · Nairobi`. Optional. |
| D | category | For example `Residential`, `Commercial` or `Styling`. The page creates filters automatically. |
| E | year | Completion year. Optional; leave blank when unknown. |
| F | description | A concise account of the brief, materials and design decisions. Plain text, not HTML. |
| G | coverImage | The direct HTTPS URL of the project's main photograph. Choose a strong landscape view that also crops well on a phone. |
| H | coverAlt | A short, useful description of what is visible in the cover photograph. Required. |
| I | sortOrder | `1`, `2`, `3`… Controls the portfolio order. |
| J | published | `TRUE` to show the project; `FALSE` to keep it out of the public portfolio. |
| K | featured | `TRUE` to include the project in the full-screen opening slideshow. If none are featured, all published projects are used. |

## ProjectImages tab — one row per photograph

```text
projectId	imageUrl	alt	caption	sortOrder
```

| Column | Heading | What to enter |
| --- | --- | --- |
| A | projectId | The exact permanent ID from column A of Projects. Repeat it for every image in that project's gallery. |
| B | imageUrl | A direct HTTPS photo URL. |
| C | alt | A brief description of this view. Required. |
| D | caption | An optional short caption. |
| E | sortOrder | The photo sequence: `1`, `2`, `3`… |

Add as many image rows as the project needs. Start with a complete room view, then complementary angles, materials and details. About 6–12 carefully selected photos is usually more effective than a large set of near-duplicates. If a published project has no gallery rows, its cover image is used.

## My publishing routine

1. Prepare the delivery copies of the photographs and upload them to the image host. Keep the originals separately.
2. Paste their direct delivery URLs into the two sheet tabs. Mark the project `published=TRUE` when ready.
3. Run **Actions → Publish website → Run workflow** with the import option checked.

To replace a photo, change its URL and publish again. To add a project, add one Projects row and its ProjectImages rows. To remove a project, set `published=FALSE` and publish. Use a fresh image URL when replacing an image so browsers do not retain the previous photograph. Sheet changes become visible after a successful publication, not immediately after editing a cell.

## Image hosting and speed

I can keep using **Postimages**. I copy its direct image URL, usually beginning `https://i.postimg.cc/`, and check that it opens the photograph itself without signing in. A `postimg.cc` page containing the photograph is not the image URL. I prepare a compressed WebP or JPEG before uploading because the site keeps Postimages URLs unchanged; roughly 1,600–2,000 pixels on the long edge suits a large portfolio view, with the file size kept as small as the detail allows.

**Cloudinary is an optional alternative for automatic resizing.** Upload the originals in its media dashboard and copy the public delivery URL, for example `https://res.cloudinary.com/YOUR_CLOUD/image/upload/v123/projects/living-room.jpg`. The site requests smaller versions for cards and larger versions for the gallery, with automatic format and quality. Keep any Cloudinary API secret out of the sheet and website.

The image code also optimizes Unsplash and Pexels delivery URLs. Other HTTPS hosts work, but their URLs are kept intact: prepare appropriately sized files if the host has no resizing service. A shared Google Drive page or a web page containing a photo is not a direct photo URL.

Keep the full-resolution originals separately. With a resizing host, the website can deliver a smaller version for each screen. Avoid text or logos baked into the photographs. Portfolio cards are lazy-loaded; the opening photo is prioritized; galleries load photos as visitors browse. There is no automatic slideshow, heavy animation framework or forced scrolling. Before sharing client work, I confirm permission to publish the images and check that private or identifying details are removed.

An alternative with no additional image service is to optimize WebP files and upload them under `assets/studio/` in this repository, then use their full public website URLs in the sheet. That approach requires preparing and uploading the sizes yourself.

## Local development

```sh
npm ci
npm run sync:studio     # only when the sheet content is ready to publish
npm test
npm run build:site
```

`npm run build` still updates the checked-in Tailwind stylesheet for root-based GitHub Pages hosting. `build:site` also prepares the deployable `dist/` folder. The Studio reader never makes a visitor wait for a Google Sheets request.

## Preview image credits

The bundled illustrative photographs are downloaded, responsive WebP versions of these Unsplash sources. They are not taken from Studio Nato:

| Local file stem | Source |
| --- | --- |
| living | https://images.unsplash.com/photo-1600210492486-724fe5c67fb0 |
| warm | https://images.unsplash.com/photo-1600607687939-ce8a6c25118c |
| dining | https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea |
| details | https://images.unsplash.com/photo-1600607687920-4e2a09cf159d |
| bedroom | https://images.unsplash.com/photo-1616486338812-3dadae4b4ace |
| kitchen | https://images.unsplash.com/photo-1600566752355-35792bedcfea |

The file stems are stable asset identifiers; use the descriptive alt text to identify each photograph's actual contents.

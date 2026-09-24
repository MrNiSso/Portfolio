# Photography & Film Portfolio

A fast, static portfolio site. No database, no CMS, no build framework.
**To add work you drop a file into a folder and give it the right name.** That's the whole system.

---

## 1. Adding a photo

Put the file in `media/photos/<category>/`:

```
media/photos/weddings/07 - Rain On The Steps.jpg
```

That's it. The folder is the category, the filename is the caption.

## 2. Adding a video

**Hosted on YouTube or Vimeo** (recommended — GitHub caps files at 100 MB):
save a **still image** as the thumbnail and put the video ID in the filename.

```
media/videos/films/03 - Sea Change [yt=dQw4w9WgXcQ].jpg
media/videos/films/04 - Atlas [vimeo=76979871].jpg
```

**Hosted here in the repo** (keep it small):

```
media/videos/films/05 - Teaser.mp4
media/videos/films/05 - Teaser.jpg     ← same name = its poster frame
```

## 3. Removing work

Delete the file. Nothing else to clean up.

## 4. Publishing

```bash
git add . && git commit -m "New wedding work" && git push
```

GitHub Actions rebuilds the gallery and redeploys the site. Give it a minute.

---

## The filename grammar

```
[order] - Title [token] [token].ext
```

| Part | Example | What it does |
|---|---|---|
| `01 - ` | `01 - Golden Hour.jpg` | Sort order. Lower numbers come first. Optional. |
| Title | `Golden Hour Vows` | The caption. `golden-hour-vows.jpg` works too — it becomes "Golden Hour Vows". |
| `[featured]` | `01 - Vows [featured].jpg` | Also appears in the homepage hero slideshow. |
| `[wide]` | `03 - Coastline [wide].jpg` | Spans two columns in the grid. Good for panoramas. |
| `[2025]` | `05 - Last Dance [2025].jpg` | Shows the year on the tile and in the viewer. |
| `[yt=ID]` | `[yt=dQw4w9WgXcQ]` | This image is the poster for that YouTube video. |
| `[vimeo=ID]` | `[vimeo=76979871]` | Same, for Vimeo. |

Tokens can be combined in any order:
`01 - Nomad, A Short Film [featured] [2025] [yt=aqz-KE-bpKQ].jpg`

**Files starting with `_` or `.` are ignored** — handy for drafts you are not ready to show.

### Categories

A category is just a folder. To add one, make the folder:

```
media/photos/newborn/01 - First Week.jpg
```

It shows up as a filter chip called "Newborn" automatically. To control its
label and where it sits in the filter bar, add it to `site.config.json`:

```json
"categories": {
  "newborn": { "label": "Newborn & Family", "order": 6 }
}
```

Photos and videos share categories — `media/photos/commercial/` and
`media/videos/commercial/` both land under the same "Commercial" chip.

### Supported formats

Photos: `.jpg` `.jpeg` `.png` `.webp` `.gif` `.avif`
Video: `.mp4` `.webm` `.mov` `.m4v`, or a YouTube/Vimeo ID

---

## Editing the text

Everything written on the site lives in **`site.config.json`**.
Open it, change the words, save. You never need to touch the HTML.

| Block | Controls |
|---|---|
| `brand` | Name, monogram, role, location |
| `seo` | Page title, description, share image, live URL |
| `hero` | Eyebrow, headline lines, subtitle, both buttons |
| `marquee` | The scrolling word list |
| `about` | Bio paragraphs, the four stats, gear tags, portrait |
| `highlights` | The six "why work with me" cards (see icon names below) |
| `services` | Package names, prices, blurbs, feature lists |
| `process` | The numbered steps |
| `testimonials` | Quotes, names, roles |
| `faq` | Questions and answers in the accordion |
| `cta` | The closing call-to-action band |
| `contact` | Email, phone, availability, enquiry types, form endpoint |
| `socials` / `footer` | Links and the small print |

`highlights[].icon` accepts: `camera` `clock` `spark` `shield` `gallery`
`film` `heart` `check`. Anything else falls back to `spark`.

Your photo for the About section goes at `media/branding/portrait.png`
(or point `about.portrait` at any file you like).

---

## Changing the look

The whole design is driven by a handful of CSS variables at the top of
`assets/css/style.css`. Change these and the entire site follows:

```css
--accent:      #7cc243;   /* the green on buttons, badges and highlights */
--accent-deep: #5ea52b;   /* hover + text on light green */
--accent-soft: #e9f5da;   /* pill and icon-badge backgrounds */
--bg:          #f7f6f1;   /* warm cream page */
--ink:         #121310;   /* dark buttons and the footer */
--bloom-green: rgba(139, 205, 84, .55);   /* the ambient glow, top-right */
--bloom-warm:  rgba(255, 190, 122, .46);  /* the ambient glow, top-left */
```

The soft gradient washes come from `.bloom` elements. Add
`<div class="bloom" aria-hidden="true"></div>` as the first child of any
section to give it one, or `bloom bloom--soft` for a quieter version.

The typeface is [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans),
loaded from Google Fonts in `index.html` and set once as `--font`.

A light/dark toggle sits in the header. Dark values live under
`[data-theme="dark"]` in the same file, and the visitor's choice is remembered.

---

## Running it on your own machine

```bash
npm start
```

Opens <http://localhost:4321>. It rescans `media/` each time it starts.

Other commands:

| Command | What it does |
|---|---|
| `npm run scan` | Rebuild `data/gallery.json` from `media/` |
| `npm run thumbs` | Make small WebP previews so the grid loads fast |
| `npm run build` | Both of the above |
| `npm start` | Scan, then serve locally |

`npm run thumbs` needs `sharp`, which `npm install` sets up. It is optional —
skip it and the site serves your full-size images instead. Worth doing once you
have a lot of large exports: it is the difference between a grid that loads
instantly and one that loads a 40 MB file per tile.

---

## Putting it on GitHub

1. Create a repository and push this folder to it.
2. On GitHub: **Settings → Pages → Source → GitHub Actions**.
3. Push anything. The site builds and goes live at
   `https://<your-username>.github.io/<repo>/`.

If you prefer **Settings → Pages → Deploy from a branch**, that works too — the
workflow commits the rebuilt gallery back to the branch for exactly that case.

Using your own domain? Add a file called `CNAME` at the top level containing
just your domain, and point your DNS at GitHub Pages.

Update `seo.url` in `site.config.json` to your live address so link previews
work when clients share the site.

---

## How it fits together

```
index.html            the page shell
site.config.json      ← all your words live here
assets/css/style.css  the design
assets/js/main.js     the behaviour
tools/scan.js         reads media/ → writes data/gallery.json
tools/thumbs.js       optional WebP previews
data/gallery.json     generated — do not hand-edit
media/                ← your work lives here
  photos/<category>/
  videos/<category>/
  branding/           portrait, og-cover
  _thumbs/            generated
```

`scan.js` reads each image's real dimensions straight from the file header, so
the grid knows every aspect ratio before a single image downloads. That is why
the layout never jumps while the page loads.

---

## Replacing the placeholder work

The images shipped in `media/photos/` and `media/videos/` are abstract
placeholders so the site is not empty on first run. Delete them and add your own:

```bash
rm media/photos/*/*.png media/videos/*/*.png
# drop your files in, then:
npm run build
```

Also worth changing before you publish: your name and email in
`site.config.json`, the About portrait, and the demo YouTube/Vimeo IDs.

---

## Accessibility & performance notes

- Works with a keyboard throughout; the image viewer traps focus, supports
  arrow keys and Escape, and returns focus where you left it.
- Honours `prefers-reduced-motion` — animations switch off for visitors who ask.
- Images are lazy-loaded with explicit dimensions, so no layout shift.
- Light and dark themes, remembered per visitor.
- YouTube embeds use `youtube-nocookie.com`, and nothing loads until a visitor
  actually opens a video.

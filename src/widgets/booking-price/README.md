# Booking Price Widget

Displays a configurable booking card for a single product. The widget fetches live product information from the Activities API and renders a booking card with price, availability and a call-to-action.

---

## Usage

```html
<link
  rel="stylesheet"
  href="g2a-book-price-widget.css">

<div
  class="g2a-book-price-widget"
  data-slug="scuba-diving-in-havelock"
  data-base-url="https://go2andaman.com">
</div>

<script src="g2a-book-price-widget.iife.js"></script>
```

---

## Complete Example

```html
<div
  class="g2a-book-price-widget"

  data-slug="scuba-diving-in-havelock"

  data-base-url="https://go2andaman.com"

  data-show-image="true"
  data-show-product-name="true"
  data-show-description="true"
  data-show-location="true"

  data-show-price="true"

  data-show-guests="true"
  data-show-locations="false"

  data-show-meta="true"

  data-show-button="true"

  data-button-text="Book Now"

  data-out-of-stock-text="Currently Unavailable"
  data-out-of-stock-button-text="Unavailable">
</div>
```

---

## Configuration

| Attribute | Required | Default | Description |
|------------|:--------:|:-------:|-------------|
| `data-slug` | ✅ | - | Product slug |
| `data-base-url` | ❌ | `http://localhost:5173` | Base booking website URL |
| `data-show-image` | ❌ | `true` | Display the product image |
| `data-show-product-name` | ❌ | `true` | Display the product name |
| `data-show-description` | ❌ | `true` | Display the short description |
| `data-show-location` | ❌ | `true` | Display the selected location |
| `data-show-price` | ❌ | `true` | Display the starting price |
| `data-show-guests` | ❌ | `true` | Display the maximum guests allowed |
| `data-show-locations` | ❌ | `false` | Display all available locations |
| `data-show-meta` | ❌ | `true` | Display the metadata section |
| `data-show-button` | ❌ | `true` | Display the CTA button |
| `data-button-text` | ❌ | `Book Now` | CTA button text |
| `data-out-of-stock-text` | ❌ | `Currently Unavailable` | Text shown when the product is unavailable |
| `data-out-of-stock-button-text` | ❌ | `Unavailable` | Disabled button text |

---

## Tally Enquiry Fallback

Some experiences aren't in the booking engine yet. If the API returns **404** for `data-slug`, the widget still renders an "available" card and the button opens a Tally form instead of the booking page. Once a product with the same slug is added to the booking engine, the live bookable card takes over automatically.

The client embed needs nothing extra — just `data-slug`. Name, price, location and form come from the [enquiry Google Sheet](https://docs.google.com/spreadsheets/d/1E1VNTSHJNpO0Iquc7XppDa8BR-TAGS9hmVuEhN6u3EY/edit) (read at runtime, so edits go live without a rebuild). It must be shared as "Anyone with the link: Viewer". Row 1 is the header:

| Category | Name | Location | URL | Tally Forms | Price | Price Type | Slug *(optional)* |
|----------|------|----------|-----|-------------|-------|------------|------|
| Day Trips | Port Blair Full Day Trip | Port Blair | https://go2andaman.com/book/port-blair-full-day-trip/ | https://tally.so/r/wkVkre | 3000 | Starts From | |

- **Slug** — the widget's `data-slug`. If empty, it's the last segment of **URL** (`port-blair-full-day-trip`). Fill it in when the booking slug differs from the URL.
- **Tally Forms** — form link or bare ID.
- **Price Type** — `Starts From` (default) or `Flat`.
- Optional extra columns: `Per` (unit after the price, default `guest`), `Description`, `Image`, `Max Guests`. Other columns (e.g. Category) are ignored.
- If a slug appears in several rows, the first row wins. A row with Slug `default` supplies the form for rows/slugs without one.

See `enquiryProducts.js`.

Any of the attributes below on the embed override the sheet:

| Attribute | Default | Description |
|-----------|:-------:|-------------|
| `data-tally-form-id` | - | Tally form ID (the `xxxx` in `tally.so/r/xxxx`). Enables the fallback |
| `data-tally-display` | `popup` | `popup` opens the form in a modal from the button; `inline` embeds the form in the card |
| `data-name` | Title-cased slug | Product name |
| `data-price` | - | Starting price shown on the card |
| `data-pricing-mode` | `guest` | Unit after the price (`₹6,500 / guest`) |
| `data-price-type` | `SLOT` | `SLOT`/`KM_BASED` show "Starting from", anything else "Flat Price" |
| `data-location` | - | Location line |
| `data-description` | - | Short description |
| `data-image` | - | Image URL |
| `data-max-guests` | - | Max guests line |
| `data-enquiry-button-text` | `data-button-text` | Button text in fallback mode |

The form receives hidden fields `slug`, `product` and `page` — add matching hidden fields in Tally to capture them.

Errors other than 404 (or a 404 without `data-tally-form-id`) still show the error.

---

## Common Configurations

### Minimal

```html
<div
  class="g2a-book-price-widget"
  data-slug="scuba-diving-in-havelock"
  data-show-image="false"
  data-show-description="false"
  data-show-meta="false">
</div>
```

### CTA Only

```html
<div
  class="g2a-book-price-widget"
  data-slug="scuba-diving-in-havelock"
  data-show-image="false"
  data-show-description="false"
  data-show-price="true"
  data-button-text="Reserve Now">
</div>
```

### Blog Widget

```html
<div
  class="g2a-book-price-widget"
  data-slug="scuba-diving-in-havelock"
  data-show-locations="true"
  data-button-text="View Details">
</div>
```

---

## API

The widget fetches product information from:

```
GET /api/v1/products/app/products-list/:slug
```

Example:

```
GET /api/v1/products/app/products-list/scuba-diving-in-havelock
```

---

## Build

```bash
npm run build:booking-price-widget
```

Output:

```text
dist-booking-price-widget/
├── g2a-book-price-widget.iife.js
└── g2a-book-price-widget.css
```

---

## Project Structure

```text
booking-price/
├── BookingPriceWidget.vue
├── entry.js
├── index.js
├── schema.js
└── README.md
```

---

## Example Response

The widget consumes a product object similar to:

```json
{
  "name": "Scuba Diving",
  "slug": "scuba-diving",
  "thumbnail_url": "...",
  "starting_price": 3500,
  "price_type": "SLOT",
  "redirectUrl": "/water-sports/scuba-diving/scuba-diving-in-havelock/book",
  "out_of_stock": false,
  "selectedLocation": {
    "name": "Havelock Island"
  }
}
```
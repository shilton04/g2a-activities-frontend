// Experiences that aren't in the booking engine yet are listed in a Google
// Sheet. When the API returns 404 for a slug, the widget looks the slug up in
// the sheet, renders the card from that row, and the button opens a Tally form
// instead of the booking page. Once a product with the same slug is added to
// the booking engine, the live product takes over automatically and the row
// can be removed.
//
// The sheet must be shared as "Anyone with the link: Viewer". Row 1 holds the
// column headers (case-insensitive, any order, unknown columns ignored):
//
//   Name | Location | URL | Tally Forms | Price | Price Type
//   Slug | Per | Description | Image | Max Guests       (optional)
//
// A row's slug is the `Slug` column, or else the last path segment of `URL`
// (https://go2andaman.com/book/full-day-havelock-trip/ -> full-day-havelock-trip).
// `Tally Forms` takes the form link (https://tally.so/r/wkVkre) or bare ID.
// `Price Type` is "Starts from" (default) or "Flat".
// `Per` is the unit after the price (default "guest"). If a slug appears in
// more than one row, the first row wins. A row with slug `default` supplies
// the form for rows (and unlisted slugs) that leave it empty.
//
// Any data-* attribute on the embed (data-price, data-name,
// data-tally-form-id, ...) overrides the sheet.

const SHEET_ID = "1E1VNTSHJNpO0Iquc7XppDa8BR-TAGS9hmVuEhN6u3EY";
const SHEET_GID = "0";

const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&headers=1&gid=${SHEET_GID}`;

// Sheet column -> data-* attribute name, so sheet rows and embed attributes
// can be merged into one config.
const COLUMN_KEYS = {
  slug: "slug",
  url: "url",
  name: "name",
  location: "location",
  price: "price",
  per: "pricingMode",
  pricing_mode: "pricingMode",
  tally_forms: "tallyFormId",
  tally_form: "tallyFormId",
  tally_form_id: "tallyFormId",
  description: "description",
  image: "image",
  max_guests: "maxGuests",
  price_type: "priceType",
};

function slugFromUrl(url) {
  return url?.split(/[?#]/)[0].split("/").filter(Boolean).pop();
}

// The widget labels SLOT/KM_BASED prices "Starting from", anything else
// "Flat Price".
function priceTypeFrom(value) {
  return /flat/i.test(value ?? "") ? "FLAT" : "SLOT";
}

// Accepts https://tally.so/r/wkVkre, https://tally.so/embed/wkVkre or wkVkre.
function tallyFormIdFrom(value) {
  return value?.match(/tally\.so\/(?:r|embed|popup)\/([^/?#]+)/)?.[1] ?? value;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

let sheetPromise = null;

// Fetched once per page and shared by every widget on it.
function loadSheet() {
  if (!sheetPromise) {
    sheetPromise = fetch(SHEET_CSV_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Enquiry sheet HTTP ${response.status}`);
        }

        return response.text();
      })
      .then((text) => {
        const [header = [], ...rows] = parseCsv(text);

        const keys = header.map(
          (column) =>
            COLUMN_KEYS[column.trim().toLowerCase().replace(/\s+/g, "_")]
        );

        const products = {};

        rows.forEach((cells) => {
          const product = {};

          keys.forEach((key, index) => {
            const value = cells[index]?.trim();
            if (key && value) product[key] = value;
          });

          product.slug ||= slugFromUrl(product.url);
          product.tallyFormId = tallyFormIdFrom(product.tallyFormId);
          product.priceType = priceTypeFrom(product.priceType);

          if (product.slug && !products[product.slug]) {
            products[product.slug] = product;
          }
        });

        return products;
      })
      .catch((err) => {
        sheetPromise = null;
        throw err;
      });
  }

  return sheetPromise;
}

// Returns the enquiry config for a slug: its row, with the `default` row's
// form filled in if the row has none. Empty for slugs not in the sheet.
export async function getEnquiryConfig(slug) {
  const products = await loadSheet();

  const config = { ...products[slug] };

  config.tallyFormId ||= products.default?.tallyFormId;

  return config;
}

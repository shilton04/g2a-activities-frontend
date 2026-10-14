import BookingPriceWidget from "./BookingPriceWidget.vue";

import { mountWidget } from "../shared/mount";
import { getProduct } from "../shared/api";
import { getEnquiryConfig } from "./enquiryProducts";

function getBoolean(value, defaultValue = true) {
  if (value === undefined) {
    return defaultValue;
  }

  return value.toLowerCase() === "true";
}

function getString(value, defaultValue = "") {
  return value ?? defaultValue;
}

function titleFromSlug(slug) {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Builds a product-shaped object for a slug that isn't in the booking engine
// yet, from its enquiry-sheet row overlaid with any data-* attributes, so the
// card can fall back to a Tally enquiry form instead of erroring.
function getEnquiryProduct(dataset, config) {
  return {
    name: getString(config.name, titleFromSlug(dataset.slug)),
    slug: dataset.slug,
    short_description: getString(config.description),
    thumbnail_url: getString(config.image),
    // Tolerates "₹6,500"-style values typed into the sheet.
    starting_price:
      Number(String(config.price ?? "").replace(/[^\d.]/g, "")) || null,
    price_type: getString(config.priceType, "SLOT"),
    pricing_mode: getString(config.pricingMode, "guest"),
    max_bookable_per_booking: config.maxGuests
      ? Number(config.maxGuests)
      : null,
    selectedLocation: config.location ? { name: config.location } : null,
    locations: [],
    out_of_stock: false,
  };
}

document
  .querySelectorAll(".g2a-book-price-widget")
  .forEach((element) => {
    mountWidget({
      element,

      component: BookingPriceWidget,

      loader: async () => {
        const {
          slug,
          baseUrl = process.env.VITE_BASE_URL,
        } = element.dataset;

        if (!slug) {
          throw new Error("Missing data-slug.");
        }

        let product;
        let enquiry = null;

        try {
          product = await getProduct(slug);
        } catch (err) {
          if (err.status !== 404) {
            throw err;
          }

          const sheetConfig = await getEnquiryConfig(slug).catch((sheetErr) => {
            console.error(sheetErr);
            return {};
          });

          const config = { ...sheetConfig, ...element.dataset };

          if (!config.tallyFormId) {
            throw err;
          }

          product = getEnquiryProduct(element.dataset, config);

          enquiry = {
            formId: config.tallyFormId,
            display: getString(element.dataset.tallyDisplay, "popup"),
          };
        }

        return {
          product,

          baseUrl,

          enquiry,

          options: {

            showProductName: getBoolean(
              element.dataset.showProductName,
              true
            ),

            showImage: getBoolean(
              element.dataset.showImage,
              true
            ),

            showDescription: getBoolean(
              element.dataset.showDescription,
              true
            ),

            showLocation: getBoolean(
              element.dataset.showLocation,
              true
            ),

            showPrice: getBoolean(
              element.dataset.showPrice,
              true
            ),

            showGuests: getBoolean(
              element.dataset.showGuests,
              true
            ),

            showLocations: getBoolean(
              element.dataset.showLocations,
              false
            ),

            showMeta: getBoolean(
              element.dataset.showMeta,
              true
            ),

            showButton: getBoolean(
              element.dataset.showButton,
              true
            ),

            buttonText: getString(
              element.dataset.buttonText,
              "Book Now"
            ),

            enquiryButtonText: getString(
              element.dataset.enquiryButtonText,
              element.dataset.buttonText ?? "Book Now"
            ),

            outOfStockText: getString(
              element.dataset.outOfStockText,
              "Currently Unavailable"
            ),

            outOfStockButtonText: getString(
              element.dataset.outOfStockButtonText,
              "Unavailable"
            ),
          },
        };
      },
    });
  });

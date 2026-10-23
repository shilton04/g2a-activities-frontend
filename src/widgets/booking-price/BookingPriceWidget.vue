<template>
  <div
    class="g2a-book-widget"
    :class="{
      'g2a-book-widget--disabled': product.out_of_stock,
    }"
  >
    <img
      v-if="settings.showImage && product.thumbnail_url"
      :src="product.thumbnail_url"
      :alt="product.name"
      class="g2a-book-widget__image"
    />

    <div class="g2a-book-widget__body">
      <div class="g2a-book-widget__header">
        <h3 v-if="settings.showProductName" class="g2a-book-widget__title">
          {{ product.name }}
        </h3>

        <div
          v-if="settings.showLocation && product.selectedLocation"
          class="g2a-book-widget__location"
        >
          📍 {{ product.selectedLocation.name }}
        </div>
      </div>

      <p
        v-if="settings.showDescription && shortDescription"
        class="g2a-book-widget__description"
      >
        {{ shortDescription }}
      </p>

      <div
        v-if="
          settings.showPrice &&
          !product.out_of_stock &&
          (!enquiry || product.starting_price)
        "
        class="g2a-book-widget__price-section"
      >
        <div class="g2a-book-widget__label">
          {{ priceLabel }}
        </div>

        <div class="g2a-book-widget__amount">
          ₹{{ formatPrice(product.starting_price) }}

          <span
            >/
            {{
              product.slug == "bike-rentals"
                ? "bike"
                : product.slug == "airport-transfers"
                  ? "vehicle"
                  : product.pricing_mode
            }}</span
          >
        </div>
      </div>

      <div v-else-if="product.out_of_stock" class="g2a-book-widget__status">
        {{ settings.outOfStockText }}
      </div>

      <div v-if="settings.showMeta" class="g2a-book-widget__meta">
        <div v-if="settings.showGuests && product.max_bookable_per_booking">
          👥 Max {{ product.max_bookable_per_booking }} /
          {{
            product.slug == "bike-rentals"
              ? "bike"
              : product.slug == "airport-transfers"
                ? "vehicle"
                : product.pricing_mode
          }}
        </div>

        <div v-if="settings.showLocations && product.locations?.length">
          📍 {{ product.locations.map((l) => l.name).join(", ") }}
        </div>
      </div>

      <iframe
        v-if="isInlineEnquiry"
        ref="tallyFrame"
        :data-tally-src="tallyEmbedUrl"
        :title="product.name"
        class="g2a-book-widget__enquiry-form"
        loading="lazy"
        width="100%"
        height="400"
        frameborder="0"
      ></iframe>

      <button
        v-else-if="settings.showButton"
        class="g2a-book-widget__button"
        :disabled="product.out_of_stock"
        @click="bookNow"
      >
        {{
          product.out_of_stock
            ? settings.outOfStockButtonText
            : enquiry
              ? settings.enquiryButtonText
              : settings.buttonText
        }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";

const TALLY_SCRIPT_SRC = "https://tally.so/widgets/embed.js";

let tallyScriptPromise = null;

function loadTally() {
  if (window.Tally) return Promise.resolve(window.Tally);

  if (!tallyScriptPromise) {
    tallyScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = TALLY_SCRIPT_SRC;
      script.async = true;
      script.onload = () => resolve(window.Tally);
      script.onerror = () => {
        tallyScriptPromise = null;
        reject(new Error("Failed to load Tally"));
      };
      document.head.appendChild(script);
    });
  }

  return tallyScriptPromise;
}

const props = defineProps({
  product: {
    type: Object,
    required: true,
  },

  baseUrl: {
    type: String,
    default: "https://activities.go2andaman.com",
  },

  options: {
    type: Object,
    default: () => ({}),
  },

  // Set when the product isn't in the booking engine yet: { formId, display }.
  // The card then opens a Tally form instead of linking to the booking page.
  enquiry: {
    type: Object,
    default: null,
  },
});

const tallyFrame = ref(null);

const settings = computed(() => ({
  showImage: true,
  showDescription: true,
  showLocation: true,
  showPrice: true,
  showGuests: true,
  showLocations: false,
  showMeta: true,
  showButton: true,
  showProductName: true,

  buttonText: "Book Now",

  enquiryButtonText: "Book Now",

  outOfStockText: "Currently Unavailable",

  outOfStockButtonText: "Unavailable",

  ...props.options,
}));

const bookingUrl = computed(() => {
  if (!props.product.redirectUrl) return null;

  return `${props.baseUrl}${props.product.redirectUrl}`;
});

const shortDescription = computed(() => {
  if (!props.product.short_description) return "";

  return props.product.short_description.length > 120
    ? props.product.short_description.substring(0, 120) + "..."
    : props.product.short_description;
});

const priceLabel = computed(() => {
  return ["SLOT", "KM_BASED"].includes(props.product.price_type)
    ? "Starting from"
    : "Flat Price";
});

function formatPrice(price) {
  if (!price) return "-";

  return Number(price).toLocaleString("en-IN");
}

const isInlineEnquiry = computed(
  () => props.enquiry?.display === "inline"
);

// Passed to Tally as hidden fields so submissions say which experience
// (and which page) the enquiry came from.
const tallyHiddenFields = computed(() => ({
  slug: props.product.slug,
  product: props.product.name,
  page: window.location.href,
}));

const tallyEmbedUrl = computed(() => {
  if (!props.enquiry) return null;

  const params = new URLSearchParams({
    alignLeft: "1",
    hideTitle: "1",
    transparentBackground: "1",
    dynamicHeight: "1",
    ...tallyHiddenFields.value,
  });

  return `https://tally.so/embed/${props.enquiry.formId}?${params}`;
});

onMounted(async () => {
  if (!isInlineEnquiry.value) return;

  try {
    const Tally = await loadTally();
    Tally.loadEmbeds();
  } catch {
    // Without the script the form still works, just without auto-height.
    if (tallyFrame.value) tallyFrame.value.src = tallyEmbedUrl.value;
  }
});

async function openEnquiry() {
  const { formId } = props.enquiry;

  try {
    const Tally = await loadTally();

    Tally.openPopup(formId, {
      layout: "modal",
      width: 500,
      hiddenFields: tallyHiddenFields.value,
    });
  } catch {
    const params = new URLSearchParams(tallyHiddenFields.value);

    window.open(
      `https://tally.so/r/${formId}?${params}`,
      "_blank",
      "noopener,noreferrer"
    );
  }
}

function bookNow() {
  if (props.enquiry) {
    openEnquiry();
    return;
  }

  if (!bookingUrl.value) return;

  window.open(bookingUrl.value, "_blank", "noopener,noreferrer");
}
</script>

<style scoped>
.g2a-book-widget {
  width: 100%;
  max-width: 380px;
  overflow: hidden;
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 14px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
}

.g2a-book-widget__image {
  width: 100%;
  height: 220px;
  object-fit: cover;
  display: block;
}

.g2a-book-widget__body {
  padding: 18px;
}

.g2a-book-widget__title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: #222;
}

.g2a-book-widget__location {
  margin-top: 6px;
  font-size: 14px;
  color: #666;
}

.g2a-book-widget__description {
  margin: 14px 0;
  font-size: 14px;
  line-height: 1.6;
  color: #555;
}

.g2a-book-widget__price-section {
  margin: 18px 0;
}

.g2a-book-widget__label {
  font-size: 13px;
  color: #777;
}

.g2a-book-widget__amount {
  margin-top: 4px;
  font-size: 30px;
  font-weight: 700;
  color: #111;
}

.g2a-book-widget__amount span {
  font-size: 15px;
  color: #777;
  font-weight: 400;
}

.g2a-book-widget__status {
  margin: 18px 0;
  color: #d32f2f;
  font-weight: 700;
}

.g2a-book-widget__meta {
  margin: 18px 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: #666;
  font-size: 14px;
}

.g2a-book-widget__button {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 20px;
  background: #ffc107;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: 0.2s;
  font-family: inherit;
}

.g2a-book-widget__button:hover:not(:disabled) {
  background: #f5b904;
}

.g2a-book-widget__button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.g2a-book-widget__enquiry-form {
  display: block;
  width: 100%;
  border: none;
}

.g2a-book-widget--disabled {
  opacity: 0.95;
}

@media (max-width: 640px) {
  .g2a-book-widget {
    max-width: 100%;
  }

  .g2a-book-widget__image {
    height: 180px;
  }

  .g2a-book-widget__title {
    font-size: 20px;
  }

  .g2a-book-widget__amount {
    font-size: 26px;
  }
}
</style>

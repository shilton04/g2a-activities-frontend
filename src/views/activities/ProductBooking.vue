<template>
  <!-- Initial load skeleton (only before the first check-available response) -->
  <template v-if="!result">
    <v-card rounded="lg" flat class="border mx-auto my-4">
      <v-container>
        <div class="d-flex align-center">
          <v-skeleton-loader
            type="image"
            width="72"
            height="72"
            class="mr-4 flex-shrink-0"
            style="border-radius: 12px"
          />

          <div class="flex-grow-1">
            <v-skeleton-loader type="text" width="45%" class="mb-2" />
            <v-skeleton-loader type="text" width="30%" />
          </div>
        </div>
      </v-container>
    </v-card>

    <div class="my-4">
      <v-skeleton-loader type="text" width="140" class="mb-3" />

      <div class="d-flex ga-3" style="overflow: hidden">
        <v-skeleton-loader
          v-for="n in 8"
          :key="n"
          type="image"
          width="54"
          height="74"
          class="flex-shrink-0"
          style="border-radius: 18px"
        />
      </div>
    </div>

    <v-card rounded="lg" flat class="border my-4">
      <v-container>
        <div class="d-flex justify-space-between align-center">
          <div style="width: 55%">
            <v-skeleton-loader type="text" width="60%" class="mb-2" />
            <v-skeleton-loader type="text" width="90%" />
          </div>

          <v-skeleton-loader
            type="image"
            width="90"
            height="32"
            style="border-radius: 16px"
          />
        </div>
      </v-container>
    </v-card>

    <v-skeleton-loader type="text" width="80%" class="my-4" />
  </template>

  <template v-else>
    <v-card
      ref="topCard"
      rounded="lg"
      flat
      :disabled="loading"
      class="border mx-auto my-4"
    >
      <v-container>
        <div class="d-flex align-center" v-if="product">
          <v-avatar size="72" rounded="lg" class="mr-4">
            <v-img :src="product.thumbnail_url" :alt="product.name" cover />
          </v-avatar>

          <div>
            <div class="g2a-title-lg">
              {{ product.name }}
            </div>

            <div class="text-grey">
              {{ selectedLocation?.name }}
            </div>
          </div>
        </div>
      </v-container>
    </v-card>

    <div>
      <!-- Dynamic booking fields -->
      <v-form ref="bookingForm" @submit.prevent>
        <div class="d-flex flex-column ga-4">
          <BookingFieldRenderer
            v-for="field in fields"
            :key="field.field"
            :model-value="fieldModel(field.field)"
            @update:model-value="
              (value) => handleFieldUpdate(field.field, value)
            "
            :field="field"
            :slots="slots"
            :form="form"
            :maxQuantity="maxQuantity"
            :minQuantity="minQuantity"
            :serviceHours="serviceHours"
            :minBookingLeadHours="minBookingLeadHours"
            :productSlug="product?.slug"
            :productTypeSlug="route.params.productType"
            :locationSlug="selectedLocation?.slug"
            :pricing="pricing"
            :nextAvailableDate="product?.next_available_date"
            :available="result?.available ?? true"
          />
        </div>
      </v-form>

      <template v-if="result.available">
        <!-- <div class="my-4 text-success">
            This product is available for booking. Click "Continue Booking" to
            proceed.
          </div> -->

        <!-- Slot Selection -->
        <div v-if="isSlotPricing" class="mt-4">
          <div class="g2a-title-lg mb-3">
            {{
              availability.slot_display_name ||
              (availability.slot_display_type == "TIME"
                ? "Select Time Slot"
                : `Select ${availability.slot_display_type}`)
            }}
          </div>

          <v-text-field
            v-if="slots.length > 4"
            v-model="slotSearch"
            prepend-inner-icon="mdi-magnify"
            :placeholder="`Search ${availability.slot_display_type}...`"
            density="compact"
            variant="outlined"
            clearable
            rounded="lg"
            hide-details
            class="mb-4"
          />

          <v-alert
            v-if="filteredSlots.length === 0"
            type="info"
            variant="tonal"
            class="mb-3"
          >
            No matching slots found.
          </v-alert>

          <div
            v-else
            style="max-height: 300px; overflow-y: auto; overflow-x: hidden"
          >
            <div
              cols="12"
              v-for="slot in filteredSlots"
              :key="slot.token"
              class="my-2"
              @click="form.selected_slot_token = slot.token"
            >
              <v-card
                class="slot-card"
                :class="{ active: form.selected_slot_token === slot.token }"
                variant="outlined"
                @click="form.selected_slot_token = slot.token"
              >
                <div class="d-flex align-center">
                  <!-- Left -->
                  <div class="flex-grow-1">
                    <div class="d-flex align-center">
                      <div class="slot-name">
                        {{ slot.name }}
                      </div>

                      <v-chip
                        size="x-small"
                        class="ml-2"
                        color="warning"
                        variant="tonal"
                        v-if="slot.available < 5"
                      >
                        Few left
                      </v-chip>

                      <v-btn
                        icon
                        v-if="slot.nationality_restriction === 'NON_INDIAN_ONLY'"
                        size="x-small"
                        class="ml-2"
                        color="info"
                        variant="tonal"
                        prepend-icon="mdi-airplane"
                      >
                        <v-icon>mdi-airplane</v-icon>
                      </v-btn>
                    </div>

                    <div class="slot-time mt-1" v-if="slot.slot_type == 'TIME'">
                      <v-icon size="14">mdi-clock-outline</v-icon>
                      <template v-if="slot.is_start_time_only">
                        Starts {{ formatTime(slot.start_time) }}
                      </template>
                      <template v-else>
                        {{ formatTime(slot.start_time) }} —
                        {{ formatTime(slot.end_time) }}
                      </template>
                      <span>
                        {{ slot.is_preferred ? "(Preferred only)" : "" }}
                      </span>
                    </div>
                  </div>

                  <!-- Right -->

                  <div class="text-right ml-4">
                    <div class="slot-price">
                      ₹{{
                        (
                          Number(slot.price) * (pricing.quantity || 1)
                        ).toLocaleString()
                      }}
                    </div>
                  </div>
                </div>
                <div
                  v-if="slot.description"
                  class="mt-2 text-caption text-grey"
                >
                  {{ slot.description }}
                </div>
              </v-card>
            </div>
          </div>

          <div v-if="slotError" class="text-error text-caption mt-2">
            {{ slotError }}
          </div>

          <v-alert
            v-if="selectedSlot?.is_preferred"
            type="info"
            variant="tonal"
            density="comfortable"
            class="mb-3"
            rounded="lg"
          >
            Your preferred time slot is subject to availability. If unavailable,
            we'll contact you with an available time slot.
          </v-alert>
        </div>

        <!-- Price -->

        <div v-if="dailyPricing.length > 2" class="my-4">
          <div class="g2a-title-lg">Daily Pricing</div>

          <div
            v-for="day in previewDailyPricing"
            :key="day.date"
            class="d-flex justify-space-between my-2"
          >
            <span>{{ day.date }}</span>

            <strong> ₹{{ day.unit_price * form.quantity }} </strong>
          </div>

          <div
            class="g2a-link"
            v-if="hasMorePricing"
            variant="text"
            size="large"
            color="primary"
            @click="pricingDialog = true"
          >
            View {{ dailyPricing.length }} more
          </div>
        </div>

        <div v-if="productHighlights.length" class="my-4">
          <v-card
            rounded="lg"
            flat
            class="border my-4"
            v-for="(highlight, index) in productHighlights"
            :key="index"
          >
            <v-container>
              <div class="d-flex align-start mb-2 g2a-title-xs">
                <v-icon
                  :icon="getIcon(highlight.title)"
                  size="24"
                  color="brandColor2"
                  class="mt-1"
                />
                <div class="ml-2">
                  <div class="g2a-title-lg">{{ highlight.title }}</div>
                  <div class="mt-1">{{ highlight.content }}</div>
                </div>
              </div>
            </v-container>
          </v-card>
        </div>

        <v-row class="my-4">
          <v-col v-if="productInclusions.length" cols="12" md="6">
            <v-card rounded="lg" flat class="h-100 border">
              <div class="pa-4" style="background-color: #f2f7f2">
                <div class="g2a-title-lg text-success">What's Included?</div>
              </div>
              <v-container>
                <div
                  v-for="(inc, index) in productInclusions"
                  :key="index"
                  class="d-flex align-start mb-2 g2a-title-xs"
                >
                  <v-icon
                    color="success"
                    size="15"
                    class="mr-2 mt-1 flex-shrink-0"
                  >
                    mdi-check-circle
                  </v-icon>

                  <div>{{ inc.content }}</div>
                </div>
              </v-container>
            </v-card>
          </v-col>

          <v-col v-if="productExclusions.length" cols="12" md="6">
            <v-card rounded="lg" flat class="h-100 border">
              <div class="pa-4" style="background-color: #faf4f4">
                <div class="g2a-title-lg text-error">What's not included?</div>
              </div>
              <v-container>
                <div
                  v-for="(inc, index) in productExclusions"
                  :key="index"
                  class="d-flex align-start mb-2 g2a-title-xs"
                >
                  <v-icon
                    color="error"
                    size="15"
                    class="mr-2 mt-1 flex-shrink-0"
                  >
                    mdi-close-circle
                  </v-icon>

                  <div>{{ inc.content }}</div>
                </div>
              </v-container>
            </v-card>
          </v-col>
        </v-row>
      </template>

      <v-alert
        v-else
        :type="unavailableAlertType"
        variant="tonal"
        rounded="lg"
        density="comfortable"
        class="mt-2"
      >
        {{ error || result.message }}
      </v-alert>
    </div>
  </template>

  <div v-if="result?.available" class="booking-footer">
    <v-card flat color="surface">
      <v-divider />
      <v-container>
        <div class="booking-footer-content">
          <div>
            <div class="text-grey">
              Total Price
              <!-- <span v-if="isKmBasedPricing && pricing.distance_km != null">
                · {{ pricing.distance_km }} km
                <template v-if="pricing.duration_minutes != null">
                  (~{{ pricing.duration_minutes }} min)
                </template>
              </span> -->
            </div>

            <div class="g2a-title-lg">₹{{ pricing.grand_total }}</div>
          </div>

          <v-btn
            flat
            rounded="lg"
            color="brandColor"
            size="large"
            min-width="180"
            :disabled="loading"
            @click="continueBooking"
          >
            Continue Booking
          </v-btn>
        </div>
      </v-container>
    </v-card>
  </div>

  <v-dialog
    v-model="pricingDialog"
    scrollable
    max-width="450"
    scrim="rgba(15,23,42,.30)"
    :style="{
      backdropFilter: 'blur(5px)',
      webkitBackdropFilter: 'blur(5px)',
    }"
  >
    <v-card>
      <div class="pa-4">
        <div class="g2a-title-xl">Daily Pricing</div>
      </div>

      <v-list>
        <v-list-item v-for="day in dailyPricing" :key="day.date">
          <template #title>
            {{ day.date }}
          </template>

          <template #append> ₹{{ day.unit_price * form.quantity }} </template>
        </v-list-item>
      </v-list>
      <v-spacer />
      <div class="pa-2">
        <v-btn
          block
          color="primary"
          variant="text"
          @click="pricingDialog = false"
        >
          Close
        </v-btn>
      </div>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from "vue";

import { useRoute, useRouter } from "vue-router";

import apiClient from "@/services/api";

import BookingFieldRenderer from "@/components/activities/booking-fields/BookingFieldRenderer.vue";
import moment from "moment";

const route = useRoute();
const router = useRouter();

const productSlug = route.params.product;
const pricingDialog = ref(false);
const loading = ref(false);
const error = ref("");
const result = ref(null);

const slotError = ref("");
const topCard = ref(null);
const bookingForm = ref(null);

const slotSearch = ref("");

const estimateId = ref(route.query.estimate_id || null);

const today = moment().startOf("day");
const tomorrow = moment(today).add(1, "day");

const formatDate = (date) => moment(date).format("YYYY-MM-DD");

const isValidDate = (value) => {
  return !!value && moment(value, "YYYY-MM-DD", true).isValid();
};

let pickup = isValidDate(route.query.pickup_date)
  ? moment(route.query.pickup_date, "YYYY-MM-DD")
  : moment(tomorrow);

// Pickup must be at least tomorrow — bumps forward a stale cached/URL
// value (e.g. "today", saved before this rule existed) automatically.
if (!pickup.isAfter(today, "day")) {
  pickup = moment(tomorrow);
}

let returnDate = isValidDate(route.query.return_date)
  ? moment(route.query.return_date, "YYYY-MM-DD")
  : moment(pickup).add(1, "day");

// Return must be after pickup
if (!returnDate.isAfter(pickup, "day")) {
  returnDate = moment(pickup).add(1, "day");
}

const form = reactive({
  date: isValidDate(route.query.date) ? route.query.date : formatDate(today),

  guests: Number(route.query.guests) > 0 ? Number(route.query.guests) : 1,

  quantity: Number(route.query.quantity) > 0 ? Number(route.query.quantity) : 1,

  transfer_type:
    route.query.transfer_type === "location_to_airport"
      ? "location_to_airport"
      : "airport_to_location",

  pickup_location: Number(route.query.pickup_location) || null,

  drop_location: Number(route.query.drop_location) || null,

  pickup_time: route.query.pickup_time || "",

  preferred_time: route.query.preferred_time || "",

  selected_slot_token: route.query.slot || null,

  pickup_date: formatDate(pickup),
  return_date: formatDate(returnDate),
});

watch(
  () => ({
    estimate_id: estimateId.value,
    date: form.date,
    guests: form.guests,
    quantity: form.quantity,
    slot: form.selected_slot_token,
    pickup_date: form.pickup_date,
    return_date: form.return_date,
  }),
  (query) => {
    router.replace({
      query: Object.fromEntries(
        Object.entries(query).filter(
          ([, value]) => value !== "" && value != null,
        ),
      ),
    });
  },
  { deep: true },
);

watch(
  () => route.query,
  (query) => {
    estimateId.value = query.estimate_id || null;

    if (query.date && query.date !== form.date) {
      form.date = query.date;
    }

    if (query.guests && Number(query.guests) !== form.guests) {
      form.guests = Number(query.guests);
    }

    if (query.quantity && Number(query.quantity) !== form.quantity) {
      form.quantity = Number(query.quantity);
    }

    if ((query.slot || null) !== form.selected_slot_token) {
      form.selected_slot_token = query.slot || null;
    }

    if ((query.pickup_date || "") !== form.pickup_date) {
      form.pickup_date = query.pickup_date || "";
    }

    if ((query.return_date || "") !== form.return_date) {
      form.return_date = query.return_date || "";
    }
  },
);

const filteredSlots = computed(() => {
  const search = slotSearch.value?.toLowerCase().trim();

  const filtered = !search
    ? slots.value
    : slots.value.filter((slot) => {
        return (
          slot.name?.toLowerCase().includes(search) ||
          formatTime(slot.start_time)?.toLowerCase().includes(search) ||
          formatTime(slot.end_time)?.toLowerCase().includes(search)
        );
      });

  // Earliest start_time first; slots without a start_time (e.g. non-TIME
  // variants) sort after timed ones, in their original order.
  return [...filtered].sort((a, b) => {
    if (!a.start_time && !b.start_time) return 0;
    if (!a.start_time) return 1;
    if (!b.start_time) return -1;
    return a.start_time.localeCompare(b.start_time);
  });
});

/**
 * Normalized response
 */

const quotation = computed(() => result.value?.data ?? {});

const product = computed(() => quotation.value.product ?? {});

const bookingTemplate = computed(() => product.value?.bookingTemplate);

const productTerms = computed(() => quotation.value.product.terms ?? {});

const productInclusions = computed(
  () => quotation.value.product.inclusions ?? {},
);

const productExclusions = computed(
  () => quotation.value.product.exclusions ?? {},
);

const productHighlights = computed(
  () => quotation.value.product?.highlights ?? [],
);

const getIcon = (title) => {
  if (title == "Security Deposits") {
    return "mdi-shield-lock-outline";
  } else if (title == "Damage Policy") {
    return "mdi-information-outline";
  } else if (title == "Information") {
    return "mdi-information-outline";
  } else if (title == "Timings") {
    return "mdi-clock-outline";
  } else if (title == "Duration") {
    return "mdi-timer-outline";
  }
  return "mdi-crown-outline";
};

const pricing = computed(() => quotation.value.pricing ?? {});

const maxQuantity = computed(
  () => pricing.value.max_bookable_per_booking ?? 10,
);

const minQuantity = computed(() => pricing.value.min_bookable_per_booking ?? 1);

const availability = computed(() => quotation.value.availability ?? {});

const dailyPricing = computed(() => availability.value.daily_pricing ?? []);

const previewDailyPricing = computed(() => {
  return dailyPricing.value.slice(0, 3);
});

const hasMorePricing = computed(() => {
  return dailyPricing.value.length > 3;
});

const fields = computed(
  () => bookingTemplate.value?.product_page_schema?.fields ?? [],
);

const slots = computed(() => availability.value.slots ?? []);

const serviceHours = computed(() => availability.value.service_hours ?? []);

const minBookingLeadHours = computed(
  () => availability.value.min_booking_lead_hours ?? 0,
);

const selectedSlot = computed(() => availability.value.selected_slot ?? null);

const isSlotPricing = computed(() => pricing.value.pricing_type === "SLOT");
const isKmBasedPricing = computed(
  () => pricing.value.pricing_type === "KM_BASED",
);

const selectedLocation = computed(() => result.value?.selected_location);

const unavailableAlertType = computed(() => {
  if (error.value) return "error";

  const message = result.value?.message?.toLowerCase() ?? "";

  if (message.includes("select")) return "info";

  return "warning";
});

const formatTime = (time) => {
  if (!time) return "";

  const [hour, minute] = time.split(":");

  return new Date(0, 0, 0, hour, minute).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

// The slot picker is a custom card grid, not a real Vuetify input, so it
// can't register with v-form - clear its error manually once picked.
watch(
  () => form.selected_slot_token,
  (token) => {
    if (token) slotError.value = "";
  },
);

// The `transfer_type` field component manages several sub-values
// (transfer_type, pickup_location, drop_location, pickup_time) and emits
// them together as one merged object. Every other field is a plain
// scalar bound straight to form[field]. These two helpers keep both
// shapes working without form.transfer_type ever ending up holding an
// object instead of a string.
const fieldModel = (fieldKey) => {
  if (fieldKey === "transfer_type") {
    return {
      transfer_type: form.transfer_type,
      pickup_location: form.pickup_location,
      drop_location: form.drop_location,
      pickup_time: form.pickup_time,
    };
  }

  if (fieldKey === "pickup_and_drop_location") {
    return {
      pickup_location: form.pickup_location,
      drop_location: form.drop_location,
      pickup_time: form.pickup_time,
    };
  }

  // derive_quantity is sugar for editing form.guests directly - form.quantity
  // is kept in sync by the deriveQuantityField watcher below.
  if (fieldKey === "derive_quantity") {
    return form.guests;
  }

  return form[fieldKey];
};

const handleFieldUpdate = (fieldKey, value) => {
  if (
    (fieldKey === "transfer_type" || fieldKey === "pickup_and_drop_location") &&
    value &&
    typeof value === "object"
  ) {
    Object.assign(form, value);
    return;
  }

  if (fieldKey === "derive_quantity") {
    form.guests = value;
    return;
  }

  form[fieldKey] = value;
};

// A product using derive_quantity declares a single "derive_quantity" schema
// field (guests only - no separate quantity field) with
// config.per_qty_guests. Whenever guests changes, recompute quantity
// locally so the price preview shown before submit matches what the
// backend will independently recompute (it always overrides quantity from
// guests using the same formula, so this only needs to match for display).
const deriveQuantityField = computed(() =>
  fields.value.find((field) => field.field === "derive_quantity"),
);

watch(
  [() => form.guests, deriveQuantityField],
  ([guests, field]) => {
    if (!field) return;

    const perQtyGuests = field.config?.per_qty_guests || 1;

    form.quantity = Math.ceil((guests || 1) / perQtyGuests);
  },
  { immediate: true },
);

// On the first check-available response, default the guests/quantity
// stepper(s) to the backend-suggested pricing.quantity instead of the
// hardcoded "1" - unless the URL already pinned an explicit value. Then,
// regardless of where the value came from (query, localStorage-persisted
// booking form, or the seed above), bump it up to min_bookable_per_booking
// if it's still below that. Runs once, on load.
const guestsPinnedByQuery = Number(route.query.guests) > 0;
const quantityPinnedByQuery = Number(route.query.quantity) > 0;
let quantityInitializedFromPricing = false;

watch(
  () => pricing.value.quantity,
  (qty) => {
    if (quantityInitializedFromPricing || qty == null) return;

    quantityInitializedFromPricing = true;

    const hasGuestsField = fields.value.some((f) => f.field === "guests");
    const hasQuantityField = fields.value.some((f) => f.field === "quantity");

    if (hasGuestsField && !guestsPinnedByQuery) form.guests = qty;
    if (hasQuantityField && !quantityPinnedByQuery) form.quantity = qty;

    const min = minQuantity.value;

    if (hasGuestsField && form.guests < min) form.guests = min;
    if (hasQuantityField && form.quantity < min) form.quantity = min;
  },
);

// Mirrors fieldModel/handleFieldUpdate's bundling: which form key(s) each
// schema field actually owns. Used to build the check-available payload
// from only the fields this product's schema declares - `form` always has
// every possible key initialized (so every field component has somewhere
// to bind), but a product that doesn't render e.g. `pickup_time` shouldn't
// have it show up in the request either.
const FIELD_FORM_KEYS = {
  transfer_type: [
    "transfer_type",
    "pickup_location",
    "drop_location",
    "pickup_time",
  ],
  pickup_and_drop_location: ["pickup_location", "drop_location", "pickup_time"],
  pickup_and_drop_date: ["pickup_date", "pickup_time", "return_date"],
  derive_quantity: ["guests", "quantity"],
};

const fieldsPayload = () => {
  // The schema itself comes from the check-available response we're about
  // to request, so on the very first call after a fresh page load/refresh
  // `fields.value` is still empty (result.value hasn't arrived yet). If we
  // filtered to the schema in that case we'd send an empty payload and
  // silently drop things like date/guests. Fall back to sending everything
  // currently set on the form (minus blanks) so that first request still
  // reflects what the user/URL actually specified; once the real response
  // comes back, fields.value is populated and subsequent calls go back to
  // the precise, schema-filtered payload.
  if (!fields.value.length) {
    return Object.fromEntries(
      Object.entries(form).filter(([, value]) => value !== "" && value != null),
    );
  }

  const payload = {};

  for (const field of fields.value) {
    const keys = FIELD_FORM_KEYS[field.field] || [field.field];

    for (const key of keys) {
      if (key in form) {
        payload[key] = form[key];
      }
    }
  }

  return payload;
};

/**
 * API
 */

const checkAvailability = async () => {
  if (loading.value) return;

  loading.value = true;
  error.value = "";

  try {
    const payload = fieldsPayload();

    if (estimateId.value) {
      payload.estimate_id = estimateId.value;
    }

    if (form.selected_slot_token) {
      payload.selected_slot_token = form.selected_slot_token;
    }

    const { data } = await apiClient.post(
      `/v1/products/app/${productSlug}/check-available`,
      payload,
    );

    result.value = data;
    estimateId.value = data.data?.estimate_id || data.estimate_id || null;

    /**
     * Keep selected slot synced
     */

    if (data.data?.availability?.selected_slot) {
      form.selected_slot_token = data.data.availability.selected_slot.token;
    }
  } catch (e) {
    error.value =
      e.response?.data?.message || e.message || "Unable to check availability.";

    // Don't leave the previous successful response's availability/price/
    // Continue button on screen once a request fails - a stale
    // `result.value.available === true` would keep the footer and slot
    // selection rendered against data that's no longer confirmed valid.
    result.value = {
      ...(result.value ?? {}),
      available: false,
      message: error.value,
    };
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  checkAvailability();
});

/**
 * Auto refresh quotation
 */

let debounceTimer;

watch(
  form,
  () => {
    if (!result.value) return;

    clearTimeout(debounceTimer);

    debounceTimer = setTimeout(() => {
      checkAvailability();
    }, 300);
  },
  { deep: true },
);

const continueBooking = async () => {
  const { valid } = await bookingForm.value.validate();

  let hasError = !valid;

  if (isSlotPricing.value && !selectedSlot.value && !form.selected_slot_token) {
    slotError.value = `Please select a ${
      availability.value.slot_display_type || "slot"
    } to continue`;
    hasError = true;
  } else {
    slotError.value = "";
  }

  if (hasError) {
    topCard.value?.$el?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  router.push({
    name: "Checkout",
    params: { estimate_id: estimateId.value },
  });
};
</script>

<style scoped>
.slot-card {
  cursor: pointer;
  border: 1px solid #ececec;
  border-radius: 14px;
  padding: 14px 16px;
  transition: 0.2s;
}

.slot-card + .slot-card {
  margin-top: 10px;
}

.slot-card:hover {
  border-color: rgb(var(--v-theme-brandColor));
  transform: translateY(-1px);
}

.slot-card.active {
  border: 2px solid rgb(var(--v-theme-brandColor));
  background: rgba(var(--v-theme-brandColor), 0.05);
}

.slot-name {
  font-size: 15px;
  font-weight: 700;
}

.slot-time {
  font-size: 13px;
  color: #666;
  display: flex;
  align-items: center;
  gap: 4px;
}

.slot-price {
  font-size: 20px;
  font-weight: 700;
  color: rgb(var(--v-theme-brandColor));
}

.booking-footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  background: rgb(var(--v-theme-surface));
}

.booking-footer-content {
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>

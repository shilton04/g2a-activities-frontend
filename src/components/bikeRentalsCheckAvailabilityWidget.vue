<template>
  <div style="max-width: 1260px; margin: 0 auto">
    <!-- ❌ LOCATION NOT FOUND -->
    <v-card
      v-if="locationNotFound"
      elevation="0"
      class="border g2a-rounded-border bg-white pa-6"
    >
      <h2 class="g2a-text-22 g2a-text-bold-600 mb-2">
        Rentals not available for this location
      </h2>

      <p class="text-grey g2a-text-15">
        {{ resolvedLocationName || "Unknown Location" }}
      </p>

      <v-alert type="info" variant="tonal" class="mt-4">
        Please choose a different serviceable location.
      </v-alert>
    </v-card>

    <!-- ✅ NORMAL FLOW -->
    <v-row v-else>
      <v-col cols="12">
        <!-- Header -->
        <div class="pb-4">
          <v-chip
            class="g2a-text-bold-600 text-uppercase"
            size="small"
            color="brandColor"
          >
            {{ productInfo.label || "Loading..." }}
          </v-chip>

          <div class="g2a-text-28 my-1 g2a-text-bold-600">
            {{ productInfo.description || "" }}
            <span> - {{ selectedLocation?.name }}</span>
          </div>

          <div class="text-grey">
            <v-icon size="16">mdi-map-marker</v-icon>
            {{ selectedLocation?.name }}
          </div>
        </div>

        <v-card elevation="0" class="border g2a-rounded-border bg-white">
          <v-progress-linear color="brandColor" :model-value="33" :height="6" />

          <div class="d-flex justify-space-between px-4 mt-4">
            <span class="g2a-text-13 text-grey">Step 1 of 3</span>
            <span class="g2a-text-13 text-grey">Location & Dates</span>
          </div>

          <v-container>
            <!-- Dates -->
            <v-row class="my-2">
              <v-col cols="12" md="6">
                <div class="g2a-text-12 g2a-text-bold-600 text-grey mb-2">
                  PICKUP DATE
                </div>
                <v-text-field
                  v-model="pickupDate"
                  type="date"
                  variant="outlined"
                  :min="minDate"
                  :max="maxDate"
                  hide-details="auto"
                  :error="!!pickupDate && !isDateAllowed(pickupDate)"
                  :error-messages="
                    !!pickupDate && !isDateAllowed(pickupDate)
                      ? 'This date is not available'
                      : ''
                  "
                />
              </v-col>

              <v-col cols="12" md="6">
                <div class="g2a-text-12 g2a-text-bold-600 text-grey mb-2">
                  RETURN DATE
                </div>
                <v-text-field
                  v-model="returnDate"
                  type="date"
                  variant="outlined"
                  :min="pickupDate"
                  :max="maxDate"
                  hide-details="auto"
                  :error="!!returnDate && !isDateAllowed(returnDate)"
                  :error-messages="
                    !!returnDate && !isDateAllowed(returnDate)
                      ? 'This date is not available'
                      : ''
                  "
                />
              </v-col>
            </v-row>
          </v-container>

          <v-divider />

          <v-alert
            v-if="errorMessage"
            type="error"
            variant="tonal"
            class="mx-6 my-2"
          >
            {{ errorMessage }}
          </v-alert>

          <!-- Footer -->
          <div class="d-flex justify-end px-6 py-4">
            <v-btn
              color="brandColor"
              rounded="lg"
              size="large"
              :loading="loading"
              :disabled="!isValid"
              @click="continueNext"
            >
              Continue
              <v-icon end>mdi-arrow-right</v-icon>
            </v-btn>
          </div>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import apiClient from "@/services/api";
import moment from "moment";

/* ---------------- PROPS ---------------- */
const props = defineProps({
  location: { type: String, default: "Port Blair" },
  pickupDate: String,
  returnDate: String,
  quantity: { type: Number, default: 1 },
  apiBaseUrl: { type: String, default: import.meta.env.VITE_API_BASE_URL },
  onContinue: Function,
  baseUrl: { type: String, required: true },
});

/* ---------------- STATE ---------------- */
const productInfo = ref({});
const selectedLocation = ref(null);
const locationNotFound = ref(false);

// Initialize from props if provided, fallback to defaults
const pickupDate = ref(
  props.pickupDate || moment().add(2, "days").format("YYYY-MM-DD"),
);
const returnDate = ref(
  props.returnDate || moment().add(3, "days").format("YYYY-MM-DD"),
);
const quantity = ref(props.quantity);

const loading = ref(false);
const errorMessage = ref("");

/* ---------------- COMPUTED ---------------- */
const resolvedLocationName = computed(() => props.location);

const minDate = computed(() => moment().add(2, "days").format("YYYY-MM-DD"));
const maxDate = computed(() => moment().add(6, "months").format("YYYY-MM-DD"));

// Combined blackout dates from both location and product config
const blackoutDateSet = computed(() => {
  const locationDates = selectedLocation.value?.blackoutDates || [];
  const productDates = productInfo.value?.blackoutDates || [];
  return new Set([...locationDates, ...productDates]);
});

const isDateAllowed = (dateStr) => {
  return !blackoutDateSet.value.has(moment(dateStr).format("YYYY-MM-DD"));
};

const nextAllowedDate = (fromDate) => {
  let candidate = moment(fromDate);
  const limit = moment(maxDate.value);
  while (candidate.isSameOrBefore(limit)) {
    if (isDateAllowed(candidate.format("YYYY-MM-DD"))) {
      return candidate.format("YYYY-MM-DD");
    }
    candidate.add(1, "day");
  }
  return null;
};

// Reset return date if pickup date change makes it invalid
watch(pickupDate, (newPickup) => {
  if (!returnDate.value) return;

  // Case 1: return is now before or equal to pickup — logically invalid, safe to auto-advance
  if (moment(returnDate.value).isSameOrBefore(moment(newPickup))) {
    const candidate = nextAllowedDate(
      moment(newPickup).add(1, "day").format("YYYY-MM-DD"),
    );
    returnDate.value = candidate || "";
    returnDateError.value = "";
    return;
  }

  // Case 2: range now spans a blackout — clear and warn, don't silently pick for them
  const hasBlackout = rangeContainsBlackout(newPickup, returnDate.value);
  if (hasBlackout) {
    returnDate.value = "";
    returnDateError.value =
      "Your previous return date is no longer valid due to unavailable dates in the range. Please select a new return date.";
  }
});

const isValid = computed(() => {
  return (
    selectedLocation.value &&
    pickupDate.value &&
    returnDate.value &&
    isDateAllowed(pickupDate.value) &&
    isDateAllowed(returnDate.value) &&
    !loading.value
  );
});

/* ---------------- API ---------------- */
const fetchProductInfo = async () => {
  try {
    const { data } = await apiClient.get(
      `${props.apiBaseUrl}/bike-rentals/product-info`,
    );
    if (data?.success) productInfo.value = data.product;
  } catch {}
};

const fetchLocation = async () => {
  try {
    const { data } = await apiClient.get(
      `${props.apiBaseUrl}/bike-rentals/location/${encodeURIComponent(resolvedLocationName.value)}`,
    );

    if (data?.success && data.data) selectedLocation.value = data.data;
    else locationNotFound.value = true;
  } catch {
    locationNotFound.value = true;
  }
};

/* ---------------- CONTINUE ---------------- */
const continueNext = async () => {
  if (!isValid.value) return;

  loading.value = true;
  errorMessage.value = "";

  try {
    const payload = {
      locationName: selectedLocation.value.name,
      startDate: pickupDate.value,
      endDate: returnDate.value,
      quantity: quantity.value,
    };

    const { data } = await apiClient.post(
      `${props.apiBaseUrl}/bike-rentals/check-availability`,
      payload,
    );
    console.log("🚀 ~ continueNext ~ data:", data);

    if (!data?.success) {
      errorMessage.value = data?.message || "Not available for selected dates";
      return;
    }
    // trigger callback
    props.onContinue?.(payload);
  } catch (err) {
    errorMessage.value =
      err.response?.data?.message || "Availability check failed";
  } finally {
    loading.value = false;
  }
};

/* ---------------- MOUNT ---------------- */
onMounted(async () => {
  await fetchProductInfo();
  await fetchLocation();
});
</script>

<style scoped>
.active {
  border: 1px solid #006400;
  background: #f0f6f0;
}
</style>


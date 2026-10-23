<template>
  <v-card class="border" flat rounded="lg">
    <div class="pa-2 px-4">
      <div class="g2a-title-md" :class="field.description ? 'mb-1' : 'mb-3'">
        {{ field.label || "Transfer Details" }}
      </div>

      <div
        v-if="field.description"
        class="text-greyDark d-flex align-center mb-3"
      >
        <div>{{ field.description }}</div>
      </div>

      <!-- Transfer Direction -->
      <v-radio-group
        v-model="transferType"
        inline
        density="compact"
        hide-details
        class="mb-4"
      >
        <v-radio
          v-for="option in directionOptions"
          :key="option.value"
          :label="option.label"
          :value="option.value"
          class="mr-2"
        />
      </v-radio-group>

      <!-- Pickup Location (always on top, like a ride-hailing app) -->
      <template v-if="hasSubField('pickup_location')">
        <v-text-field
          v-if="airportSideKey === 'pickup_location'"
          :model-value="airportLocation?.name || 'Loading airport...'"
          :label="subFieldLabel('pickup_location', 'Pickup Location')"
          variant="outlined"
          density="compact"
          rounded="lg"
          hide-details="auto"
          prepend-inner-icon="mdi-airplane"
          class="mb-4"
          readonly
          disabled
        />

        <location-picker
          v-else
          :model-value="locationById(modelValue.pickup_location)"
          :locations="pickableLocations"
          :loading="loadingLocations"
          :label="subFieldLabel('pickup_location', 'Pickup Location')"
          :location-slug="locationSlug"
          :rules="pickupLocationRules"
          class="mb-4"
          @update:model-value="updateSubField('pickup_location', $event)"
        />
      </template>

      <!-- Drop Location (always below pickup) -->
      <template v-if="hasSubField('drop_location')">
        <v-text-field
          v-if="airportSideKey === 'drop_location'"
          :model-value="airportLocation?.name || 'Loading airport...'"
          :label="subFieldLabel('drop_location', 'Drop Location')"
          variant="outlined"
          density="compact"
          rounded="lg"
          hide-details="auto"
          prepend-inner-icon="mdi-airplane"
          class="mb-4"
          readonly
          disabled
        />

        <location-picker
          v-else
          :model-value="locationById(modelValue.drop_location)"
          :locations="pickableLocations"
          :loading="loadingLocations"
          :label="subFieldLabel('drop_location', 'Drop Location')"
          :location-slug="locationSlug"
          :rules="dropLocationRules"
          class="mb-4"
          @update:model-value="updateSubField('drop_location', $event)"
        />
      </template>

      <!-- Pickup Time -->
      <template v-if="hasSubField('pickup_time')">
        <v-text-field
          :model-value="pickupTimeLabel"
          :label="subFieldLabel('pickup_time', 'Pickup Time')"
          placeholder="Select pickup time"
          variant="outlined"
          density="compact"
          rounded="lg"
          prepend-inner-icon="mdi-clock-outline"
          :rules="pickupTimeRules"
          hide-details="auto"
          readonly
          @click="pickupTimeDialog = true"
        />

        <v-dialog
          v-model="pickupTimeDialog"
          max-width="500"
          scrim="rgba(15,23,42,.30)"
          :style="{
            backdropFilter: 'blur(5px)',
            webkitBackdropFilter: 'blur(5px)',
          }"
        >
          <v-card rounded="lg" flat>
            <v-toolbar density="comfortable" color="transparent">
              <v-toolbar-title>Select Pickup Time</v-toolbar-title>

              <v-spacer />

              <v-btn icon variant="text" @click="pickupTimeDialog = false">
                <v-icon>mdi-close</v-icon>
              </v-btn>
            </v-toolbar>

            <v-divider />

            <v-card-text
              :style="{
                maxHeight: mobile ? '100%' : '360px',
                overflowY: 'auto',
              }"
            >
              <v-row v-if="pickupTimeOptions.length" dense>
                <v-col
                  v-for="option in pickupTimeOptions"
                  :key="option.value"
                  md="3"
                  sm="4"
                >
                  <v-chip
                    rounded="lg"
                    :color="
                      modelValue.pickup_time === option.value
                        ? 'primary'
                        : undefined
                    "
                    :variant="
                      modelValue.pickup_time === option.value
                        ? 'flat'
                        : 'outlined'
                    "
                    :disabled="option.disabled"
                    label
                    class="w-100 justify-center"
                    @click="selectPickupTime(option.value)"
                  >
                    {{ option.title }}
                  </v-chip>
                </v-col>
              </v-row>

              <div v-else class="text-medium-emphasis text-body-2 pa-2">
                No pickup slots are available for the selected service hours.
              </div>
            </v-card-text>
          </v-card>
        </v-dialog>
      </template>

      <div class="mt-5 text-warning">
        Within city limit INR 450, outside city limits starts from INR 800.
      </div>
    </div>
  </v-card>
</template>

<script setup>
import { toLocalYMD } from "@/utils/date";
import { ref, computed, watch, onMounted } from "vue";
import { useDisplay } from "vuetify";
import apiClient from "@/services/api";
import LocationPicker from "../LocationPicker.vue";

const { mobile } = useDisplay();

const DEFAULT_DIRECTION_OPTIONS = [
  { label: "Airport → Location", value: "airport_to_location" },
  { label: "Location → Airport", value: "location_to_airport" },
];

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({
      transfer_type: "",
      pickup_location: null,
      drop_location: null,
      pickup_time: "",
    }),
  },
  field: {
    type: Object,
    required: true,
  },
  form: {
    type: Object,
    default: () => ({}),
  },
  serviceHours: {
    type: Array,
    default: () => [],
  },
  productSlug: {
    type: String,
    default: "",
  },
  locationSlug: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["update:modelValue"]);

const directionOptions = computed(() => {
  return props.field.config?.options?.length
    ? props.field.config.options
    : DEFAULT_DIRECTION_OPTIONS;
});

const subFields = computed(() => props.field.config?.fields || []);

const hasSubField = (key) => {
  // If the backend didn't send a config.fields list at all, fall back to
  // showing all three so the field still works.
  if (!subFields.value.length) return true;

  return subFields.value.some((subField) => subField.field === key);
};

const subFieldLabel = (key, fallback) => {
  const match = subFields.value.find((subField) => subField.field === key);

  return match?.label || fallback;
};

const isSubFieldRequired = (key) => {
  const match = subFields.value.find((subField) => subField.field === key);

  return !!match?.required;
};

// Self-contained validation - which location is required flips with the
// selected direction: the airport side is always auto-filled (and
// disabled), so only the side the user actually has to pick themselves
// carries a rule. Airport → Location needs a drop location; Location →
// Airport needs a pickup location.
const pickupLocationRules = computed(() => {
  if (!hasSubField("pickup_location")) return [];
  if (airportSideKey.value === "pickup_location") return [];

  return [(v) => !!v || "Please select a pickup location"];
});

const dropLocationRules = computed(() => {
  if (!hasSubField("drop_location")) return [];
  if (airportSideKey.value === "drop_location") return [];

  return [(v) => !!v || "Please select a drop location"];
});

const pickupTimeRules = computed(() => {
  if (!isSubFieldRequired("pickup_time")) return [];

  return [(v) => !!v || "Please select a pickup time"];
});

const transferType = ref(
  props.modelValue.transfer_type || directionOptions.value[0]?.value || "",
);

const availableLocations = ref([]);
const loadingLocations = ref(false);

const airportLocation = computed(() => {
  return (
    availableLocations.value.find((loc) =>
      (loc.place_types || []).includes("airport"),
    ) || null
  );
});

const airportSideKey = computed(() => {
  return transferType.value === "airport_to_location"
    ? "pickup_location"
    : "drop_location";
});

// A user picking their own location shouldn't be offered the airport
// itself as an option there.
const pickableLocations = computed(() => {
  return availableLocations.value.filter(
    (loc) => !(loc.place_types || []).includes("airport"),
  );
});

// Configured locations are stored as ids. A customer-entered location is
// kept as its small custom-location object so it can be sent to the API.
const locationById = (location) => {
  if (!location) return null;

  if (typeof location === "object") return location;

  return availableLocations.value.find((loc) => loc.id === location) || null;
};

// Single watcher covering both triggers that affect the airport side:
// the airport location finishing its fetch, and the direction being
// flipped. Consolidated into one emit so the two concerns can't race
// each other and clobber one another's update.
watch(
  [transferType, airportLocation],
  ([newType], oldValues) => {
    const [oldType] = oldValues || [];
    const patch = { transfer_type: newType };

    const newAirportKey =
      newType === "airport_to_location" ? "pickup_location" : "drop_location";

    if (airportLocation.value) {
      patch[newAirportKey] = airportLocation.value.id;
    }

    // Direction flipped - the side that used to hold the airport now
    // needs a real, deliberate pick from the user instead of stale data.
    if (oldType && oldType !== newType) {
      const oldAirportKey =
        oldType === "airport_to_location" ? "pickup_location" : "drop_location";

      patch[oldAirportKey] = null;
    }

    emit("update:modelValue", {
      ...props.modelValue,
      ...patch,
    });
  },
  { immediate: true },
);

const updateSubField = (key, value) => {
  const isLocationField = key === "pickup_location" || key === "drop_location";
  const locationValue = value?.is_custom
    ? {
        type: "custom",
        name: value.name,
        address: value.address,
        // lat/lng/signature come from a Google Places search result and are
        // required together for KM_BASED (distance-tier) pricing and for the
        // backend to verify the location. A manually typed location (no map
        // pick) won't have these — omit rather than send null so the backend
        // schema doesn't reject a partial submission.
        ...(value.lat != null && value.lng != null && value.signature
          ? { lat: value.lat, lng: value.lng, signature: value.signature }
          : {}),
        ...(value.place_types ? { place_types: value.place_types } : {}),
      }
    : (value?.id ?? null);

  emit("update:modelValue", {
    ...props.modelValue,
    transfer_type: transferType.value,
    [key]: isLocationField ? locationValue : value,
  });
};

const fetchLocations = async () => {
  if (!props.productSlug || !props.locationSlug) return;

  loadingLocations.value = true;

  try {
    const { data } = await apiClient.get(
      `/v1/products/app/${props.productSlug}/available-locations`,
      {
        params: {
          location_slug: props.locationSlug,
        },
      },
    );

    availableLocations.value = data.data || [];
  } catch (err) {
    console.error("Failed to load airport transfer locations", err);
    availableLocations.value = [];
  } finally {
    loadingLocations.value = false;
  }
};

onMounted(fetchLocations);

// ---------------------------------------------------------------------
// Pickup time slot generation
//
// `serviceHours` is an array of `{ start_time, end_time }` windows (both
// "HH:mm" or "HH:mm:ss" strings) - a product can have more than one
// service window per day (e.g. a morning and an evening shift). Slots are
// generated per window at a fixed 30-minute cadence, merged, deduped and
// sorted. This also supports overnight windows (e.g. start 22:00, end
// 06:00) and rounds ragged boundary times like "22:29:00" down/up to the
// nearest valid slot. With no windows configured, the whole day is used.
// ---------------------------------------------------------------------

const SLOT_INTERVAL_MINUTES = 30;
const MINUTES_IN_DAY = 24 * 60;

const parseTimeToMinutes = (value, fallback) => {
  if (!value || typeof value !== "string") return fallback;

  const [hoursStr, minutesStr] = value.split(":");
  const hours = Number(hoursStr);
  const minutes = Number(minutesStr);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return fallback;

  return hours * 60 + minutes;
};

const formatMinutesToHHmm = (totalMinutes) => {
  const normalized =
    ((totalMinutes % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

const formatMinutesToLabel = (totalMinutes) => {
  const normalized =
    ((totalMinutes % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  const hours24 = Math.floor(normalized / 60);
  const minutes = normalized % 60;

  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;

  return `${String(hours12).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${period}`;
};

// Rounds each configured window's start up, and end down, to the nearest
// slot boundary so every generated option is bookable and none of them
// spill outside the service window. If a window's end <= start, it's
// treated as spanning midnight (e.g. 22:00 -> 06:00). No windows at all
// falls back to the full day, matching the old single-object default.
const serviceWindows = computed(() => {
  const windows = Array.isArray(props.serviceHours) ? props.serviceHours : [];

  if (!windows.length) {
    return [{ start: 0, end: MINUTES_IN_DAY }];
  }

  return windows.map((window) => {
    const rawStart = parseTimeToMinutes(window?.start_time, 0);
    const rawEnd = parseTimeToMinutes(window?.end_time, MINUTES_IN_DAY);

    const start =
      Math.ceil(rawStart / SLOT_INTERVAL_MINUTES) * SLOT_INTERVAL_MINUTES;

    let end = Math.ceil(rawEnd / SLOT_INTERVAL_MINUTES) * SLOT_INTERVAL_MINUTES;

    if (end <= start) {
      end += MINUTES_IN_DAY;
    }

    return { start, end };
  });
});

// `value` stays in 24-hour HH:mm form - that's what the backend's
// pickup_time validation expects. `title` is just the display label.
// Generated fresh whenever serviceHours changes, one pass per window,
// then deduped and sorted so overlapping windows don't produce repeats.
const PICKUP_TIME_SLOTS = computed(() => {
  const seen = new Set();
  const slots = [];

  for (const { start, end } of serviceWindows.value) {
    for (
      let minutes = start;
      minutes <= end;
      minutes += SLOT_INTERVAL_MINUTES
    ) {
      const value = formatMinutesToHHmm(minutes);

      if (seen.has(value)) continue;
      seen.add(value);

      slots.push({
        title: formatMinutesToLabel(minutes),
        value,
      });
    }
  }

  return slots.sort((a, b) => a.value.localeCompare(b.value));
});

const toMinutes = (hhmm) => {
  const [hours, minutes] = hhmm.split(":").map(Number);

  return hours * 60 + minutes;
};

// Pickup time only needs to be restricted when the selected date (from
// DateField, via the shared `form`) is today - any future date is
const minAllowedMinutes = computed(() => {
  const today = toLocalYMD();

  if (props.form.date !== today) return null;

  const now = new Date();

  // 12 hours = 720 minutes
  return now.getHours() * 60 + now.getMinutes() + 720;
});

const pickupTimeOptions = computed(() => {
  const minMinutes = minAllowedMinutes.value;

  return PICKUP_TIME_SLOTS.value.map((slot) => ({
    ...slot,
    disabled: minMinutes !== null && toMinutes(slot.value) < minMinutes,
  }));
});

const pickupTimeDialog = ref(false);

const pickupTimeLabel = computed(() => {
  const match = pickupTimeOptions.value.find(
    (option) => option.value === props.modelValue.pickup_time,
  );

  return match?.title || "";
});

const selectPickupTime = (value) => {
  updateSubField("pickup_time", value);

  pickupTimeDialog.value = false;
};

// If the date changes (or time passes) and the currently selected pickup
// time falls before the new cutoff, it's no longer a valid choice - drop
// it instead of silently keeping a disabled option selected.
watch(pickupTimeOptions, (options) => {
  const current = props.modelValue.pickup_time;

  if (!current) return;

  const option = options.find((item) => item.value === current);

  if (option?.disabled) {
    updateSubField("pickup_time", "");
  }
});
</script>

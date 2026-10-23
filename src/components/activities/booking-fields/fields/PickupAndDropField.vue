<template>
  <v-card class="border" flat rounded="lg">
    <v-container>
      <div
        v-if="field.description"
        class="text-greyDark d-flex align-center mb-3"
      >
        <div>{{ field.description }}</div>
      </div>

      <v-row>
        <v-col cols="12" md="6">
          <v-text-field
            v-model="pickupDate"
            type="date"
            label="Pickup Date"
            :min="todayString"
            :error-messages="error ? [error] : []"
            variant="outlined"
            density="compact"
            hide-details="auto"
            rounded="lg"
          />
        </v-col>

        <v-col cols="12" md="6">
          <v-select
            v-model="pickupTime"
            :items="pickupTimeOptions"
            item-title="title"
            item-value="value"
            label="Pickup Time"
            variant="outlined"
            density="compact"
            hide-details="auto"
            rounded="lg"
          />
        </v-col>

        <v-col cols="12" md="6">
          <v-text-field
            v-model="returnDate"
            type="date"
            label="Drop Date"
            :min="minimumReturnDate"
            :error-messages="error ? [error] : []"
            variant="outlined"
            density="compact"
            hide-details="auto"
            rounded="lg"
          />
        </v-col>

        <v-col cols="12" md="6">
          <v-select
            v-model="pickupTime"
            :items="pickupTimeOptions"
            item-title="title"
            item-value="value"
            label="Drop Time"
            variant="outlined"
            density="compact"
            hide-details="auto"
            rounded="lg"
            readonly
            disabled
          />
        </v-col>
      </v-row>

      <v-card flat class="border mt-4" rounded="lg">
        <v-container class="text-warning my-auto d-flex align-center">
          <v-icon class="mr-2">mdi-information</v-icon> Drop time is
          automatically set to 24 hours after pickup time. You can contact us if
          you need a different drop time.
        </v-container>
      </v-card>
    </v-container>
  </v-card>
</template>

<script setup>
import { toLocalYMD, parseYMD } from "@/utils/date";
import { computed, ref, watch } from "vue";

const props = defineProps({
  form: {
    type: Object,
    required: true,
  },

  field: {
    type: Object,
    default: () => ({}),
  },

  error: {
    type: String,
    default: "",
  },

  // From the check-available API's `availability.min_booking_lead_hours` -
  // the pickup time must be at least this many hours ahead of now.
  minBookingLeadHours: {
    type: Number,
    default: 0,
  },

  // From the check-available API's `availability.service_hours` - an array
  // of `{ start_time, end_time }` windows used to generate the pickup time
  // slots below (see Pickuptimefield.vue / PickupAndDropLocationField.vue,
  // which use the same generator).
  serviceHours: {
    type: Array,
    default: () => [],
  },
});

const todayDate = new Date();

// Only past dates are actually barred - same-day/lead-time rules are the
// backend's job (it already reports them back via check-available), so the
// picker itself shouldn't pre-emptively rule out today.
const todayString = toLocalYMD(todayDate);

const tomorrow = new Date(todayDate);
tomorrow.setDate(tomorrow.getDate() + 1);

const tomorrowString = toLocalYMD(tomorrow);

const dayAfterTomorrow = new Date(todayDate);
dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

const dayAfterTomorrowString = toLocalYMD(dayAfterTomorrow);

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
// (Same generator as Pickuptimefield.vue / PickupAndDropLocationField.vue.)
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

const slotDateTime = (dateStr, hhmm) => {
  if (!dateStr) return null;

  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes] = hhmm.split(":").map(Number);

  return new Date(year, month - 1, day, hours, minutes, 0, 0);
};

const formatDateToYMD = toLocalYMD;

const MAX_LOOKAHEAD_DAYS = 90;

// Finds the earliest pickup date/time - starting from tomorrow, since bike
// rentals can't be booked same-day (matches the server-side rule in
// dateRange.service.js) - whose date-time clears `now + minLeadHours`.
// Walks the fixed daily slot schedule day by day so a lead time that spans
// more than one day (e.g. 60h) correctly lands on a later date rather than
// just the first disabled day.
const computeNextAvailableSlot = (minLeadHours) => {
  const cutoff = new Date();

  cutoff.setMinutes(
    cutoff.getMinutes() + (Number(minLeadHours) || 0) * 60,
  );

  for (
    let dayOffset = 1;
    dayOffset <= MAX_LOOKAHEAD_DAYS;
    dayOffset += 1
  ) {
    const candidate = new Date(todayDate);
    candidate.setDate(candidate.getDate() + dayOffset);

    const dateStr = formatDateToYMD(candidate);

    const firstSlot = PICKUP_TIME_SLOTS.value.find(
      (slot) => slotDateTime(dateStr, slot.value) >= cutoff,
    );

    if (firstSlot) {
      return { date: dateStr, time: firstSlot.value };
    }
  }

  // Shouldn't happen with any realistic lead time - avoid leaving the
  // form without a value if it does.
  return {
    date: tomorrowString,
    time: PICKUP_TIME_SLOTS.value[0]?.value ?? "00:00",
  };
};

// All slots are always selectable - lead-time/availability rules are
// enforced by the backend (via check-available), not pre-emptively here.
const pickupTimeOptions = PICKUP_TIME_SLOTS;

// Tracks whether the pickup date/time reflects a deliberate choice - either
// a booking resumed with values already in `form`, or the customer editing
// the fields themselves - as opposed to still holding our own best-guess
// auto-selection. Only auto-selection keeps recomputing as the real lead
// hours arrive from the check-available API; once this flips true it stops
// touching these fields.
//
// Keyed off `pickup_time` rather than `pickup_date`: ProductBooking.vue
// always pre-fills `form.pickup_date` with its own "tomorrow" placeholder
// (and keeps it synced to the URL) before this component even mounts, so
// checking that would treat every fresh page load as already decided.
// `pickup_time` has no such placeholder - it's only ever non-empty for a
// genuinely restored/shared booking - so it's the reliable "already
// decided" signal.
const hasUserSetPickup = ref(!!props.form.pickup_time);

// Set around our own programmatic writes to pickupDate/pickupTime so their
// setters below don't mistake an auto-selection for user input.
let isAutoSetting = false;

const pickupDate = computed({
  get() {
    return props.form.pickup_date || tomorrowString;
  },
  set(value) {
    if (!isAutoSetting) hasUserSetPickup.value = true;

    props.form.pickup_date = value;
  },
});

const pickupTime = computed({
  get() {
    // Falls back to the first slot rather than "" - pickup_time must
    // never sit blank, since the check-available API rejects an empty
    // value outright (a 400, not a normal "unavailable" result), and
    // slots are no longer disabled client-side to justify clearing it.
    return props.form.pickup_time || PICKUP_TIME_SLOTS.value[0]?.value || "";
  },
  set(value) {
    if (!isAutoSetting) hasUserSetPickup.value = true;

    props.form.pickup_time = value;
  },
});

const returnDate = computed({
  get() {
    return props.form.return_date || dayAfterTomorrowString;
  },
  set(value) {
    props.form.return_date = value;
  },
});

const minimumReturnDate = computed(() => {
  return pickupDate.value || tomorrowString;
});

watch(
  pickupDate,
  (newPickup) => {
    const pickup = parseYMD(newPickup);
    const drop = parseYMD(returnDate.value);

    if (drop <= pickup) {
      pickup.setDate(pickup.getDate() + 1);
      props.form.return_date = toLocalYMD(pickup);
    }
  },
  {
    immediate: true,
  },
);

watch(
  () => props.form,
  () => {
    if (!props.form.return_date) {
      props.form.return_date = dayAfterTomorrowString;
    }
  },
  {
    immediate: true,
    deep: true,
  },
);

// Auto-select the next available pickup date/time once real lead-hours
// data is known, instead of always guessing "tomorrow at 10am". Runs
// immediately at mount with whatever `minBookingLeadHours` starts as
// (usually 0, before the first check-available response lands), then
// re-runs and corrects the selection when the real value arrives -
// `hasUserSetPickup` is what stops it from then fighting a restored
// booking or the customer's own edit.
watch(
  () => props.minBookingLeadHours,
  () => {
    if (hasUserSetPickup.value) return;

    const { date, time } = computeNextAvailableSlot(
      props.minBookingLeadHours,
    );

    isAutoSetting = true;
    pickupDate.value = date;
    pickupTime.value = time;
    isAutoSetting = false;
  },
  { immediate: true },
);
</script>

<style scoped>
/* Native date inputs shrink to fit their text, so the browser's
   calendar icon ends up right after the value instead of at the far
   right of the field - force it to fill the input so the icon lands
   at the field's right edge. */
:deep(input[type="date"]) {
  width: 100%;
}
</style>

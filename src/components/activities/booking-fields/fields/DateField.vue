<template>
  <div>
    <div class="g2a-title-lg" :class="field.description ? 'mb-1' : 'mb-3'">
      {{ field.label || "Select Date" }}
    </div>

    <div
      v-if="field.description"
      class="text-greyDark d-flex align-center mb-3"
    >
      <div>{{ field.description }}</div>
    </div>

    <div class="date-strip-wrapper">
      <v-btn
        v-if="!mobile"
        icon
        variant="elevated"
        size="36"
        class="scroll-arrow scroll-arrow-left"
        @click="scrollByPage(-1)"
      >
        <v-icon>mdi-chevron-left</v-icon>
      </v-btn>

      <div ref="stripRef" class="date-strip">
        <template v-for="date in dates" :key="date.value">
          <div v-if="date.showMonth" class="month-card py-2">
            <span>{{ date.month }}</span>
          </div>

          <v-card
            :ref="(el) => setCardRef(el, date.value)"
            class="date-card py-4"
            :class="[
              `status-${dateStatus(date.value)}`,
              { active: modelValue === date.value },
            ]"
            elevation="0"
            @click="select(date.value)"
          >
            <div class="date-number">
              {{ String(date.date).padStart(2, "0") }}
            </div>

            <div class="date-day">
              {{ date.day }}
            </div>

            <span
              v-if="dateStatus(date.value) !== 'unknown'"
              class="date-dot"
            />
          </v-card>
        </template>
      </div>

      <v-btn
        v-if="!mobile"
        icon
        variant="elevated"
        size="36"
        class="scroll-arrow scroll-arrow-right"
        @click="scrollByPage(1)"
      >
        <v-icon>mdi-chevron-right</v-icon>
      </v-btn>
    </div>

    <div v-if="selectedDateLabel" class="text-body-2 mt-2">
      Selected date: <strong>{{ selectedDateLabel }}</strong>
      <span v-if="!available && nextAvailableDateLabel">
        , Next available date: {{ nextAvailableDateLabel }}
      </span>
    </div>

    <div v-if="error" class="text-error text-caption mt-2">
      {{ error }}
    </div>
  </div>
</template>

<script setup>
import { toLocalYMD, parseYMD } from "@/utils/date";
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";
import { useDisplay } from "vuetify";
import apiClient from "@/services/api";

const { mobile } = useDisplay();

const props = defineProps({
  modelValue: String,

  field: {
    type: Object,
    required: true,
  },

  error: {
    type: String,
    default: "",
  },

  nextAvailableDate: {
    type: String,
    default: "",
  },
  available: {
    type: Boolean,
    default: true,
  },

  form: {
    type: Object,
    default: () => ({}),
  },
  productSlug: {
    type: String,
    default: "",
  },
  locationSlug: {
    type: String,
    default: "",
  },

  // How many days ahead to show in the strip, from the backend's
  // booking_window_days (inventory window vs. furthest manual schedule,
  // whichever is greater) - always floored at 60 below.
  bookingWindowDays: {
    type: Number,
    default: 60,
  },
});
const emit = defineEmits(["update:modelValue"]);

const today = toLocalYMD();

const stripRef = ref(null);
const cardRefs = new Map();

const scrollByPage = (direction) => {
  const strip = stripRef.value;
  if (!strip) return;

  strip.scrollBy({
    left: direction * strip.offsetWidth * 0.8,
    behavior: "smooth",
  });
};

// Never show fewer than 60 days, even if the backend reports a smaller
// (or zero) booking window - vendor products can carry manually-created
// schedules further out than their configured inventory window covers.
const bookingDays = computed(() =>
  Math.max(Number(props.bookingWindowDays) || 0, 60),
);

// date (ISO string) -> true | false | "unknown", from the calendar API.
// A date with no entry yet (not fetched, or still loading) renders the
// same as "unknown" - neutral, not treated as unavailable.
const calendarStatus = reactive(new Map());

const CALENDAR_MAX_PAGE = 8;

const calendarSlug = computed(() => {
  if (!props.productSlug || !props.locationSlug) return "";
  return `${props.productSlug}-in-${props.locationSlug}`;
});

const dateStatus = (value) => {
  if (!calendarStatus.has(value)) return "unknown";

  const status = calendarStatus.get(value);
  if (status === true) return "available";
  if (status === false) return "unavailable";
  return "unknown";
};

const isDateUnavailable = (value) => calendarStatus.get(value) === false;

const fetchCalendarAvailability = async () => {
  if (!calendarSlug.value) return;

  calendarStatus.clear();

  const neededThrough = new Date();
  neededThrough.setDate(neededThrough.getDate() + bookingDays.value - 1);

  try {
    // The calendar endpoint pages in fixed ~3-month chunks, so a booking
    // window beyond the first page needs follow-up pages fetched until
    // they cover it (or the backend's own page cap is hit).
    for (let page = 1; page <= CALENDAR_MAX_PAGE; page++) {
      const { data } = await apiClient.get(
        `/v1/products/app/${calendarSlug.value}/calendar`,
        {
          params: {
            page,
            guests: props.form?.guests || undefined,
            quantity: props.form?.quantity || undefined,
          },
        },
      );

      for (const d of data.dates || []) {
        calendarStatus.set(d.date, d.available);
      }

      if (!data.to_date || new Date(data.to_date) >= neededThrough) break;
    }
  } catch (err) {
    console.error("Failed to load product calendar", err);
  }
};

watch(calendarSlug, () => fetchCalendarAvailability(), { immediate: true });

watch(
  () => [props.form?.guests, props.form?.quantity, bookingDays.value],
  () => fetchCalendarAvailability(),
);

const setCardRef = (el, value) => {
  if (el) {
    cardRefs.set(value, el.$el || el);
  } else {
    cardRefs.delete(value);
  }
};

const scrollToSelected = (behavior = "smooth") => {
  const card = props.modelValue && cardRefs.get(props.modelValue);
  if (!card || !stripRef.value) return;

  const strip = stripRef.value;
  const left = card.offsetLeft - strip.offsetWidth / 2 + card.offsetWidth / 2;

  strip.scrollTo({ left, behavior });
};

onMounted(() => {
  if (!props.modelValue) {
    emit("update:modelValue", today);
  }

  nextTick(() => scrollToSelected("auto"));
});

watch(
  () => props.modelValue,
  () => nextTick(() => scrollToSelected("smooth")),
);

const dates = computed(() => {
  const items = [];
  let lastMonth = "";

  for (let i = 0; i < bookingDays.value; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);

    const month = d
      .toLocaleDateString("en-IN", {
        month: "short",
      })
      .toUpperCase();

    items.push({
      value: toLocalYMD(d),
      day: d.toLocaleDateString("en-IN", {
        weekday: "short",
      }),
      date: d.getDate(),
      month,
      showMonth: month !== lastMonth,
    });

    lastMonth = month;
  }

  return items;
});

const select = (value) => {
  if (isDateUnavailable(value)) return;

  emit("update:modelValue", value);
};

const selectedDateLabel = computed(() => {
  if (!props.modelValue) return "";

  return parseYMD(props.modelValue).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
});

const nextAvailableDateLabel = computed(() => {
  if (!props.nextAvailableDate) return "";

  return parseYMD(props.nextAvailableDate).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
});
</script>

<style scoped>
/* Strip + scroll arrows */

.date-strip-wrapper {
  position: relative;
}

.date-strip {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding: 5px;
  scrollbar-width: none;
}

.date-strip::-webkit-scrollbar {
  display: none;
}

.scroll-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 2;
  background: white !important;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
}

.scroll-arrow-left {
  left: -18px;
}

.scroll-arrow-right {
  right: -18px;
}

/* Month */

.month-card {
  width: 42px;
  min-width: 42px;
  border: 1px solid #ececec;
  border-radius: 18px;
  background: #f7f7f7;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.month-card span {
  transform: rotate(-90deg);
  font-weight: 700;
  letter-spacing: 2px;
  color: #4b5563;
}

/* Date */

.date-card {
  width: 54px;
  min-width: 54px;

  border-radius: 18px !important;
  border: 1px solid #e6e6e6;

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  cursor: pointer;
  flex-shrink: 0;

  transition: 0.25s;
}

.date-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.08);
}

.date-number {
  color: #111827;
}

.date-day {
  font-weight: 500;
  color: #374151;
}

/* Active */

.date-card.active {
  background: #0f1b3d !important;
  border-color: #0f1b3d !important;
}

.date-card.active .date-number,
.date-card.active .date-day {
  color: white;
}

/* Availability status */

.date-card.status-unavailable {
  opacity: 0.45;
  cursor: not-allowed;
}

.date-card.status-unavailable:hover {
  transform: none;
  box-shadow: none;
}

.date-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  margin-top: 4px;
}

.date-card.status-available .date-dot {
  background: #22c55e;
}

.date-card.status-unavailable .date-dot {
  background: #b0b0b0;
}

.date-card.active .date-dot {
  background: white;
}
</style>

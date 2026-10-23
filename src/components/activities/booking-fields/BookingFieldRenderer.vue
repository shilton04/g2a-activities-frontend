<template>
  <component
    v-if="fieldComponent"
    :is="fieldComponent"
    :model-value="modelValue"
    :field="field"
    :slots="slots"
    :form="form"
    :serviceHours="serviceHours"
    :minBookingLeadHours="minBookingLeadHours"
    :error="error"
    :maxQuantity="maxQuantity"
    :minQuantity="minQuantity"
    :locationSlug="locationSlug"
    :productSlug="productSlug"
    :productTypeSlug="productTypeSlug"
    :pricing="pricing"
    :nextAvailableDate="nextAvailableDate"
    :available="available"
    @update:modelValue="updateValue"
  />

  <v-alert v-else type="warning" variant="tonal" density="compact">
    Unknown booking field:
    <strong>{{ field.field }}</strong>
  </v-alert>
</template>

<script setup>
import { computed } from "vue";

import fieldRegistry from "./fieldRegistry";

const props = defineProps({
  field: {
    type: Object,
    required: true,
  },

  modelValue: {
    required: true,
  },

  slots: {
    type: Array,
    default: () => [],
  },

  form: {
    type: Object,
    default: () => ({}),
  },

  serviceHours: {
    type: Array,
    default: () => [],
  },

  error: {
    type: String,
    default: "",
  },
  maxQuantity: {
    type: Number,
    default: 10,
  },

  minQuantity: {
    type: Number,
    default: 1,
  },

  locationSlug: {
    type: String,
    default: "",
  },
  productSlug: {
    type: String,
    default: "",
  },
  productTypeSlug: {
    type: String,
    default: "",
  },

  // KM_BASED products need distance_km / duration_minutes / unit_price
  // from the latest availability check to show a live distance/price hint.
  pricing: {
    type: Object,
    default: () => ({}),
  },

  nextAvailableDate: {
    type: String,
    default: "",
  },
  available: {
    type: Boolean,
    default: true,
  },
});

const emit = defineEmits(["update:modelValue"]);

const fieldComponent = computed(() => {
  return fieldRegistry[props.field.field];
});

const updateValue = (value) => {
  emit("update:modelValue", value);
};
</script>

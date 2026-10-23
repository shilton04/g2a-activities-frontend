<template>
  <v-text-field
    v-model="model"
    type="date"
    label="Return Date"
    :min="minimumDate"
    variant="outlined"
    density="compact"
    hide-details="auto"
    :rules="rules"
    :hint="field.description || undefined"
    :persistent-hint="!!field.description"
  />
</template>

<script setup>
import { toLocalYMD } from "@/utils/date";
import { computed } from "vue";

const props = defineProps({
  modelValue: String,

  form: {
    type: Object,
    required: true,
  },

  field: {
    type: Object,
    default: () => ({}),
  },
});

const emit = defineEmits(["update:modelValue"]);

const today = toLocalYMD();

const minimumDate = computed(() => {
  return props.form.pickup_date || today;
});

const model = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});

const rules = computed(() => {
  if (!props.field?.required) return [];

  return [(v) => !!v || "Return date is required"];
});
</script>

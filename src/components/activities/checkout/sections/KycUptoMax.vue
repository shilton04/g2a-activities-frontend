<template>
  <v-card ref="rootEl" rounded="lg" class="border" flat>
    <v-container class="py-4">
      <div class="g2a-title-xl">
        {{ config.title || "KYC Details" }}
      </div>

      <div class="mt-1">
        {{
          config.description ||
          "Please provide a valid ID proof for every participant."
        }}
      </div>
    </v-container>

    <v-divider />

    <div>
      <div v-for="(kyc, index) in kycEntries" :key="index">
        <v-container>
          <div class="my-2 g2a-title-md">Participant {{ index + 1 }}</div>
          <v-row>
            <!-- Nationality -->
            <v-col cols="12" md="6">
              <v-select
                v-model="kyc.nationality"
                :items="nationalities"
                label="Select Nationality"
                density="compact"
                variant="outlined"
                rounded="lg"
                hide-details="auto"
                :rules="[(v) => !!v || 'Nationality is required']"
                @update:model-value="onNationalityChange(kyc)"
              />
            </v-col>

            <!-- ID Proof Type -->
            <v-col cols="12" md="6">
              <v-select
                v-model="kyc.id_proof_type"
                :items="getIdProofOptions(kyc.nationality)"
                label="Select ID Proof"
                density="compact"
                variant="outlined"
                rounded="lg"
                hide-details="auto"
                :disabled="!kyc.nationality"
                :rules="[(v) => !!v || 'ID Proof is required']"
                @update:model-value="onIdProofTypeChange(kyc)"
              />
            </v-col>

            <!-- ID Number -->
            <v-col cols="12" :md="kyc.id_proof_type === 'passport' ? 6 : 12">
              <v-text-field
                v-model="kyc.id_number"
                :label="idNumberLabel(kyc.id_proof_type)"
                density="compact"
                variant="outlined"
                rounded="lg"
                hide-details="auto"
                :rules="idNumberRules(kyc)"
                @update:model-value="
                  (value) => (kyc.id_number = value.toUpperCase())
                "
              />
            </v-col>

            <!-- Passport Expiry Date -->
            <v-col v-if="kyc.id_proof_type === 'passport'" cols="12" md="6">
              <v-text-field
                v-model="kyc.id_expiry_date"
                type="date"
                :min="today"
                label="Passport Expiry Date"
                density="compact"
                variant="outlined"
                rounded="lg"
                hide-details="auto"
                :rules="[(v) => !!v || 'Passport Expiry Date is required']"
              />
            </v-col>

            <!-- Document Upload -->
            <v-col cols="12">
              <input
                :ref="(el) => setFileInputRef(el, index)"
                type="file"
                accept="image/*,.pdf"
                class="d-none"
                @change="(e) => handleFileChange(e, index)"
              />

              <!-- Upload Button -->
              <v-btn
                v-if="!kyc.document?.document_id"
                variant="outlined"
                color="brandColor2"
                rounded="lg"
                block
                :disabled="!kyc.id_proof_type"
                :loading="uploadState[index]?.uploading"
                prepend-icon="mdi-tray-arrow-up"
                @click="fileInputRefs.get(index)?.click()"
              >
                Upload {{ idProofLabel(kyc.id_proof_type) }}
              </v-btn>

              <!-- Uploaded Document -->
              <div
                v-else
                class="d-flex align-center justify-space-between border rounded-lg pa-3"
              >
                <DocumentPreview
                  :document="kyc.document"
                  :fancybox-group="`kyc-document-${index}`"
                />

                <v-btn
                  variant="text"
                  size="small"
                  color="error"
                  icon="mdi-close"
                  class="flex-shrink-0"
                  :loading="uploadState[index]?.uploading"
                  @click="removeDocument(kyc, index)"
                />
              </div>

              <!-- Upload Error -->
              <div
                v-if="uploadState[index]?.error"
                class="text-error text-caption mt-1"
              >
                {{ uploadState[index].error }}
              </div>
            </v-col>
          </v-row>
        </v-container>

        <v-divider class="mt-2" />
      </div>
    </div>

    <!-- Add / Remove Participant -->
    <v-container class="d-flex align-center justify-space-between py-4">
      <div class="text-body-2 text-grey">
        {{ kycEntries.length }} of {{ maxEntries }} participants
      </div>

      <div class="d-flex ga-2">
        <v-btn
          icon="mdi-minus"
          variant="outlined"
          color="brandColor2"
          size="small"
          :disabled="!canRemoveEntry"
          @click="removeEntry"
        />

        <v-btn
          icon="mdi-plus"
          variant="outlined"
          color="brandColor2"
          size="small"
          :disabled="!canAddEntry"
          @click="addEntry"
        />
      </div>
    </v-container>
  </v-card>
</template>

<script setup>
import { toLocalYMD } from "@/utils/date";
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";
import { useRoute } from "vue-router";
import { Fancybox } from "@fancyapps/ui";
import "@fancyapps/ui/dist/fancybox/fancybox.css";

import { bookingStore } from "@/store/booking";
import apiClient from "@/services/api.js";
import DocumentPreview from "@/components/common/DocumentPreview.vue";

/*
|--------------------------------------------------------------------------
| Props
|--------------------------------------------------------------------------
*/

const props = defineProps({
  config: {
    type: Object,
    default: () => ({}),
  },

  quote: {
    type: Object,
    required: true,
  },
});

const today = toLocalYMD();

const booking = bookingStore;
const route = useRoute();
const rootEl = ref(null);

/*
|--------------------------------------------------------------------------
| Fancybox
|--------------------------------------------------------------------------
*/

onMounted(() => {
  Fancybox.bind(rootEl.value?.$el, '[data-fancybox^="kyc-document-"]', {
    animated: true,
    dragToClose: true,
    Hash: false,
    placeFocusBack: false,
  });
});

onBeforeUnmount(() => {
  Fancybox.unbind(rootEl.value?.$el);
  Fancybox.close();
});

/*
|--------------------------------------------------------------------------
| Nationality
|--------------------------------------------------------------------------
|
| Some slots (e.g. a "For Foreigners" variant) are restricted to a
| single nationality. `nationality_restriction` is one of
| 'ALL' | 'INDIAN_ONLY' | 'NON_INDIAN_ONLY' and, when restricted,
| the excluded nationality must not be selectable.
|
*/

const nationalityRestriction = computed(
  () =>
    props.quote?.availability?.selected_slot?.nationality_restriction ??
    props.quote?.availability?.nationality_restriction ??
    "ALL",
);

const isForNonIndian = computed(
  () => nationalityRestriction.value === "NON_INDIAN_ONLY",
);

const isForAllNationalities = computed(
  () => nationalityRestriction.value === "ALL",
);

const nationalities = computed(() => {
  if (isForNonIndian.value) return ["Foreigner"];
  if (isForAllNationalities.value) return ["Indian", "Foreigner"];

  return ["Indian"];
});

/*
|--------------------------------------------------------------------------
| ID Proof Options
|--------------------------------------------------------------------------
*/

const passportOption = {
  title: "Passport",
  value: "passport",
};

const indianIdProofOptions = [
  passportOption,
  {
    title: "Aadhaar Card",
    value: "aadhaar_card",
  },
  {
    title: "Voter ID",
    value: "voter_id",
  },
  {
    title: "Driving Licence",
    value: "driving_licence",
  },
  {
    title: "Other Valid Govt ID Proof",
    value: "other",
  },
];

const getIdProofOptions = (nationality) => {
  if (nationality === "Foreigner") {
    return [passportOption];
  }

  return indianIdProofOptions;
};

/*
|--------------------------------------------------------------------------
| Labels
|--------------------------------------------------------------------------
*/

const idProofLabel = (type) => {
  const options = [passportOption, ...indianIdProofOptions];

  return options.find((option) => option.value === type)?.title || "ID Proof";
};

const idNumberLabel = (type) => {
  switch (type) {
    case "passport":
      return "Passport Number";

    case "aadhaar_card":
      return "Aadhaar Number";

    case "voter_id":
      return "Voter ID Number";

    case "driving_licence":
      return "Driving Licence Number";

    case "other":
      return "ID Number";

    default:
      return "ID Number";
  }
};

const onIdProofTypeChange = (kyc) => {
  kyc.id_number = "";
  kyc.document = createKycDocument();

  if (kyc.id_proof_type !== "passport") {
    kyc.id_expiry_date = null;
  }
};

const idNumberRules = (kyc) => [(v) => validateIdNumber(v, kyc.id_proof_type)];

const validateIdNumber = (value, type) => {
  if (!value) {
    return `${idNumberLabel(type)} is required`;
  }

  const id = String(value).trim();

  switch (type) {
    case "passport":
      // Indian passport format: 1 letter + 7 digits
      if (!/^[A-Z][0-9]{7}$/i.test(id)) {
        return "Enter a valid passport number (e.g. A1234567)";
      }
      break;

    case "aadhaar_card":
      // Exactly 12 digits
      if (!/^\d{12}$/.test(id)) {
        return "Aadhaar Number must be exactly 12 digits";
      }
      break;

    case "voter_id":
      // Common Indian Voter ID format: 3 letters + 7 digits
      if (!/^[A-Z]{3}[0-9]{7}$/i.test(id)) {
        return "Enter a valid Voter ID (e.g. ABC1234567)";
      }
      break;

    case "driving_licence":
      // State-dependent format, so keep it flexible
      if (!/^[A-Z0-9-]{8,20}$/i.test(id)) {
        return "Enter a valid Driving Licence Number";
      }
      break;

    case "other":
      // Generic government ID
      if (id.length < 4 || id.length > 30) {
        return "ID Number must be between 4 and 30 characters";
      }
      break;

    default:
      return "Please select an ID Proof";
  }

  return true;
};

/*
|--------------------------------------------------------------------------
| KYC Document
|--------------------------------------------------------------------------
*/

const createKycDocument = () => ({
  file_name: "",
  document_id: null,
  document_url: null,
});

/*
|--------------------------------------------------------------------------
| KYC Entry
|--------------------------------------------------------------------------
*/

const createKyc = () => ({
  nationality: isForNonIndian.value ? "Foreigner" : "Indian",
  id_proof_type: "",
  id_number: "",
  id_expiry_date: null,
  document: createKycDocument(),
});

/*
|--------------------------------------------------------------------------
| Reset ID Data
|--------------------------------------------------------------------------
*/

const resetIdData = (kyc) => {
  kyc.id_number = "";
  kyc.id_expiry_date = null;
  kyc.document = createKycDocument();
};

/*
|--------------------------------------------------------------------------
| Nationality Change
|--------------------------------------------------------------------------
*/

const onNationalityChange = (kyc) => {
  resetIdData(kyc);

  if (kyc.nationality === "Foreigner") {
    /*
     * Foreigner can only use Passport.
     */
    kyc.id_proof_type = "passport";
    return;
  }

  /*
   * For Indian users, let them select the ID proof again.
   */
  kyc.id_proof_type = "";
};

/*
|--------------------------------------------------------------------------
| KYC Entries
|--------------------------------------------------------------------------
|
| Unlike kyc_per_passanger (count driven by quote.booking.guests), this
| section's entry count is driven entirely by the user via the Add/Remove
| buttons, capped at config.max_entries (default 10 when the schema sends
| an empty config).
|
*/

const maxEntries = computed(() => {
  const configured = Number(props.config?.max_entries);

  return configured > 0 ? configured : 10;
});

const kycEntries = computed({
  get() {
    if (!Array.isArray(booking.form.kyc_upto_max)) {
      booking.form.kyc_upto_max = [];
    }

    if (booking.form.kyc_upto_max.length === 0) {
      booking.form.kyc_upto_max.push(createKyc());
    }

    return booking.form.kyc_upto_max;
  },

  set(value) {
    booking.form.kyc_upto_max = value;
  },
});

const canAddEntry = computed(() => kycEntries.value.length < maxEntries.value);
const canRemoveEntry = computed(() => kycEntries.value.length > 1);

const addEntry = () => {
  if (!canAddEntry.value) return;

  kycEntries.value.push(createKyc());
};

const removeEntry = () => {
  if (!canRemoveEntry.value) return;

  const index = kycEntries.value.length - 1;

  kycEntries.value.splice(index, 1);

  delete uploadState[index];
  fileInputRefs.delete(index);
};

/*
|--------------------------------------------------------------------------
| Normalize Entries
|--------------------------------------------------------------------------
*/

const normalizeKycEntries = () => {
  if (!Array.isArray(booking.form.kyc_upto_max)) return;

  // Respect a max_entries that shrank since this data was saved.
  booking.form.kyc_upto_max.splice(maxEntries.value);

  booking.form.kyc_upto_max.forEach((kyc) => {
    if (!kyc.document) {
      kyc.document = createKycDocument();
    }

    /*
     * Safety rule:
     * Nationality must match what's actually selectable for this
     * slot — "Foreigner" only when restricted to non-Indians,
     * "Indian" for every other restriction value. Either is fine
     * when unrestricted ("ALL").
     */
    if (isForNonIndian.value && kyc.nationality !== "Foreigner") {
      kyc.nationality = "Foreigner";
      resetIdData(kyc);
    } else if (
      !isForNonIndian.value &&
      !isForAllNationalities.value &&
      kyc.nationality !== "Indian"
    ) {
      kyc.nationality = "Indian";
      resetIdData(kyc);
    }

    /*
     * Safety rule:
     * Foreigner must always have Passport.
     */
    if (kyc.nationality === "Foreigner") {
      if (kyc.id_proof_type !== "passport") {
        kyc.id_proof_type = "passport";
        resetIdData(kyc);
        kyc.id_proof_type = "passport";
      }
    }
  });
};

/*
 * Normalize once up front - important if old data is restored from
 * localStorage/API (e.g. a stale nationality, or more entries than the
 * current max_entries allows).
 */
normalizeKycEntries();

/*
 * Re-normalize whenever the selected slot's nationality restriction
 * changes (e.g. user switches between an "Indians only" and
 * "Foreigners only" slot without changing entry count).
 */
watch(nationalityRestriction, () => {
  normalizeKycEntries();
});

/*
|--------------------------------------------------------------------------
| File Input References
|--------------------------------------------------------------------------
*/

const fileInputRefs = new Map();

const setFileInputRef = (el, index) => {
  if (el) {
    fileInputRefs.set(index, el);
  } else {
    fileInputRefs.delete(index);
  }
};

/*
|--------------------------------------------------------------------------
| Upload State
|--------------------------------------------------------------------------
|
| Kept outside booking.form so upload/loading/error
| information never gets submitted with the booking.
|
*/

const uploadState = reactive({});

/*
|--------------------------------------------------------------------------
| File Upload
|--------------------------------------------------------------------------
*/

const handleFileChange = async (event, index) => {
  const file = event.target.files?.[0];

  /*
   * Reset input so the same file can be selected again.
   */
  event.target.value = "";

  if (!file) return;

  const kyc = kycEntries.value[index];

  if (!kyc) return;

  /*
   * Basic safety check.
   */
  if (!kyc.id_proof_type) {
    uploadState[index] = {
      uploading: false,
      error: "Please select an ID proof type first.",
    };

    return;
  }

  uploadState[index] = {
    uploading: true,
    error: "",
  };

  try {
    const formData = new FormData();

    formData.append("file", file);
    formData.append("name", idProofLabel(kyc.id_proof_type));

    const { data } = await apiClient.post(
      `/v1/booking-estimates/${route.params.estimate_id}/upload-kyc`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );

    const doc = data?.data || data || {};

    kyc.document = {
      file_name: file.name,
      document_id: doc.id ?? doc.document_id ?? null,
      document_url: doc.url ?? doc.file_url ?? doc.document_url ?? null,
    };

    uploadState[index] = {
      uploading: false,
      error: "",
    };
  } catch (err) {
    uploadState[index] = {
      uploading: false,
      error:
        err.response?.data?.message ||
        err.message ||
        "Failed to upload document. Please try again.",
    };
  }
};

/*
|--------------------------------------------------------------------------
| Remove Document
|--------------------------------------------------------------------------
*/

const removeDocument = (kyc, index) => {
  kyc.document = createKycDocument();

  uploadState[index] = {
    uploading: false,
    error: "",
  };
};
</script>

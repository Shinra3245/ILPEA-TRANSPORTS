<template>
  <div
    ref="root"
    class="app-autocomplete"
    :class="[`app-autocomplete--${variant}`, { 'is-open': open, 'is-disabled': disabled }]"
  >
    <div class="app-autocomplete__control">
      <AppIcon name="search" :size="variant === 'toolbar' ? 14 : 16" class="app-autocomplete__icon" />
      <input
        :id="inputId"
        ref="inputRef"
        v-model="query"
        type="text"
        class="app-autocomplete__input"
        :placeholder="placeholder"
        :disabled="disabled"
        autocomplete="off"
        role="combobox"
        :aria-expanded="open"
        aria-autocomplete="list"
        @input="onInput"
        @focus="onFocus"
        @blur="onBlur"
        @keydown.down.prevent="highlightNext"
        @keydown.up.prevent="highlightPrev"
        @keydown.enter.prevent="selectHighlighted"
        @keydown.esc.prevent="close"
      />
      <button
        v-if="clearable && query"
        type="button"
        class="app-autocomplete__clear"
        aria-label="Limpiar"
        @mousedown.prevent="clearSelection"
      >
        <AppIcon name="x" :size="14" />
      </button>
    </div>

    <ul v-if="open && !disabled" class="app-autocomplete__list" role="listbox">
      <li
        v-for="(option, index) in filteredOptions"
        :key="`${option.value}-${index}`"
        class="app-autocomplete__option"
        :class="{ 'is-active': index === highlightIndex }"
        role="option"
        @mousedown.prevent="selectOption(option)"
      >
        <span class="app-autocomplete__label">{{ option.label }}</span>
        <span v-if="option.hint" class="app-autocomplete__hint">{{ option.hint }}</span>
      </li>
      <li v-if="!filteredOptions.length" class="app-autocomplete__empty">
        {{ emptyMessage }}
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import AppIcon from './AppIcon.vue';
import { coincideBusqueda } from '../../utils/busqueda';

export interface AutocompleteOption {
  value: string;
  label: string;
  hint?: string;
  keywords?: string;
}

const props = withDefaults(
  defineProps<{
    modelValue: string;
    options: AutocompleteOption[];
    placeholder?: string;
    disabled?: boolean;
    variant?: 'toolbar' | 'field';
    mode?: 'filter' | 'select';
    emptyMessage?: string;
    maxSuggestions?: number;
    inputId?: string;
    clearable?: boolean;
  }>(),
  {
    placeholder: 'Buscar...',
    disabled: false,
    variant: 'field',
    mode: 'filter',
    emptyMessage: 'Sin coincidencias',
    maxSuggestions: 8,
    clearable: true,
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
  select: [option: AutocompleteOption];
}>();

const root = ref<HTMLElement | null>(null);
const inputRef = ref<HTMLInputElement | null>(null);
const open = ref(false);
const query = ref('');
const highlightIndex = ref(0);
const ignoreNextInput = ref(false);

const selectedOption = computed(() =>
  props.mode === 'select'
    ? props.options.find((option) => option.value === props.modelValue) || null
    : null,
);

function matches(option: AutocompleteOption, term: string) {
  return coincideBusqueda(term, option.label, option.hint, option.keywords, option.value);
}

const filteredOptions = computed(() => {
  const term = query.value.trim();
  const pool = term ? props.options.filter((option) => matches(option, term)) : props.options;
  return pool.slice(0, props.maxSuggestions);
});

function syncQueryFromModel() {
  if (props.mode === 'select') {
    query.value = selectedOption.value?.label || '';
    return;
  }
  query.value = props.modelValue;
}

watch(
  () => props.modelValue,
  () => {
    if (!open.value || props.mode === 'filter') {
      ignoreNextInput.value = true;
      syncQueryFromModel();
    }
  },
);

watch(
  () => props.options,
  () => syncQueryFromModel(),
  { deep: true },
);

function onInput() {
  if (ignoreNextInput.value) {
    ignoreNextInput.value = false;
    return;
  }

  open.value = true;
  highlightIndex.value = 0;

  if (props.mode === 'filter') {
    emit('update:modelValue', query.value);
    return;
  }

  if (!query.value.trim()) {
    emit('update:modelValue', '');
  }
}

function onFocus() {
  if (props.disabled) return;
  open.value = true;
  highlightIndex.value = 0;
}

function close() {
  open.value = false;
  highlightIndex.value = 0;
}

function onBlur() {
  window.setTimeout(() => {
    close();
    if (props.mode === 'select' && selectedOption.value) {
      query.value = selectedOption.value.label;
    }
  }, 120);
}

function selectOption(option: AutocompleteOption) {
  if (props.mode === 'select') {
    emit('update:modelValue', option.value);
    query.value = option.label;
  } else {
    const term = option.keywords || option.label;
    query.value = term;
    emit('update:modelValue', term);
  }

  emit('select', option);
  close();
  inputRef.value?.blur();
}

function clearSelection() {
  query.value = '';
  emit('update:modelValue', '');
  open.value = false;
  nextTick(() => inputRef.value?.focus());
}

function highlightNext() {
  if (!open.value) {
    open.value = true;
    return;
  }
  if (!filteredOptions.value.length) return;
  highlightIndex.value = (highlightIndex.value + 1) % filteredOptions.value.length;
}

function highlightPrev() {
  if (!filteredOptions.value.length) return;
  highlightIndex.value =
    (highlightIndex.value - 1 + filteredOptions.value.length) % filteredOptions.value.length;
}

function selectHighlighted() {
  const option = filteredOptions.value[highlightIndex.value];
  if (option) {
    selectOption(option);
    return;
  }
  close();
}

function onClickOutside(event: MouseEvent) {
  if (root.value && !root.value.contains(event.target as Node)) {
    close();
  }
}

onMounted(() => {
  syncQueryFromModel();
  document.addEventListener('mousedown', onClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onClickOutside);
});
</script>

<style scoped>
.app-autocomplete {
  position: relative;
  width: 100%;
}

.app-autocomplete__control {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  border: 1px solid var(--ilpea-border);
  border-radius: 8px;
  background: var(--ilpea-white);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.app-autocomplete--toolbar .app-autocomplete__control {
  border-radius: 8px;
}

.app-autocomplete--field .app-autocomplete__control {
  margin-top: 0.35rem;
}

.app-autocomplete.is-open .app-autocomplete__control,
.app-autocomplete__control:focus-within {
  border-color: var(--ilpea-accent);
  box-shadow: 0 0 0 3px rgba(16, 124, 65, 0.12);
}

.app-autocomplete__icon {
  flex-shrink: 0;
  color: var(--ilpea-gray-500);
  margin-left: 0.75rem;
}

.app-autocomplete__input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  padding: 0.65rem 0.25rem 0.65rem 0;
  font-size: 0.9rem;
  color: var(--ilpea-gray-900);
  outline: none;
}

.app-autocomplete--toolbar .app-autocomplete__input {
  padding-top: 0.7rem;
  padding-bottom: 0.7rem;
}

.app-autocomplete__clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  margin-right: 0.35rem;
  border: none;
  border-radius: 999px;
  background: var(--ilpea-gray-100);
  color: var(--ilpea-gray-500);
  cursor: pointer;
}

.app-autocomplete__clear:hover {
  background: var(--ilpea-gray-200);
  color: var(--ilpea-gray-900);
}

.app-autocomplete__list {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 40;
  margin: 0;
  padding: 0.35rem 0;
  list-style: none;
  max-height: 280px;
  overflow-y: auto;
  border: 1px solid var(--ilpea-border);
  border-radius: 10px;
  background: var(--ilpea-white);
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.12);
}

.app-autocomplete__option {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding: 0.65rem 0.85rem;
  cursor: pointer;
}

.app-autocomplete__option.is-active,
.app-autocomplete__option:hover {
  background: var(--ilpea-gray-100);
}

.app-autocomplete__label {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--ilpea-black);
}

.app-autocomplete__hint {
  font-size: 0.78rem;
  color: var(--ilpea-gray-500);
}

.app-autocomplete__empty {
  padding: 0.75rem 0.85rem;
  font-size: 0.85rem;
  color: var(--ilpea-gray-500);
}

.app-autocomplete.is-disabled {
  opacity: 0.65;
}
</style>

<template>
  <component
    :is="iconComponent"
    :size="size"
    :stroke-width="strokeWidth"
    :class="['icon-inline', { 'icon-spin': spin }, iconClass]"
    aria-hidden="true"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  AlertTriangle,
  BarChart3,
  ChevronLeft,
  CircleUser,
  ClipboardList,
  FileSpreadsheet,
  Lightbulb,
  Loader2,
  Lock,
  Mail,
  MapPin,
  MessageSquare,
  ShieldX,
  TrendingUp,
  Truck,
  X,
} from 'lucide-vue-next';

const ICONS = {
  'alert-triangle': AlertTriangle,
  'bar-chart-3': BarChart3,
  'chevron-left': ChevronLeft,
  'circle-user': CircleUser,
  'clipboard-list': ClipboardList,
  'file-spreadsheet': FileSpreadsheet,
  lightbulb: Lightbulb,
  'loader-2': Loader2,
  lock: Lock,
  mail: Mail,
  'map-pin': MapPin,
  'message-square': MessageSquare,
  'shield-x': ShieldX,
  'trending-up': TrendingUp,
  truck: Truck,
  x: X,
} as const;

export type AppIconName = keyof typeof ICONS;

const props = withDefaults(
  defineProps<{
    name: AppIconName;
    size?: number;
    strokeWidth?: number;
    spin?: boolean;
    iconClass?: string;
  }>(),
  {
    size: 18,
    strokeWidth: 2,
    spin: false,
    iconClass: '',
  }
);

const iconComponent = computed(() => ICONS[props.name]);
</script>

<template>
  <span :tooltip="tooltipText" :position="position"><slot /></span>
</template>

<script>
export default {
  name: "TooltipComponent",
  props: {
    tooltipText: {
      type: String,
      default: "Tooltip text",
    },
    position: {
      default: "top",
      type: String,
    },
  },
};
</script>

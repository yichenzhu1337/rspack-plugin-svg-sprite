<template>
  <svg
    :class="['icon', size ? 'icon--' + size : '', clickable ? 'icon--clickable' : '']"
    :title="title"
    @click="clickable ? $emit('click', $event) : null"
  >
    <use :xlink:href="`/sprite.svg#${icon}`" />
  </svg>
</template>

<script>
export default {
  name: 'BaseIcon',
  props: {
    icon: { type: String, required: true },
    size: { type: String, default: '' },
    title: { type: String, default: '' },
    clickable: { type: Boolean, default: false },
  },
  emits: ['click'],
  mounted() {
    // Ensure rspack discovers the SVG so it's included in the sprite.
    // This mirrors the pattern used in large apps with dynamic icon names.
    import(/* webpackMode: "eager" */ `~/icons/${this.icon}.svg`);
  },
};
</script>

<style>
.icon {
  width: 24px;
  height: 24px;
  display: inline-block;
  vertical-align: middle;
}
.icon--small {
  width: 16px;
  height: 16px;
}
.icon--large {
  width: 32px;
  height: 32px;
}
.icon--clickable {
  cursor: pointer;
}
.icon--clickable:hover {
  opacity: 0.7;
}
</style>

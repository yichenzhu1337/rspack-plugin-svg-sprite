<script>
import star from './icons/star.svg';
import gradient from './icons/gradient.svg';
import multi from './icons/multi.svg';

export default {
  data() {
    return {
      // Decorative icons sit beside visible text and are hidden from assistive technology.
      // A meaningful icon stands alone, so it gets role="img" and a label.
      rows: [
        { symbol: star, text: 'Starred', label: null },
        { symbol: gradient, text: '', label: 'Sunrise' },
        { symbol: multi, text: 'Palette', label: null },
      ],
    };
  },
  methods: {
    async addIcon() {
      const late = (await import('./icons/late.svg')).default;
      this.rows.push({ symbol: late, text: 'Added later', label: null });
    },
  },
};
</script>

<template>
  <ul>
    <li v-for="row in rows" :key="row.symbol.id">
      <svg
        class="icon"
        :viewBox="row.symbol.viewBox"
        :data-icon="row.symbol.id"
        :role="row.label ? 'img' : undefined"
        :aria-label="row.label || undefined"
        :aria-hidden="row.label ? undefined : 'true'"
        :focusable="row.label ? undefined : 'false'"
      >
        <use :href="row.symbol.url" />
      </svg>
      {{ row.text }}
    </li>
  </ul>
  <button id="add-icon" type="button" @click="addIcon">Add icon</button>
</template>

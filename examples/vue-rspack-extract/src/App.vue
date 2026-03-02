<template>
  <div class="app">
    <h1>SVG Sprite — Vue Extract Mode Demo</h1>
    <p class="subtitle">
      This example uses <code>plainSprite: true</code> with extract mode and
      <code>&lt;use href&gt;</code> — the same pattern used in large enterprise apps.
    </p>

    <section class="icon-grid">
      <div v-for="name in icons" :key="name" class="icon-card">
        <BaseIcon :icon="name" size="large" />
        <span class="icon-name">{{ name }}</span>
      </div>
    </section>

    <section class="demo-section">
      <h2>Interactive Icons</h2>
      <p>These icons have <code>clickable</code> enabled:</p>
      <div class="demo-row">
        <BaseIcon icon="close" :clickable="true" title="Close" @click="handleClick('close')" />
        <BaseIcon icon="search" :clickable="true" title="Search" @click="handleClick('search')" />
        <BaseIcon
          icon="settings"
          :clickable="true"
          title="Settings"
          @click="handleClick('settings')"
        />
      </div>
      <p v-if="lastClicked" class="click-log">
        Last clicked: <strong>{{ lastClicked }}</strong>
      </p>
    </section>

    <section class="demo-section">
      <h2>Sizes</h2>
      <div class="demo-row">
        <div class="size-demo"><BaseIcon icon="home" size="small" /><span>small</span></div>
        <div class="size-demo"><BaseIcon icon="home" /><span>default</span></div>
        <div class="size-demo"><BaseIcon icon="home" size="large" /><span>large</span></div>
      </div>
    </section>
  </div>
</template>

<script>
import BaseIcon from './components/BaseIcon.vue';

export default {
  name: 'App',
  components: { BaseIcon },
  data() {
    return {
      icons: ['home', 'search', 'settings', 'close', 'check'],
      lastClicked: '',
    };
  },
  methods: {
    handleClick(name) {
      this.lastClicked = name;
    },
  },
};
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f5f5f5;
  color: #333;
}
.app {
  max-width: 720px;
  margin: 0 auto;
  padding: 2rem;
}
h1 {
  margin-bottom: 0.5rem;
}
h2 {
  margin-bottom: 0.5rem;
}
.subtitle {
  color: #666;
  margin-bottom: 2rem;
}
code {
  background: #e8e8e8;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 0.9em;
}
.icon-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}
.icon-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
.icon-name {
  font-size: 0.8rem;
  color: #888;
}
.demo-section {
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
.demo-row {
  display: flex;
  gap: 1rem;
  align-items: center;
  margin: 1rem 0;
}
.size-demo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}
.size-demo span {
  font-size: 0.75rem;
  color: #888;
}
.click-log {
  margin-top: 0.5rem;
  color: #4a90d9;
}
</style>

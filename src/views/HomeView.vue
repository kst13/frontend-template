<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useCounterStore } from '@/stores/counter'

const counter = useCounterStore()
</script>

<template>
  <main class="home">
    <h1>Frontend Template</h1>
    <p>Vue 3 + TypeScript + Pinia + Vue Router</p>

    <section class="counter">
      <p>Count: {{ counter.count }}</p>
      <p>Double: {{ counter.doubleCount }}</p>
      <button @click="counter.increment">증가</button>
    </section>

    <nav>
      <RouterLink to="/">홈</RouterLink>
      <RouterLink to="/about">소개</RouterLink>
    </nav>
  </main>
</template>

<style scoped>
.home {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}

.counter {
  margin: 2rem 0;
  padding: 1.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
}

.counter button {
  margin-top: 0.5rem;
  padding: 0.5rem 1.5rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.2s;
}

.counter button:hover {
  background: #2563eb;
}

nav {
  margin-top: 2rem;
  display: flex;
  gap: 1rem;
  justify-content: center;
}

nav a {
  color: #3b82f6;
  text-decoration: none;
  font-weight: 500;
}

nav a:hover {
  text-decoration: underline;
}
</style>

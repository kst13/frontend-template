<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <main class="about">
    <h1>소개</h1>
    <p>Vue 3 기반 프론트엔드 템플릿입니다.</p>
    <RouterLink to="/">← 홈으로</RouterLink>
  </main>
</template>

<style scoped>
.about {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}

a {
  color: #3b82f6;
  text-decoration: none;
  font-weight: 500;
}

a:hover {
  text-decoration: underline;
}
</style>

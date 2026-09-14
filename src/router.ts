import type { RouteRecordRaw } from 'vue-router'

export const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: () => import('./pages/Home.vue') },
  { path: '/essays', name: 'essays', component: () => import('./pages/EssayList.vue') },
  { path: '/essays/:slug', name: 'essay', component: () => import('./pages/Essay.vue') },
  { path: '/projects', name: 'projects', component: () => import('./pages/ProjectList.vue') },
  { path: '/about', name: 'about', component: () => import('./pages/About.vue') },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('./pages/NotFound.vue') },
]

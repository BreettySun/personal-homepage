import type { RouteLocationNormalized, RouteRecordRaw, RouterScrollBehavior } from 'vue-router'

export const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: () => import('./pages/Home.vue') },
  { path: '/essays', name: 'essays', component: () => import('./pages/EssayList.vue') },
  { path: '/essays/:slug', name: 'essay', component: () => import('./pages/Essay.vue') },
  { path: '/projects', name: 'projects', component: () => import('./pages/ProjectList.vue') },
  { path: '/about', name: 'about', component: () => import('./pages/About.vue') },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('./pages/NotFound.vue') },
]

/** 旧页面淡出的时长（ms），和 base.css 里 .page-leave-active 的时长一致。 */
export const PAGE_LEAVE_MS = 180

function isFirstNavigation(from: RouteLocationNormalized) {
  return from.matched.length === 0
}

/**
 * 换页后的滚动位置：前进后退回到离开时的位置，带 #hash 的滚到锚点，其余回到顶部。
 * 页面切换是 <Transition mode="out-in">，要等旧页面淡出之后再滚，
 * 否则旧页面会在淡出途中先跳到顶上；首次加载不用等。
 */
export const scrollBehavior: RouterScrollBehavior = (to, from, saved) => {
  const target = saved ?? (to.hash ? { el: to.hash } : { top: 0 })
  if (isFirstNavigation(from)) return target
  return new Promise(resolve => setTimeout(() => resolve(target), PAGE_LEAVE_MS))
}

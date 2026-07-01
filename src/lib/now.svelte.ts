import { SvelteDate } from 'svelte/reactivity'

export const now = new SvelteDate()

let ticking = $effect.root(() => {
  const interval = setInterval(() => {
    now.setTime(Date.now())
  }, 200)
  return () => clearInterval(interval)
})

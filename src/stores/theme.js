import { writable } from 'svelte/store';

const stored = typeof localStorage !== 'undefined' ? (localStorage.getItem('fd_theme') || 'dark') : 'dark';
export const theme = writable(stored);

theme.subscribe(v => {
  if (typeof localStorage !== 'undefined') localStorage.setItem('fd_theme', v);
});

import { writable } from 'svelte/store';

export const modalState = writable({ open: false, title: '', body: '' });

export function openModal(title, body) {
  modalState.set({ open: true, title, body });
}

export function closeModal() {
  modalState.update(m => ({ ...m, open: false }));
}

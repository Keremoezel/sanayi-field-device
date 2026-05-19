<script>
  import { modalState, closeModal } from '../stores/modal.js';

  function onOverlayClick(e) {
    if (e.target === e.currentTarget) closeModal();
  }
</script>

<div
  class="modal-overlay"
  class:show={$modalState.open}
  on:click={onOverlayClick}
  role="dialog"
  aria-modal="true"
>
  <div class="modal-sheet">
    <div class="modal-handle"></div>
    <div class="modal-header">
      <div class="modal-title">{$modalState.title}</div>
      <button class="modal-close" on:click={closeModal}>✕</button>
    </div>
    <div class="modal-body">
      {@html $modalState.body}
    </div>
  </div>
</div>

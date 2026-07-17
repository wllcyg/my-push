<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'

const props = defineProps<{
  modelValue: string
  isLoading: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  send: []
  stop: []
}>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const MIN_HEIGHT = 52
const MAX_HEIGHT = 240

function resize(): void {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  const newHeight = Math.min(Math.max(el.scrollHeight, MIN_HEIGHT), MAX_HEIGHT)
  el.style.height = `${newHeight}px`
}

function onInput(e: Event): void {
  const target = e.target as HTMLTextAreaElement
  emit('update:modelValue', target.value)
  nextTick(() => resize())
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    if (canSend.value) emit('send')
  }
}

const canSend = computed(
  () => props.modelValue.trim().length > 0 && !props.isLoading,
)

// Focus when disabled switches to enabled
watch(
  () => props.isLoading,
  (val) => {
    if (!val) {
      nextTick(() => textareaRef.value?.focus())
    }
  },
)

function focusInput(): void {
  textareaRef.value?.focus()
}

defineExpose({ focusInput })
</script>

<template>
  <div class="chat-input" @click="focusInput">
    <div class="chat-input__wrapper">
      <!-- Textarea -->
      <textarea
        ref="textareaRef"
        class="chat-input__textarea"
        :value="modelValue"
        placeholder="Message…"
        rows="1"
        :disabled="disabled"
        aria-label="Chat message input"
        @input="onInput"
        @keydown="onKeydown"
      />

      <!-- Actions -->
      <div class="chat-input__actions">
        <!-- Stop button -->
        <button
          v-if="isLoading"
          class="chat-input__btn chat-input__btn--stop"
          type="button"
          aria-label="Stop generating"
          @click.stop="emit('stop')"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
          </svg>
        </button>

        <!-- Send button -->
        <button
          v-else
          class="chat-input__btn chat-input__btn--send"
          type="button"
          :disabled="!canSend"
          aria-label="Send message"
          @click.stop="emit('send')"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="m22 2-7 20-4-9-9-4Z" />
            <path d="M22 2 11 13" />
          </svg>
        </button>
      </div>
    </div>

    <p class="chat-input__hint">
      <kbd>Enter</kbd> to send · <kbd>Shift + Enter</kbd> for new line
    </p>
  </div>
</template>

<style scoped lang="scss">
.chat-input {
  width: 100%;
  max-width: var(--input-max-width);
  margin: 0 auto;
  cursor: text;

  &__wrapper {
    display: flex;
    align-items: flex-end;
    gap: var(--space-2);
    background: var(--color-bg-input);
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-2xl);
    padding: var(--space-2) var(--space-2) var(--space-2) var(--space-5);
    box-shadow: var(--shadow-md);
    transition: border-color var(--duration-base), box-shadow var(--duration-base);

    &:focus-within {
      border-color: var(--color-border-focus);
      box-shadow: var(--shadow-lg), 0 0 0 3px rgba(37, 99, 235, 0.1);
    }
  }

  &__textarea {
    flex: 1;
    border: none;
    outline: none;
    resize: none;
    background: transparent;
    color: var(--color-text-primary);
    font-family: var(--font-family);
    font-size: var(--text-base);
    line-height: var(--leading-relaxed);
    min-height: 28px;
    max-height: 240px;
    padding: 10px 0;
    overflow-y: auto;

    &::placeholder {
      color: var(--color-text-muted);
    }

    &:disabled {
      opacity: 1;
    }
  }

  &__actions {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    padding-bottom: 6px;
  }

  &__btn {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    cursor: pointer;
    transition: all var(--duration-fast) var(--ease-out);
    flex-shrink: 0;

    &--send {
      background: var(--color-primary);
      color: white;

      &:hover:not(:disabled) {
        background: var(--color-primary-hover);
        transform: scale(1.05);
      }

      &:active:not(:disabled) {
        transform: scale(0.96);
      }

      &:disabled {
        background: var(--color-bg-muted);
        color: var(--color-text-muted);
        cursor: not-allowed;
        transform: none;
      }
    }

    &--stop {
      background: var(--color-error-bg);
      color: var(--color-error);
      animation: pulse 1.5s ease-in-out infinite;

      &:hover {
        background: var(--color-error);
        color: white;
        animation: none;
      }
    }
  }

  &__hint {
    text-align: center;
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    margin-top: var(--space-2);
    user-select: none;

    kbd {
      font-family: var(--font-mono);
      font-size: 10px;
      background: var(--color-bg-muted);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-xs);
      padding: 1px 4px;
      color: var(--color-text-secondary);
    }
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
</style>

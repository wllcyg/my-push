import { useChat } from '@ai-sdk/vue';
import { watch } from 'vue';
const chat = useChat();
watch(() => chat.messages.value, (m) => console.log('Messages changed:', m), { deep: true });
chat.sendMessage({ role: 'user', content: 'test' }).catch(e => console.error(e));

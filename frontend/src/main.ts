import { createApp } from 'vue'
import { MotionPlugin } from '@vueuse/motion'
import App from './App.vue'
import router from './router'
import './assets/base.css'
import './assets/tokens.css'

const app = createApp(App)
app.use(router)
app.use(MotionPlugin)
app.mount('#app')
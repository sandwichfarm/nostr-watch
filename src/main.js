import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import "./styles/main.scss"
import directives from "./directives/"
import titleMixin from './mixins/titleMixin'

const app = createApp(App)
app
  .use(router)
  .mixin(titleMixin)

directives(app);

app.mount('#app')

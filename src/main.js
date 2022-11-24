import { createApp } from 'vue'
import App from './App.vue'
import "./styles/main.scss"
import directives from "./directives/"
import titleMixin from './mixins/titleMixin'

const app = createApp(App)
app.mixin(titleMixin)


directives(app);


app.mount('#app')

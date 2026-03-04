import DefaultTheme from 'vitepress/theme'
import './custom.css'
import PackageIndex from './components/PackageIndex.vue'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('PackageIndex', PackageIndex)
  },
}

import Vue from 'vue'
import App from './App.vue'
import './icons'
import router from "./router";
import store from './store'
// 路由守卫
import "./permission";
Vue.config.productionTip = false

new Vue({
  router,
  store,
  render: h => h(App)
}).$mount('#app')

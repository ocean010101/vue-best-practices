import Vue from 'vue'
import Vuex from 'vuex'
import user from './modules/user'
import permission from './modules/permission'

Vue.use(Vuex)

const store = new Vuex.Store({
  modules: { user, permission },
  // 全局定义getters便于访问
  getters: {
    roles: state => state.user.roles,
    permission_routes: state => state.permission.routes,
  }
})

export default store


// import Vue from "../../node_modules/vue/dist/vue.js";
class YVueRouter {
  constructor(options) {
    this.$options = options;
    this.routeMap = {}; // 用于保存路由路径与组件的映射关系
    // 路由响应式
    this.app = new Vue({
      data: {
        current: "/"
      }
    });
  }
  init() {
    this.bindEvents(); //监听url变化
    this.createRouteMap(this.$options); //解析路由配置
    this.initComponent(); // 全局注册router-link 和 router-view 两个组件
  }
  /**
   * 监听url变化
   */
  bindEvents() {
    window.addEventListener("load", this.onHashChange.bind(this));
    window.addEventListener("hashchange", this.onHashChange.bind(this));
  }
  onHashChange() {
    this.app.current = window.location.hash.slice(1) || "/";
  }
  /**
   * 解析路由配置, 获取路由与组件的映射关系
   * @param {Object} options 
   */
  createRouteMap(options) {
    options.routes.forEach(item => {
      this.routeMap[item.path] = item.component;
    });
  }
  initComponent() {
    // router-link,router-view
    // <router-link to="">fff</router-link>
    Vue.component("router-link", {
      props: { to: String },
      render(h) {
        // h(tag, data, children)
        return h("a", { attrs: { href: "#" + this.to } }, [
          this.$slots.default
        ]);
      }
    });

    // <router-view></router-view>
    Vue.component("router-view", {
      render: h => {
        const comp = this.routeMap[this.app.current];
        return h(comp);
      }
    });
  }
}
YVueRouter.install = function (Vue) {
  // 混入
  Vue.mixin({
    beforeCreate() {
      // this是Vue实例
      if (this.$options.router) {
        // 仅在根组件执行一次
        Vue.prototype.$router = this.$options.router;
        this.$options.router.init();
      }
    }
  });
};
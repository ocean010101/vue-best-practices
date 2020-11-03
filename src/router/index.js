import Vue from "vue";
import Router from "vue-router";
import Layout from '@/layout'; // 布局页

Vue.use(Router);

// 通用页面
export const constRoutes = [
  {
    path: "/login",
    component: () => import("@/views/Login"),
    hidden: true // 导航菜单忽略该项
  },
  {
    path: "/",
    component: Layout,// 应用布局
    redirect: "/home",
    children: [
      {
        path: "home",
        component: () =>
          import(/* webpackChunkName: "home" */ "@/views/Home.vue"),
        name: "home",
        meta: {
          title: "Home", // 导航菜单项标题
          icon: "all" // 导航菜单项图标
        }
      }
    ]
  }
];


// 权限页面
export const asyncRoutes = [
  {
    path: "/about",
    component: Layout,
    redirect: "/about/index",
    // meta: { // 应用到所有孩子
    //   roles: ['admin', 'editor']
    // },
    children: [
      {
        path: "index",
        component: () =>
          import(/* webpackChunkName: "home" */ "@/views/About.vue"),
        name: "about",
        meta: {
          title: "About",
          icon: "all",
          roles: ['admin', 'editor']
        },
      },
      // {
      //   path: "test",
      //   component: () =>
      //     import(/* webpackChunkName: "home" */ "@/views/About.vue"),
      //   name: "test",
      //   meta: {
      //     title: "About",
      //     icon: "all",
      //     roles: ['admin']
      //   },
      // },
    ]
  }
];

export default new Router({
  mode: "history",
  base: process.env.BASE_URL,
  routes: constRoutes
});
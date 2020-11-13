# 实现YVueRouter

- 开发插件
- url变化监听
- 路由配置解析： {‘/’: Home}
- 实现全局组件：router-link router-view

## 开发插件

VueRouter做为插件被安装到Vue中，Vue.js 的插件应该暴露一个 `install` 方法。这个方法的第一个参数是 `Vue` 构造器，第二个参数是一个可选的选项对象：

```js
MyPlugin.install = function (Vue, options) {
  // 1. 添加全局方法或 property
  Vue.myGlobalMethod = function () {
    // 逻辑...
  }

  // 2. 添加全局资源
  Vue.directive('my-directive', {
    bind (el, binding, vnode, oldVnode) {
      // 逻辑...
    }
    ...
  })

  // 3. 注入组件选项
  Vue.mixin({
    created: function () {
      // 逻辑...
    }
    ...
  })

  // 4. 添加实例方法
  Vue.prototype.$myMethod = function (methodOptions) {
    // 逻辑...
  }
}
```

### 实现

vue-router通过全局混入来添加一些组件选项。

```js
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
}
```



```js
init() {
    this.bindEvents(); //监听url变化
    this.createRouteMap(this.$options); //解析路由配置
    this.initComponent(); // 实现router-link 和 router-view 两个组件
}
```

#### Vue.mixin

- 定义：Vue.mixin( mixin )

- 参数：mixin: Object

- 作用：全局注册一个混入，影响注册之后所有创建的每个 Vue 实例。

使用：

```js
// 为自定义的选项 'myOption' 注入一个处理器。
Vue.mixin({
  created: function () {
    var myOption = this.$options.myOption
    if (myOption) {
      console.log(myOption)
    }
  }
})

new Vue({
  myOption: 'hello!'
})
// => "hello!"
```

- 注意事项：由于影响注册之后所有创建的每个 Vue 实例。插件作者可以使用混入，向组件注入自定义的行为。**不推荐在应用代码中使用**。

- 实现原理：将用户传入的对象与Vue 自身的options属性合并

- 源码：src\core\global-api\mixin.js

  ```js
  import { mergeOptions } from '../util/index'
  
  // 将用户传入的对象与Vue自身的options合并
  export function initMixin (Vue: GlobalAPI) {
    Vue.mixin = function (mixin: Object) {
      // 使用mergeOptions 生成一个新的对象
      this.options = mergeOptions(this.options, mixin)
      return this
    } 
  }
  ```

#### Vue.use

- 定义：Vue.use( plugin )

- 参数：plugin ：Function | Object

- 作用：安装 Vue.js 插件

- 使用：

  ```js
  import Vue from 'vue'
  import VueRouter from 'vue-router'
  
  Vue.use(VueRouter)
  ```

- 注意事项：该方法需要在调用 `new Vue()` 之前被调用

- 实现原理：

  - 插件的类型可以是install 方法， 也可以是一个包含install 方法的对象

    - 插件是对象， 必须提供install方法，执行对象的install方法

    - 插件是函数， 它会被作为install方法，执行此函数

  - 插件只能被安装一次

    - installedPlugins存储被注册过的插件， 在执行插件之前对installedPlugins 判断， 防止插件重复注册。在执行插件之后，将插件放入installedPlugins，用于插件之前的重复检查

- 源码：src\core\global-api\use.js

  ```js
  Vue.use = function (plugin: Function | Object) {
      const installedPlugins = (this._installedPlugins || (this._installedPlugins = []))
      // 判断插件是否被注册过，如果注册过，终止注册
      if (installedPlugins.indexOf(plugin) > -1) {
          return this
      }
      // 其他参数
      const args = toArray(arguments, 1) // 注册插件时传入的参数
      // 为了保证install方法被执行时第一个参数是Vue，将Vue添加到参数列表最前面
      args.unshift(this)
      if (typeof plugin.install === 'function') { // 如果插件是对象类型，这个对象中有install方法
          plugin.install.apply(plugin, args)// 执行插件
      } else if (typeof plugin === 'function') {//如果插件是函数类型
          plugin.apply(null, args)// 执行插件
      }
  
      installedPlugins.push(plugin) // 保证插件不被重复注册
      return this
  }
  ```

  

## url变化监听

实现原理： 

- 利用Vue的数据响应式把指向当前路由的数据响应化

  ```js
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
  ```

  - 在使用<router-view> 组件时， 会获取this.app.current， 会触发this.app.current的getter，会进行依赖收集；
  - 当url变化时，会修改this.app.current， 会触发this.app.current的getter，会通知依赖(使用this.app.current 的地方， eg: <router-view> 组件)进行更新

- 监听load 事件和 hashchange 事件

  ```js
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
  ```

  

## 路由配置解析

### createRouteMap

实现原理： 遍历options.routes 列表， 将路由路径与组件的对应关系保存到this.routeMap 中

```js
/**
   * 解析路由配置, 获取路由与组件的映射关系
   * @param {Object} options 
   */
createRouteMap(options) {
    options.routes.forEach(item => {
        this.routeMap[item.path] = item.component;
    });
}
```

## 实现全局组件：router-link  和 router-view

### router-link

实现原理：

props选项： 获取从父组件传递过来的要到达的路由路径to

render 选项：当组件实例化时，在使用`<router-link to="">fff</router-link>` 的位置会渲染为`<a href='#'+ {{this.to }}>`

```js
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
```

### router-view

实现原理：

定义组件render 选项， 当组件实例化时，在使用`<router-view></router-view>` 的位置会渲染this.app.current 对应的组件

```js
// <router-view></router-view>
Vue.component("router-view", {
    render: h => {
        const comp = this.routeMap[this.app.current];
        return h(comp);
    }
});
```

## 总结

```js

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
```



## 测试

```html
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="ie=edge">
  <title>YVueRouter Test</title>
</head>

<body>
  <div id="app">
    <div>
      <router-link to="/">home</router-link>&nbsp;
      <router-link to="/about">about</router-link>
    </div>
    <router-view></router-view>
  </div>
  <script src='../../node_modules/vue/dist/vue.js'></script>
  <script src='./yvueRouter.js'></script>

  <script>
    var home = {
      name: 'home',
      template: `
      <div>
        <h1>Home Page</h1>
      </div>
      `
    }
    var about = {
      name: 'about',
      template: `
      <div>
        <h1>About Page</h1>
      </div>
      `
    }

    const router = new YVueRouter({
      routes: [{
          path: "/",
          component: home
        },
        {
          path: "/about",
          component: about
        }
      ]
    });

    Vue.use(YVueRouter);
    const app = new Vue({
      el: '#app',
      router,
      components: {
        home,
        about
      }
    })
  </script>
</body>

</html>
```






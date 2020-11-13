# 实现vuex

- vuex是一个插件
- 实现state/mutations/actions/getters
- 创建Store
- 数据响应式

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

vuex通过全局混入来添加一些组件选项。

```js
Store.install = function (Vue) {
  Vue.mixin({
    beforeCreate() {
      if (this.$options.store) {
        Vue.prototype.$store = this.$options.store;
      }
    }
  });
}
```

使用示例：

```js
let store = new Store({
    state,
    getters,
    actions,
    mutations
})
Vue.use(Store)
const app = new Vue({
    store,
}).$mount('#app')
```

## 创建Store

```js
class Store {
  constructor(options) {
    // 数据响应化
    this.state = new Vue({
      data: options.state
    });

    this.mutations = options.mutations;
    this.actions = options.actions;

    options.getters && this.handleGetters(options.getters)
  }
}
```

## 数据响应式

利用Vue的数据响应式把state响应化

```js
class Store {
  constructor(options) {
    // 数据响应化
    this.state = new Vue({
      data: options.state
    });
  }
}
```

### 

## 处理getters

```js
class Store {
  constructor(options) {
    options.getters && this.handleGetters(options.getters)
  }

  handleGetters(getters) {
    this.getters = {};
    // 遍历getters所有key
    Object.keys(getters).forEach(key => {
      // 为this.getters定义若干属性，这些属性是只读的
      // $store.getters.score
      Object.defineProperty(this.getters, key, {
        get: () => {
          return getters[key](this.state);
        }
      })
    })
  }
}
```

使用示例：

```js
const getters = {
    evenOrOdd: state => state.count % 2 === 0 ? 'even' : 'odd'
}
let store = new Store({
    state,
    getters,
    actions,
    mutations
})
Vue.use(Store)
const app = new Vue({
    store,
    computed: {
        evenOrOdd() {
            return this.$store.getters.evenOrOdd
        }
    },
}).$mount('#app')
```

## 实现commit

实现原理： 调用mutations 中名字为type 的方法

```js
commit(type, arg) {
    this.mutations[type](this.state, arg);
};
```

使用示例：

```js
const mutations = {
    increment(state) {
        state.count++
    },
    decrement(state) {
        state.count--
    }
}
let store = new Store({
    state,
    getters,
    actions,
    mutations
})
Vue.use(Store)
const app = new Vue({
    store,
    methods: {
        increment() {
            this.$store.commit('increment')
            // this.$store.dispatch('increment')
        },
        decrement() {
            this.$store.commit('decrement')
        },
    }
}).$mount('#app')
```

## 实现dispatch

实现原理： 调用actions中名字为type 的方法， actions 定义的方法最终也是通过调用commit 实现

```js
dispatch(type, arg) {
    this.actions[type]({
        commit: this.commit.bind(this), // 或者commit 实现使用箭头函数
        state: this.state
    }, arg);
}
```

使用示例：

```js
const actions = {
    increment: ({
        commit
    }) => commit('increment'),
    decrement: ({
    commit
}) => commit('decrement'),
    incrementIfOdd({
    commit,
    state
}) {
    if ((state.count + 1) % 2 === 0) {
        commit('increment')
    }
},
incrementAsync({
        commit
    }) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                commit('increment')
                resolve()
            }, 1000)
        })
    }
}    
let store = new Store({
    state,
    getters,
    actions,
    mutations
})
Vue.use(Store)
const app = new Vue({
    store,
    methods: {
        increment() {
            this.$store.dispatch('increment')
        },
        decrement() {
            this.$store.dispatch('decrement')
        },
        incrementIfOdd() {
            this.$store.dispatch('incrementIfOdd')
        },
        incrementAsync() {
            this.$store.dispatch('incrementAsync')
        },
    }
}).$mount('#app')
```



## 总结

```js
// let Vue;

class Store {
  constructor(options) {
    // 数据响应化
    this.state = new Vue({
      data: options.state
    });

    this.mutations = options.mutations;
    this.actions = options.actions;

    options.getters && this.handleGetters(options.getters)
  }

  commit(type, arg) {
    this.mutations[type](this.state, arg);
  };

  dispatch(type, arg) {
    this.actions[type]({
      commit: this.commit.bind(this), // 或者commit 实现使用箭头函数
      state: this.state
    }, arg);
  }

  handleGetters(getters) {
    this.getters = {};
    // 遍历getters所有key
    Object.keys(getters).forEach(key => {
      // 为this.getters定义若干属性，这些属性是只读的
      // $store.getters.score
      Object.defineProperty(this.getters, key, {
        get: () => {
          return getters[key](this.state);
        }
      })
    })
  }
}
Store.install = function (Vue) {
  Vue.mixin({
    beforeCreate() {
      if (this.$options.store) {
        Vue.prototype.$store = this.$options.store;
      }
    }
  });
}
```

## 测试

```html
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="ie=edge">
  <title>Vuex</title>
</head>

<body>
  <div id="app">
    Clicked: {{ this.$store.state.count }} times, count is {{ evenOrOdd }}.
    <button @click="increment">+</button>
    <button @click="decrement">-</button>
    <button @click="incrementIfOdd">Increment if odd</button>
    <button @click="incrementAsync">Increment async</button>
  </div>
  <script src='../../node_modules/vue/dist/vue.js'></script>
  <!-- <script src="https://unpkg.com/vue/dist/vue.js"></script> -->
  <script src="./yvuex.js"></script>

  <script>
    // store.js
    const state = {
      count: 0
    }
    const mutations = {
      increment(state) {
        state.count++
      },
      decrement(state) {
        state.count--
      }
    }
    const actions = {
      increment: ({
        commit
      }) => commit('increment'),
      decrement: ({
        commit
      }) => commit('decrement'),
      incrementIfOdd({
        commit,
        state
      }) {
        if ((state.count + 1) % 2 === 0) {
          commit('increment')
        }
      },
      incrementAsync({
        commit
      }) {
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            commit('increment')
            resolve()
          }, 1000)
        })
      }
    }
    const getters = {
      evenOrOdd: state => state.count % 2 === 0 ? 'even' : 'odd'
    }
    let store = new Store({
      state,
      getters,
      actions,
      mutations
    })
    Vue.use(Store)
    const app = new Vue({
      store,
      computed: {
        evenOrOdd() {
          return this.$store.getters.evenOrOdd
        }
      },
      methods: {
        increment() {
          this.$store.commit('increment')
          // this.$store.dispatch('increment')
        },
        decrement() {
          // this.$store.commit('decrement')
          this.$store.dispatch('decrement')
        },
        incrementIfOdd() {
          this.$store.dispatch('incrementIfOdd')
        },
        incrementAsync() {
          this.$store.dispatch('incrementAsync')
        },
      }
    }).$mount('#app')
  </script>
</body>

</html>
```

1. 点击increment 按钮->调用Vue实例中的increment 方法-->调用this.$store.commit -> 调用this.mutations.increment
2. 点击incrementAsync按钮->调用Vue实例中的incrementAsync方法-->调用this.$store.dispatch('incrementAsync')-> 调用this.actions.incrementAsync-->this.$store.commit-->调用this.mutations.increment
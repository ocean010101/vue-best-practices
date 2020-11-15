# 基于Proxy  响应化数据

## Proxy  

- 作用：用于定义基本操作的自定义行为（如属性查找、赋值、枚举、函数调用等）

- 定义：const p = new Proxy(target, handler)

- 参数：
  - target： 要使用 `Proxy` 包装的目标对象（可以是任何类型的对象，包括原生数组，函数，甚至另一个代理）。--要拦截的对象
  - handler： 一个通常以函数作为属性的对象，各属性中的函数分别定义了在执行各种操作时代理 `p` 的行为。--拦截行为

- 返回值：Proxy  实例

- 示例1：使用get handler， 定义对象p的读取操作

  当对象中不存在属性名时，默认返回值为 `37`。

  ```js
  const handler = {
      get: function(obj, prop) {
          return prop in obj ? obj[prop] : 37;
      }
  };
  
  const p = new Proxy({}, handler);
  p.a = 1;
  p.b = undefined;
  
  console.log(p.a, p.b);      // 1, undefined
  console.log('c' in p, p.c); // false, 37
  ```

  

- 示例2：使用set handler定义对象person 的set操作

  person.age 只能是整数且小于200

  ```js
  let validator = {
    set: function(obj, prop, value) {
      if (prop === 'age') {
        if (!Number.isInteger(value)) {
          throw new TypeError('The age is not an integer');
        }
        if (value > 200) {
          throw new RangeError('The age seems invalid');
        }
      }
  
      // The default behavior to store the value
      obj[prop] = value;
  
      // 表示成功
      return true;
    }
  };
  
  let person = new Proxy({}, validator);
  
  person.age = 100;
  
  console.log(person.age); 
  // 100
  
  person.age = 'young'; 
  // 抛出异常: Uncaught TypeError: The age is not an integer
  
  person.age = 300; 
  // 抛出异常: Uncaught RangeError: The age seems invalid
  ```



## 响应化数据--reactive()

实现原理： 

- 首先为了快速生成数据随想target的响应化对象，定义全局缓存， 

  toProxy 用于保存原始数据对象与响应化后的对象的映射关系

  toRaw 用于保存响应化后的对象与原始数据对象的映射关系

  ```js
  let toProxy = new WeakMap()
  let toRaw = new WeakMap()
  ```

- 响应化数据首先从缓存**toProxy** 中获取 **target数据对象**的 **响应化后的对象(observed)**，如果存在直接返回

  ```js
  let observed = toProxy.get(target)
  if (observed) {
  	return observed
  }
  ```

- 如果没有在缓存 **toProxy** 中 查找到**target数据对象**对应的**响应化后的对象(observed)**, 那么把target 作为响应化后的对象去toRaw中查找， 如果查找到， 说明 target 是其他原始数据对象的响应化后的对象， 那么直接返回target 即可

  ```js
  if (toRaw.get(target)) {
      return target
  }
  ```

- 如果在全局缓存toProxy  和 toRaw 中都没有查找到对象target， 那么调用new Proxy(target, baseHandle) 生成对象target的响应化后的对象observed

  ```
  observed = new Proxy(target, baseHandle)
  ```

- 将对象target 与响应化后的对象observed的映射关系保存到全局缓存 toProxy  和 toRaw 中

  ```js
  toProxy.set(target, observed)
  toRaw.set(observed, target)
  ```

- 最后返回对象target 响应化后的对象observed

  ```js
  return observed
  ```

- 实现：

  ```js
  /**
   * 响应化数据
   * @param {Object} target 
   * @returns {Proxy实例}
   */
  function reactive(target) {
    // 查询缓存
    // 在toProxy中查找target 响应化后的对象， 如果存在， 直接返回
    let observed = toProxy.get(target)
    if (observed) {
      return observed
    }
    // 在toRaw查找target 是否是其他原始数据对象的响应化后的对象， 如果是，直接返回target
    if (toRaw.get(target)) {
      return target
    }
    /**
     * 如果在全局缓存toProxy  和 toRaw 中都没有查找到对象target， 
     * 那么调用new Proxy(target, baseHandle) 生成对象target的响应化后的对象observed
     */
    observed = new Proxy(target, baseHandle)
    // 将对象target 与响应化后的对象observed的映射关系保存到全局缓存 toProxy  和 toRaw 中
    toProxy.set(target, observed)
    toRaw.set(observed, target)
    // 返回对象target 响应化后的对象observed
    return observed
  }
  ```

  

### baseHandle

`new Proxy(target, baseHandle) `要拦截target 对象，拦截 target 对象的行为在baseHandle 中定义

```js
// 响应式代理
const baseHandle = {
  get(target, key) {
    // 读取target[key]的值
    const val = Reflect.get(target, key)
    // 收集依赖
    track(target, key)
    // 递归子属性
    return typeof val === 'object' ? reactive(val) : val
  },
  set(target, key, val) {
    const info = { oldValue: target[key], newValue: val }
    // 在target 对象上设置属性key 的值为val
    // res： true or false
    const res = Reflect.set(target, key, val)
    // 触发更新依赖
    trigger(target, key, info)
    return res
  }
}
```

## 收集依赖--track()

当获取target[key] 时， 会触发target[key]  的getter， 触发依赖收集逻辑`track(target, key)`

实现原理:

- 创建当前应用的**响应化数据对象**依赖管理器， 管理对象中所有属性的依赖

  ```js
  let targetMap = new WeakMap()
  ```

- 在全局定义保存依赖的指定位置 ，用于存储未被收集的依赖(effect)

  effectStack的作用与vue2中 Dep.target作用相同

  ```js
  let effectStack = []
  ```

- 首先从**保存依赖的指定位置(effectStack)**获取**依赖（effect）**

  ```js
   const effect = effectStack[effectStack.length - 1]
  ```

- 如果可以从**保存依赖的指定位置(effectStack)**获取到**依赖(effect)**， 说明**数据target[key]** 正在被依赖执行获取值的操作，那么需要将target[key] 的依赖添加到**全局依赖管理器targetMap**中

  - 首先判断**全局依赖管理器targetMap**中是否存在**target 的依赖管理器**

    ```js
    let depMap = targetMap.get(target)
    ```

    - 如果**全局依赖管理器targetMap**中不存在**target 的依赖管理器depMap**， 那么需要创建**target对象 的依赖管理器depMap**并添加到targetMap中

      ```js
      if (depMap === undefined) {
          depMap = new Map()
          targetMap.set(target, depMap)
      }
      ```

  - 然后判断 **target 对象的依赖管理器depMap**中是否存在**target[key] 的依赖管理器**

    ```js
    let dep = depMap.get(key)
    ```

    - 如果**target 对象的依赖管理器 depMap** 中不存在**target[key] 的依赖管理器dep**， 那么需要创建**target[key]的依赖管理器dep** 并添加到 depMap 中

      ```js
      if (dep === undefined) {
          dep = new Set()
          depMap.set(key, dep)
      }
      ```

  - 如果target[key]的依赖管理器dep中没包含依赖effect， 那么需要将依赖effect 添加到target[key]的依赖管理器dep中

    ```js
    if (!dep.has(effect)) {
        // 双向存储
        dep.add(effect) // 把依赖effect 添加到target[key]的依赖列表中
        effect.deps.push(dep)
    }
    ```

  - 整体实现

    ```js
    // effectStack:用于存储未被收集的依赖(effect)
    let effectStack = []
    // 创建当前应用的【响应化数据对象】依赖管理器， 管理对象中所有属性的依赖
    let targetMap = new WeakMap()
    /**
     * 收集依赖
     * @param {Object} target 
     * @param {String} key 
     */
    function track(target, key) {
      const effect = effectStack[effectStack.length - 1]
      /**
       * 如果可以从【保存依赖的指定位置(effectStack)】 获取到【依赖(effect)】
       * 说明【数据target[key]】正在被依赖执行获取值的操作，
       * 那么需要将【target[key]】的【依赖(effect)】添加到【全局依赖管理器targetMap】中
       */
      if (effect) {
        // 从【全局依赖管理器targetMap】中获取【target的依赖管理器】
        let depMap = targetMap.get(target)
        /**
         * 如果【全局依赖管理器targetMap】中不存在【target的依赖管理器】
         * 那么需要创建【target对象的依赖管理器depMap】并添加到targetMap中
         */
        if (depMap === undefined) {
          depMap = new Map()
          targetMap.set(target, depMap)
        }
        // 从【target的依赖管理器depMap】中获取【target[key]的依赖管理器】
        let dep = depMap.get(key)
        /**
         * 如果【target的依赖管理器depMap】中不存在【target[key]的依赖管理器】
         * 那么需要创建【target[key]的依赖管理器dep】并添加到depMap中
         */
        if (dep === undefined) {
          dep = new Set()
          depMap.set(key, dep)
        }
        /**
         * 如果【target[key]的依赖管理器dep】中没包含【依赖effect】， 
         * 那么需要将【依赖effect】 添加到】target[key]的依赖管理器dep】中
         */
        if (!dep.has(effect)) {
          // 双向存储
          dep.add(effect) //把依赖effect 添加到target[key]依赖列表中
          effect.deps.push(dep)
        }
      }
    }
    ```

## 触发依赖--trigger()

当更新target[key] 时， 会触发target[key]  的setter， 触发通知依赖更新逻辑`trigger(target, key, info)`

实现原理:

- 首先从【全局依赖管理器targetMap】中获取【target的依赖管理器】

  ```js
  const depMap = targetMap.get(target)
  ```

  - 如果【全局依赖管理器targetMap】中不存在【target 的依赖管理器depMap】， 那么直接返回

    ```js
    if (depMap === undefined) {
        return
    }
    ```

- 如果参数key的值不为undefine， 说明要触发target[key]的依赖，那么需要从

  【target 对象的依赖管理器 depMap】 中获取【target[key] 的依赖列表deps】

  ```js
  let deps = depMap.get(key)
  ```

  - 然后遍历【target[key] 的依赖列表deps】， 依赖列表中依赖分为两种， 

    - 一种是在计算属性中使用target[key]的依赖， 用computed属性标识， 保存到computedRunners集合中
    - 一种是直接使用target[key] 的依赖--保存到effects中

    由于【带有computed属性的依赖】更新视图时，需要显示使用target[key]进行某种计算后的值，所以需要把这两种依赖分开， 然后先通知普通依赖更新视图， 然后再通知带有computed属性的依赖 更新视图

    ```js
      const effects = new Set() // 用于保存普通依赖
      const computedRunners = new Set() // 用于保存带有computed属性的依赖
      /**
       * 如果参数key的值不为undefine， 说明要触发target[key]的依赖，那么需要从
       * 【target 对象的依赖管理器 depMap】 中获取【target[key] 的依赖列表deps】
       */
      if (key) {
        // 从【target 对象的依赖管理器 depMap】 中获取【target[key] 的依赖列表deps】
        let deps = depMap.get(key)
        // 将依赖分类
        deps.forEach(effect => {
          // 如果依赖有computed属性, 把依赖添加到 computedRunners 中
          if (effect.computed) {
            computedRunners.add(effect)
          } else {
            // 依赖没有computed属性, 把依赖添加到 effects 中
            effects.add(effect)
          }
        })
      }
      /**
       * 由于【带有computed属性的依赖】更新视图时，需要显示使用target[key]进行某种计算后的值，而不是target[key]的值
       * 所以需要把这两种依赖分开， 然后先通知普通依赖更新视图， 然后再通知带有computed属性的依赖 更新视图
       */
      effects.forEach(effect => effect())
      computedRunners.forEach(computed => computed())
    ```

- 整体实现：

  ```js
  // 创建当前应用的【响应化数据对象】依赖管理器， 管理对象中所有属性的依赖
  let targetMap = new WeakMap()
  /**
   * 触发target 或 target[key]的依赖更新
   * @param {Object} obj 
   * @param {String} key 
   * @param {Object} info 
   */
  function trigger(target, key, info) {
    // 从【全局依赖管理器targetMap】中获取【target的依赖管理器】
    const depMap = targetMap.get(target)
    // 如果【全局依赖管理器targetMap】中不存在【target 的依赖管理器depMap】， 那么直接返回
    if (depMap === undefined) {
      return
    }
    const effects = new Set() // 用于保存普通依赖
    const computedRunners = new Set() // 用于保存带有computed属性的依赖
    /**
     * 如果参数key的值不为undefine， 说明要触发target[key]的依赖，那么需要从
     * 【target 对象的依赖管理器 depMap】 中获取【target[key] 的依赖列表deps】
     */
    if (key) {
      // 从【target 对象的依赖管理器 depMap】 中获取【target[key] 的依赖列表deps】
      let deps = depMap.get(key)
      // 将依赖分类
      deps.forEach(effect => {
        // 如果依赖有computed属性, 把依赖添加到 computedRunners 中
        if (effect.computed) {
          computedRunners.add(effect)
        } else {
          // 依赖没有computed属性, 把依赖添加到 effects 中
          effects.add(effect)
        }
      })
    }
    /**
     * 由于【带有computed属性的依赖】更新视图时，需要显示使用target[key]进行某种计算后的值，而不是target[key]的值
     * 所以需要把这两种依赖分开， 然后先通知普通依赖更新视图， 然后再通知带有computed属性的依赖 更新视图
     */
    effects.forEach(effect => effect())
    computedRunners.forEach(computed => computed())
  }
  ```

## 计算属性--computed

- 定义：computed(fn)

- 参数：

  - fn: Function 要执行的函数

- 返回值：计算属性对象Object，返回值如下：

  ```js
  {
      effect: runner,// 对runner()的引用
      get value() {
        // 获取计算属性的值
        return runner()
      }
  }
  ```

  返回值的属性effect  是对runner()的引用，当获取这个计算属性对象时， 触发以下函数执行

  ```js
  get value() {
      // 获取计算属性的值
      return runner()
  }
  ```

- 完整实现

  ```js
  /**
   * 特殊的effect
   * @param {Function} fn 
   */
  function computed(fn) {
    // 执行effect 得到依赖
    const runner = effect(fn, {
      computed: true,
      lazy: true
    })
    // 返回计算属性对象
    return {
      effect: runner,
      get value() {
        // 获取计算属性的值
        let val = runner()
        return val
      }
    }
  }
  ```

### runner

实现原理： runner是effect()的返回值

```js
const runner = effect(fn, {
    computed: true,
    lazy: true
})
```

### 总结

`computed(fn)`-->`effect(fn, { computed: true,lazy: true})`-->` let e = createReactiveEffect(fn, options)`

## 依赖--effect()

effect() 的作用：根据options 和fn描述依赖 对应vue2中的**watcher实例**

实现原理：

使用createReactiveEffect 生成描述依赖的实例

- 如果是普通依赖(options 为{}, 没有lazy属性), 那么要执行e()依赖更新视图, 
- 如果是在computed()中调用， 有 options.lazy， 直接返回依赖e即可

```js
/**
 * 生成依赖实例
 * @param {Function} fn 
 * @param {Object} options 
 * @returns {Function}
 */
function effect(fn, options = {}) {
  // 使用createReactiveEffect 生成描述依赖的实例
  let e = createReactiveEffect(fn, options)
  // 如果是普通依赖(options 为{}, 没有lazy属性), 那么直接执行依赖更新视图
  if (!options.lazy) {
    e()
  }
  // 返回依赖实例e
  return e
}
```

### createReactiveEffect

作用：描述依赖(创建effect实例)

实现原理：

​	创建一个函数， 给这个函数添加一些属性后返回。

```js
/**
 * 描述依赖(创建effect实例)
 * @param {Function} fn 
 * @param {Object} options 
 * @returns {Function}
 */
function createReactiveEffect(fn, options = {}) {
  // 描述依赖为一个函数
  const effect = function effect(...args) {
    // 调用effect()
    return run(effect, fn, args)
  }
  // 给依赖effect添加一些属性
  effect.deps = []
  effect.computed = options.computed
  effect.lazy = options.lazy
  // 返回依赖effect
  return effect
}
```

### 使用示例

#### 直接调用effect()

```js
effect(() => {
    // 数据变化会触发函数
    root.innerHTML = `<p>Clicked: ${obj.count}times, count is ${ evenOrOdd }</p>`
})
```

那么effect()参数fn 为：

```js
() => {
    // 数据变化会触发函数
    root.innerHTML = `<p>Clicked: ${obj.count}times, count is ${ evenOrOdd }</p>`
}
```

##### 1- 在effect()中执行`let e = createReactiveEffect(fn, options)`

生成结果e为：

```js
function effect(...args) {
    return run(effect, fn, args)
}
{
	deps: [],
	computed: undefined,
	lazy:undefined
}
```

##### 2- 执行e()

options.lazy 为undefined， 所以运行函数e，在函数e中调用run(effect, fn, args)

##### 3- 执行`run(effect, fn, args)`

​	将依赖effect 添加到effectStack 中， 然后执行fn

##### 4- effect() 返回这个结果e

#### 在computed()中调用effect()

```js
let evenOrOdd = computed(() => {
	return obj.count % 2 === 0 ? 'even' : 'odd'
})
```

##### 1- 在computed(fn) 中调用effect()

```js
function computed(fn) {
  // 执行effect 得到依赖
  const runner = effect(fn, {
    computed: true,
    lazy: true
  })
  // 返回计算属性对象
  // 。。。
}
```

那么effect()参数fn 为：

```js
() => {
	return obj.count % 2 === 0 ? 'even' : 'odd'
}
```

##### 2- 在effect()中执行`let e = createReactiveEffect(fn, options)`

生成结果e为：

```js
function effect(...args) {
    return run(effect, fn, args)
}
{
	deps: [],
	computed: true,
	lazy:true
}
```

##### 3- effect() 返回这个结果e

## 初始化/更新视图-run

实现原理：

如果依赖effect 没在 effectStack 中，那么

- 首先把依赖effect  添加到effectStack  中

- 然后执行fn 函数 `fn(...args)`

- fn中读取响应式数据的值， 触发数的getter， 触发依赖收集track()
- 在track()中将依赖effect添加到 数据 的依赖管理器中
- fn 函数执行完毕， js会把fn返回值保存到局部变量中 ， 然后跳到finally语句 中清理已经收集过的依赖（从effectStack 中把依赖移除），执行完finally语句后，执行return 
- run（）执行完毕

```js
/**
 * 初始化/更新视图
 * @param {Function} effect 
 * @param {Function} fn 
 * @param {*} args 
 */
function run(effect, fn, args) {
  // 如果【当前依赖effect】不在【保存依赖的指定位置(effectStack)】中，说明依赖没有被收集 
  if (effectStack.indexOf(effect) === -1) {
    try {
      // 将 【当前依赖effect】 添加到 【保存依赖的指定位置(effectStack)】中
      effectStack.push(effect)
      /**
       * 执行依赖的回调函数fn, 在fn中读取响应式数据，就会触发响应式数据的getter，
       * 进入依赖收集逻辑，把effectStack 中的依赖effect 收集到 targetMap依赖管理器中，
       * 执行完依赖收集逻辑后，【当前依赖effect】已经被收集完毕，那么需要把【当前依赖effect】从【保存依赖的指定位置(effectStack)】中 移除， 防止依赖重复收集
       *  */
      return fn(...args) // 执行【依赖effect】的回调函数fn
    } finally {
      // 【当前依赖effect】已经被收集完毕，那么需要把【当前依赖effect】从【保存依赖的指定位置(effectStack)】中 移除， 防止依赖重复收集
      effectStack.pop()
    }
  }
}
```

## 总结

```js
// proxy 实现响应式
// reateApp, reactive, watchEffect, computed
// 全局缓存
// 原始=>响应式
let toProxy = new WeakMap()
// 响应式=>原始
let toRaw = new WeakMap()
// effectStack:用于存储未被收集的依赖(effect)
let effectStack = []
// 创建当前应用的【响应化数据对象】依赖管理器， 管理对象中所有属性的依赖
let targetMap = new WeakMap()
/**targetMap 格式大概如下
 * obj.name, 
 * {
 *  target: deps: {key:[dep1, dep2]}
 * }
 */
//
/**
 * 收集依赖
 * @param {Object} target 
 * @param {String} key 
 */
function track(target, key) {
  const effect = effectStack[effectStack.length - 1]
  console.log('track effectStack=', effectStack);
  /**
   * 如果可以从【保存依赖的指定位置(effectStack)】 获取到【依赖(effect)】
   * 说明【数据target[key]】正在被依赖执行获取值的操作，
   * 那么需要将【target[key]】的【依赖(effect)】添加到【全局依赖管理器targetMap】中
   */
  if (effect) {
    // 从【全局依赖管理器targetMap】中获取【target的依赖管理器】
    let depMap = targetMap.get(target)
    /**
     * 如果【全局依赖管理器targetMap】中不存在【target的依赖管理器】
     * 那么需要创建【target对象的依赖管理器depMap】并添加到targetMap中
     */
    if (depMap === undefined) {
      depMap = new Map()
      targetMap.set(target, depMap)
    }
    // 从【target的依赖管理器depMap】中获取【target[key]的依赖管理器】
    let dep = depMap.get(key)
    /**
     * 如果【target的依赖管理器depMap】中不存在【target[key]的依赖管理器】
     * 那么需要创建【target[key]的依赖管理器dep】并添加到depMap中
     */
    if (dep === undefined) {
      dep = new Set()
      depMap.set(key, dep)
    }
    /**
     * 如果【target[key]的依赖管理器dep】中没包含【依赖effect】， 
     * 那么需要将【依赖effect】 添加到】target[key]的依赖管理器dep】中
     */
    if (!dep.has(effect)) {
      // 双向存储
      dep.add(effect) //把依赖effect 添加到target[key]依赖列表中
      effect.deps.push(dep)
    }
  }
}

/**
 * 触发target 或 target[key]的依赖更新
 * @param {Object} obj 
 * @param {String} key 
 * @param {Object} info 
 */
function trigger(target, key, info) {
  // 从【全局依赖管理器targetMap】中获取【target的依赖管理器】
  const depMap = targetMap.get(target)
  // 如果【全局依赖管理器targetMap】中不存在【target 的依赖管理器depMap】， 那么直接返回
  if (depMap === undefined) {
    return
  }
  const effects = new Set() // 用于保存普通依赖
  const computedRunners = new Set() // 用于保存带有computed属性的依赖
  /**
   * 如果参数key的值不为undefine， 说明要触发target[key]的依赖，那么需要从
   * 【target 对象的依赖管理器 depMap】 中获取【target[key] 的依赖列表deps】
   */
  if (key) {
    // 从【target 对象的依赖管理器 depMap】 中获取【target[key] 的依赖列表deps】
    let deps = depMap.get(key)
    // 将依赖分类
    deps.forEach(effect => {
      // 如果依赖有computed属性, 把依赖添加到 computedRunners 中
      if (effect.computed) {
        computedRunners.add(effect)
      } else {
        // 依赖没有computed属性, 把依赖添加到 effects 中
        effects.add(effect)
      }
    })
  }
  /**
   * 由于【带有computed属性的依赖】更新视图时，需要显示使用target[key]进行某种计算后的值，而不是target[key]的值
   * 所以需要把这两种依赖分开， 然后先通知普通依赖更新视图， 然后再通知带有computed属性的依赖 更新视图
   */
  effects.forEach(effect => effect())
  computedRunners.forEach(computed => computed())
}

/**
 * 描述依赖(创建effect实例)
 * @param {Function} fn 
 * @param {Object} options 
 * @returns {Function}
 */
function createReactiveEffect(fn, options = {}) {
  // 描述依赖为一个递归函数
  const effect = function effect(...args) {
    // 递归调用effect()
    return run(effect, fn, args)
  }
  // 给依赖effect添加一些属性
  effect.deps = []
  effect.computed = options.computed
  effect.lazy = options.lazy
  // 返回依赖effect
  return effect
}
/**
 * 初始化/更新视图
 * @param {Function} effect 
 * @param {Function} fn 
 * @param {*} args 
 */
function run(effect, fn, args) {
  // 如果【当前依赖effect】不在【保存依赖的指定位置(effectStack)】中，说明依赖没有被收集 
  if (effectStack.indexOf(effect) === -1) {
    try {
      // 将 【当前依赖effect】 添加到 【保存依赖的指定位置(effectStack)】中
      effectStack.push(effect)
      /**
       * 执行依赖的回调函数fn, 在fn中读取响应式数据，就会触发响应式数据的getter，
       * 进入依赖收集逻辑，把effectStack 中的依赖effect 收集到 targetMap依赖管理器中，
       * 执行完依赖收集逻辑后，【当前依赖effect】已经被收集完毕，那么需要把【当前依赖effect】从【保存依赖的指定位置(effectStack)】中 移除， 防止依赖重复收集
       *  */
      return fn(...args) // 执行【依赖effect】的回调函数fn
    } finally {
      // 【当前依赖effect】已经被收集完毕，那么需要把【当前依赖effect】从【保存依赖的指定位置(effectStack)】中 移除， 防止依赖重复收集      
      effectStack.pop()
    }
  }
}
/**
 * 生成依赖实例
 * @param {Function} fn 
 * @param {Object} options 
 * @returns {Function}
 */
function effect(fn, options = {}) {
  // 使用createReactiveEffect 生成描述依赖的实例
  let e = createReactiveEffect(fn, options)

  // 如果是普通依赖(options 为{}, 没有lazy属性), 那么直接执行依赖更新视图
  if (!options.lazy) {
    e()
  }
  // 返回依赖实例e
  return e
}

// 响应式代理
const baseHandle = {
  get(target, key) {
    // 读取target[key]的值
    const val = Reflect.get(target, key)
    // 收集依赖
    track(target, key)
    // 递归子属性
    return typeof val === 'object' ? reactive(val) : val
  },
  set(target, key, val) {
    const info = { oldValue: target[key], newValue: val }
    // 在target 对象上设置属性key 的值为val
    // res： true or false
    const res = Reflect.set(target, key, val)
    // 触发更新依赖
    trigger(target, key, info)
    return res
  }
}
/**
 * 响应化数据
 * @param {Object} target 
 * @returns {Proxy实例}
 */
function reactive(target) {
  // 查询缓存
  // 在toProxy中查找target 响应化后的对象， 如果存在， 直接返回
  let observed = toProxy.get(target)
  if (observed) {
    return observed
  }
  // 在toRaw查找target 是否是其他原始数据对象的响应化后的对象， 如果是，直接返回target
  if (toRaw.get(target)) {
    return target
  }
  /**
   * 如果在全局缓存toProxy  和 toRaw 中都没有查找到对象target， 
   * 那么调用new Proxy(target, baseHandle) 生成对象target的响应化后的对象observed
   */
  observed = new Proxy(target, baseHandle)
  // 将对象target 与响应化后的对象observed的映射关系保存到全局缓存 toProxy  和 toRaw 中
  toProxy.set(target, observed)
  toRaw.set(observed, target)
  // 返回对象target 响应化后的对象observed
  return observed
}

/**
 * 特殊的effect
 * @param {Function} fn 
 */
function computed(fn) {
  // 执行effect 得到依赖
  const runner = effect(fn, {
    computed: true,
    lazy: true
  })
  // 返回计算属性对象
  return {
    effect: runner,
    get value() {
      // 获取计算属性的值
      let val = runner()
      return val
    }
  }
}
```



## 测试

```html
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>YVue3</title>
</head>

<body>
  <div id="app"></div>
  <button id="btn">+1</button>
  <script src="./yvue3.js"></script>
  <script>
    const data = {
      count: 0
    }
    const obj = reactive(data)

    let evenOrOdd = computed(() => {
      return obj.count % 2 === 0 ? 'even' : 'odd'
    })
    const root = document.getElementById('app')
    effect(() => {
      // 数据变化会触发函数
      root.innerHTML = `<p>Clicked: ${obj.count}times, count is ${evenOrOdd.value}</p>`
    })
    const btn = document.getElementById('btn')
    btn.addEventListener('click', () => {
      obj.count += 1
    }, false)
  </script>

</body>

</html>
```

## 初始化

- 首先执行`reactive(data)` 将数据data 响应化

  响应化后targetMap 的值为{}

  effectStack值为[]

- 然后定义计算属性evenOrOdd，evenOrOdd 的值为执行computed()的返回值

### computed() 使用示例解析

```js
/**
 * 特殊的effect
 * @param {Function} fn 
 */
function computed(fn) {
  // 执行effect 得到依赖
  const runner = effect(fn, {
    computed: true,
    lazy: true
  })
  // 返回计算属性对象
  return {
    effect: runner,
    get value() {
      // 获取计算属性的值
      let val = runner()
      return val
    }
  }
}

```

使用示例：

```js
let evenOrOdd = computed(() => {
	return obj.count % 2 === 0 ? 'even' : 'odd'
})
```

那么computed()的参数fn 为：

```js
() => {
	return obj.count % 2 === 0 ? 'even' : 'odd'
}
```

#### 1.执行effect() ， 获取返回值

在 computed()中执行effect() ， 把它effect()的返回值保存到变量runner中

```js
const runner = effect(fn, {
    computed: true,
    lazy: true
})
```

effect() 代码如下：

```js
function effect(fn, options = {}) {
  // 使用createReactiveEffect 生成描述依赖的实例
  let e = createReactiveEffect(fn, options)
  // 如果是普通依赖(options 为{}, 没有lazy属性), 那么直接执行依赖更新视图
  if (!options.lazy) {
    e()
  }
  // 返回依赖实例e
  return e
}
```

在effect()  中执行createReactiveEffect(fn, options) 得到以下结果：

```js
function effect(...args) {
    return run(effect, fn, args)
}
```

这个结果有以下属性

```
{
	deps: [],
	computed: true,
	lazy:true
}
```

参数options 存在， 所以直接返回createReactiveEffect(fn, options)的返回值

runner的值如下：

```js
function effect(...args) {
    return run(effect, fn, args)
}
{
	deps: [],
	computed: true,
	lazy:true
}
```

#### 2.返回计算属性对象

computed()返回值如下：

```js
return {
    effect: runner,
    get value() {
        // 获取计算属性的值
        let val = runner()
        return val
    }
}
```



### effect()使用示例解析

```js
effect(() => {
    // 数据变化会触发函数
    root.innerHTML = `<p>Clicked: ${obj.count}times, count is ${ evenOrOdd }</p>`
})
```

那么effect()的参数**fn** 为：

```js
() => {
    // 数据变化会触发函数
    root.innerHTML = `<p>Clicked: ${obj.count}times, count is ${ evenOrOdd }</p>`
}
```

effect() 代码如下：

```js
function effect(fn, options = {}) {
  // 使用createReactiveEffect 生成描述依赖的实例
  let e = createReactiveEffect(fn, options)
  // 如果是普通依赖(options 为{}, 没有lazy属性), 那么直接执行依赖更新视图
  if (!options.lazy) {
    e()
  }
  // 返回依赖实例e
  return e
}
```

在effect()  中执行createReactiveEffect(fn, options) 得到结果e：

```js
function effect(...args) {
    return run(effect, fn, args)
}
```

这个结果有以下属性

```
{
	deps: [],
	computed: undefined,
	lazy:undefined
}
```

options.lazy 为undefined， 所以运行函数e，在函数e中调用run(effect, fn, args)

run()代码如下：

```js
function run(effect, fn, args) {
  // 如果【当前依赖effect】不在【保存依赖的指定位置(effectStack)】中，说明依赖没有被收集 
  if (effectStack.indexOf(effect) === -1) {
    try {
      // 将 【当前依赖effect】 添加到 【保存依赖的指定位置(effectStack)】中
      effectStack.push(effect)
      /**
       * 执行依赖的回调函数fn, 在fn中读取响应式数据，就会触发响应式数据的getter，
       * 进入依赖收集逻辑，把effectStack 中的依赖effect 收集到 targetMap依赖管理器中，
       * 执行完依赖收集逻辑后，【当前依赖effect】已经被收集完毕，那么需要把【当前依赖effect】从【保存依赖的指定位置(effectStack)】中 移除， 防止依赖重复收集
       *  */
      return fn(...args) // 执行fn
    } finally {
      // 【当前依赖effect】已经被收集完毕，那么需要把【当前依赖effect】从【保存依赖的指定位置(effectStack)】中 移除， 防止依赖重复收集
      effectStack.pop()
    }
  }
}
```

effectStack 为 [], effectStack  中没有effect，先把effect 添加到effectStack 中， 然后执行fn

```js
() => {
    // 数据变化会触发函数
    root.innerHTML = `<p>Clicked: ${obj.count}times, count is ${ evenOrOdd }</p>`
}
```

在fn中读取obj.count 和 evenOrOdd ， 那么首先获取obj.count的值触发obj.count  的getter 进行依赖收集， 然后获取evenOrOdd的值触发evenOrOdd的getter 进行依赖收集。两个值都获取后fn 才执行完毕

#### obj.count依赖收集

在obj.count  的getter 中调用track()收集依赖， 当前effectStack 中有一个依赖， 把这个依赖添加到obj.count 的依赖管理中。

targetMap 的值如下：

```js
{
    // 0: {Object => Map(1)}
    [ 
        {
            {count: 0}:[
        		"count" : [ 
        			function effect(...args) { // computed: undefined, lazy: undefined
                        // 递归调用effect()
                        return run(effect, fn, args)
                    }       
                  ]
    		]
		}
    ]
}
```

obj.count依赖收集 完成后，**fn函数还没有执行完**，还要获取venOrOdd的值， 触发evenOrOdd依赖收集

#### evenOrOdd依赖收集

获取evenOrOdd的值， 触发evenOrOdd  的getter(), 会运行以下代码：

```js
get value() {
    // 获取计算属性的值
    let val = runner()
    return val
}
```

运行runner()

```js
function effect(...args) {
    return run(effect, fn, args)
}
{
	deps: [],
	computed: undefined,
	lazy:undefined
}
```

runner() 的参数fn 为：

```js
() => {
      return obj.count % 2 === 0 ? 'even' : 'odd'
}
```

这时effectStack  的值为：

```js
[
    function effect(...args) { // computed: undefined, lazy: undefined
    // 递归调用effect()
    return run(effect, fn, args)
    },  
]
```

当前依赖（参数effect）没有在effectStack  中，那么把依赖添加到effectStack 中

effectStack 的值为：

```js
[
    function effect(...args) { // computed: undefined, lazy: undefined
        // 递归调用effect()
        return run(effect, fn, args)
    },  
    function effect(...args) { // computed: true, lazy: true
        // 递归调用effect()
        return run(effect, fn, args)
    }    
]
```

然后执行fn，在fn中读取obj.count ，触发obj.count 的getter 进行依赖收集， 依赖收集完成后targetMap 的值如下：

```js
{
    // 0: {Object => Map(1)}
    [ 
        {
            {count: 0}:[
        		"count" : [ 
        			function effect(...args) { // computed: undefined, lazy: undefined
                        // 递归调用effect()
                        return run(effect, fn, args)
                    },  
        			function effect(...args) { // computed: true, lazy: true
                        // 递归调用effect()
                        return run(effect, fn, args)
                    }         
                  ]
    		]
		}
    ]
}
```

​	依赖收集完成后，由于当前obj.count 的值为0 ， 所以执行fn得到的值为'even’ ，fn执行完毕， js会把fn的返回值保存到局部变量中 ， 然后跳到finally语句 中清理已经收集过的依赖（从effectStack 中把依赖移除），执行完finally语句后，返回之前保存在局部变量表里的值也就是'even', 那么现在evenOrOdd的值为‘even’

现在effectStack 的值为：

```js
[
    function effect(...args) { // computed: true, lazy: true
        // 递归调用effect()
        return run(effect, fn, args)
    }    
]
```

然后回到下面这个函数中

```js
() => {
    // 数据变化会触发函数
    root.innerHTML = `<p>Clicked: ${obj.count}times, count is ${ evenOrOdd }</p>`
}
```

这个函数执行完毕， 由于它 没有返回值， 那么直接跳到finally语句 中清理已经收集过的依赖（从effectStack 中把依赖移除），执行完finally语句后， 执行return， run 函数执行完毕， 视图已经渲染。

effectStack 的值为[]

refer:

无论try里执行了return语句、break语句、还是continue语句，finally语句块还会继续执行。

当try和finally里都有return时，会忽略try的return，而使用finally的return。

## 更新

在视图上改变 obj.count 的值， 会触发 obj.count  的getter， 然后执行trigger() , 从targetMap 中获取obj.count 的依赖列表， 然后通知依赖列表中的所有依赖进行更新。
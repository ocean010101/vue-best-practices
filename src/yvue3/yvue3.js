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


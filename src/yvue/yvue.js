class YVue {
  constructor(options) {
    // 1. 处理选项options
    this.$options = options; // $ 与外部变区分
    // 2. 数据响应化
    this.$data = options.data;
    this.observe(this.$data);
    // 3. 模板编译
    new Compile(options.el, this);
    // 4. 执行生命周期钩子
    if (options.created) {
      options.created.call(this);
    }
  }
  /**
   * 使传递进来的对象响应化
   * @param {Object} value 
   */
  observe(value) {
    // console.log('observe value=', value);
    if (!value || typeof value !== 'object') {
      return;
    }
    // 将value 中所有属性转换成getter/setter的形式
    Object.keys(value).forEach(key => {
      // 对key做响应式处理， 将属性转换成getter/setter的形式
      this.defineReactive(value, key, value[key])
      //app.$data.test ==> app.test 代理
      this.proxyData(key);
    })
  }
  /**
   * 将obj[key]属性转换成getter/setter的形式 
   * @param {Object} obj 
   * @param {*} key 
   * @param {*} val 
   */
  defineReactive(obj, key, val) {
    if (typeof val === 'object') {
      // 递归侦测所有key
      this.observe(val);
    }

    // 创建Dep实例：Dep和key一对一对应
    const dep = new Dep();
    // 给obj定义属性
    Object.defineProperty(obj, key, {
      get() {
        // 收集依赖到Dep
        // 将Dep.target指向的Watcher实例加入到Dep中
        Dep.target && dep.depend()
        // 返回obj[key]的值
        return val
      },
      set(newVal) {
        if (newVal !== val) {
          // 设置新值
          val = newVal
          // 通知依赖更新
          dep.notify()
        }
      }
    })
  }
  /**
   * 代理到vm，在vue根上定义属性代理data中的数据
   * @param {*} key 
   */
  proxyData(key) {
    Object.defineProperty(this, key, {
      get() {
        return this.$data[key];
      },
      set(newVal) {
        this.$data[key] = newVal;
      }
    });
  }
}

// Dep:管理若干watcher实例，dep和key一对一关系
class Dep {
  constructor() {
    // 用来保存依赖(Watcher实例)
    this.subs = []
  }
  // 将依赖(Watcher实例) 添加到this.subs 数组中
  /**
   * 
   * @param {Watcher实例} sub 
   */
  addSub(sub) {
    this.subs.push(sub)
  }
  // 依赖收集
  depend() {
    if (Dep.target) {
      Dep.target.addDep(this)
    }
  }
  // 触发依赖进行更新
  notify() {
    const subs = this.subs.slice()
    console.log('notify subs=', subs);
    for (let i = 0, l = subs.length; i < l; i++) {
      subs[i].update() // 通知watcher进行更新
    }
  }
}
// 全局唯一的指定位置
Dep.target = null
// 保存ui中依赖，实现update函数更新
class Watcher {
  constructor(vm, key, cb) {
    this.vm = vm // Watcher有一个 vm 属性，表明它是属于哪个组件的
    this.key = key
    this.cb = cb
    this.value = this.get()
  }

  get() {
    // 将当前实例指向Dep.target
    Dep.target = this
    let value = this.vm[this.key];// 读一次key触发getter
    Dep.target = undefined
    return value
  }

  update() {
    const oldValue = this.value
    this.value = this.get()
    this.cb.call(this.vm, this.value, oldValue)
    // this.cb.call(this.vm, this.vm[this.key])
  }
  /**
   *  调用dep的addSub()将当前watcher实例添加到dep中
   * @param {Dep} dep 
   */
  addDep(dep) {
    dep.addSub(this)
  }
}
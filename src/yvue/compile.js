/**
 * 编译模板
 * 处理模板中插值表达式， 指令y-xx, 事件@xx
 */
class Compile {
  constructor(el, vm) {
    this.$vm = vm;
    // 找到挂载目标
    this.$el = document.querySelector(el);
    if (this.$el) {
      //1. 提取宿主中模板内容到Fragment标签，dom操作会提高效率
      this.$fregment = this.node2Fregment(this.$el);
      console.log('this.$fregment = ', this.$fregment);
      //2. 编译模板内容，同时进行依赖收集
      this.compile(this.$fregment);
      console.log("after compile", this.$fregment);

      //3. 将编译结果追加至数组中-挂载
      this.$el.appendChild(this.$fregment);
    }
  }

  /**
   * 遍历el, 把里面的内容搬到一个fragment
   * @param {HTMLElement} el 
   */
  node2Fregment(el) {
    // 创建一个虚拟的节点对象，节点对象包含所有属性和方法。
    const fregment = document.createDocumentFragment();

    let child;
    while ((child = el.firstChild)) { // 像链表的->next
      //由于appendChild是移动操作
      fregment.appendChild(child);
    }
    return fregment;
  }
  /**
   * 编译模板,同时进行依赖收集,替换插值表达式，处理指令和事件
   * @param {DocumentFragment} el 
   */
  compile(el) {
    //遍历el， 拿出所有child
    const childNodes = el.childNodes;
    Array.from(childNodes).forEach(node => {
      if (this.isElement(node)) { // 元素节点
        console.log('编译元素' + node.nodeName);
        // 如果是元素节点， 要处理指令y-xxx, 事件@xx
        this.compileElement(node);
      } else if (this.isInterpolation(node)) { // 插值
        console.log('编译文本' + node.textContent);
        this.compileTextNode(node);
      }
      //递归子元素
      if (node.childNodes && node.childNodes.length > 0) {
        this.compile(node);
      }
    });
  }
  /**
   * 判断是否是元素节点
   * @param {*} node 
   */
  isElement(node) {
    return node.nodeType === 1;
  }

  /**
   * 判断是否是插值
   * @param {*} node 
   */
  isInterpolation(node) {
    return node.nodeType === 3 && /\{\{(.*)\}\}/.test(node.textContent);
  }

  /**
   * 编译元素节点
   * @param {*} node 
   */
  compileElement(node) {
    // 查看node的特性中是否有指令y-xx 和事件 @xx
    const nodeAttrs = node.attributes;
    Array.from(nodeAttrs).forEach(attr => {
      //获取属性的名称和值 y-text="abc"
      const attrName = attr.name;
      const exp = attr.value;
      //指令: y-xx
      if (attrName.indexOf('y-') === 0) {
        const dir = attrName.substring(2);//text
        //执行指令对应的函数
        this[dir] && this[dir](node, this.$vm, exp);
      } else if (attrName.indexOf('@') === 0) {
        //事件 @click = "hadleClick"
        const eventName = attrName.substring(1);//click
        //exp : hadleClick
        this.eventHandler(node, this.$vm, exp, eventName);
      }
    })
  }

  eventHandler(node, vm, exp, eventName) {
    //获取回调函数
    const fn = vm.$options.methods && vm.$options.methods[exp];
    if (eventName && fn) {
      node.addEventListener(eventName, fn.bind(vm)); //绑定当前组件实例
    }
  }
  /**
   * y-text
   * @param {*} node 
   * @param {YVue} vm ：YVue实例
   * @param {*} exp  : 表达式
   */
  text(node, vm, exp) {
    this.update(node, vm, exp, 'text');
  }
  textUpdator(node, value) {
    node.textContent = value;
  }

  /**
   * y-model： 双向数据的绑定
   * @param {*} node 
   * @param {YVue} vm ：YVue实例
   * @param {*} exp  : 表达式eg： y-model="name" ==> exp 为 'name'
   */
  model(node, vm, exp) {
    // 数值变了更新视图: data -> view
    this.update(node, vm, exp, 'model');
    // 在上视图改变数值，view -> data 
    node.addEventListener('input', e => {
      vm[exp] = e.target.value;
    });
  }
  modelUpdator(node, value) {
    node.value = value;
  }

  /**
   * y-html
   * @param {*} node 
   * @param {YVue} vm ：YVue实例
   * @param {*} exp  : 表达式
   */
  html(node, vm, exp) {
    this.update(node, vm, exp, 'html');
  }
  htmlUpdator(node, value) {
    node.innerHTML = value;
  }

  /**
   * 把插值表达式替换为实际的内容
   * @param {*} node 
   */
  compileTextNode(node) {
    //获取正则表达式中匹配的内容
    //{{xxx}} RegExp.$1 是匹配分组的部分
    console.log('compileTextNode RegExp.$1=', RegExp.$1);
    //node.textContent = this.$vm[RegExp.$1];
    const exp = RegExp.$1;
    this.update(node, this.$vm, exp, 'text');
  }

  /**
   * new Vue({
   *  data: {
   *    name: 'ocean'
   *  }
   * })
   * 那么 exp为name
   * vm[exp]为'ocean'
   * @param {*} node 
   * @param {YVue} vm ：YVue实例
   * @param {*} exp  : 表达式
   * @param {String} dir :text, html, model
   */
  update(node, vm, exp, dir) {
    // dir：text ==> fn: textUpdator
    const fn = this[dir + 'Updator'];
    fn && fn(node, vm[exp]);
    // 依赖收集：创建Watcher，触发依赖收集流程， 将当前Watcher 收集到模板中获取的数据的dep 中
    new Watcher(vm, exp, function () {
      // 在监听exp的回调函数中调用 指令的更新函数
      fn && fn(node, vm[exp]);
    })
  }
}
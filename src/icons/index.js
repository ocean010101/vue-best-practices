import Vue from 'vue'
import SvgIcon from '@/components/SvgIcon.vue'

// 全局注册SvgIcon组件
Vue.component('svg-icon', SvgIcon)
// 自动加载所有图标
const req = require.context('./svg', false, /\.svg$/)
req.keys().map(req);
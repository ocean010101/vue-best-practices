<template>
  <div id="app">
    <div>
      <router-link to="/">home</router-link>&nbsp;
      <router-link to="/about">about</router-link>
    </div>
    <router-view></router-view>
    <!-- <svg-icon icon-class="auto"></svg-icon> -->
  </div>
</template>

<script>

export default {
  // name: 'app',
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>

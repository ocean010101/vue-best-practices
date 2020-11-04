// resolve定义一个绝对路径获取函数
const path = require('path')
const bodyParser = require("body-parser");

function resolve(dir) {
  return path.join(__dirname, dir)
}

const port = 7070;
const title = "vue项目最佳实践";
module.exports = {
  publicPath: '/best-practice', // 部署应用包时的基本 URL
  devServer: {
    port: port,
    before: app => {
      // node服务器代码 基于express
      // bodyPaser用来解析post请求中的json数据
      app.use(bodyParser.json());
      // app.use(
      //   bodyParser.urlencoded({
      //     extended: true
      //   })
      // );
      //登录接口声明
      app.post("/dev-api/user/login", (req, res) => {
        const { username } = req.body;

        if (username === "admin" || username === "editor") {
          res.json({
            code: 1,
            data: username
          });
        } else {
          res.json({
            code: 10204,
            message: "用户名或密码错误"
          });
        }
      });

      app.get("/dev-api/user/info", (req, res) => {
        // 从请求头中获取令牌
        // adfasdfkadf; ja;kdfj;akdfjakdsfj;akjdf; akjdf;kalsjf;ajf
        // 令牌头         令牌体                     哈希
        // 加密算法        用户信息；有效期          
        const roles = req.headers['x-token'] === "admin" ? ["admin"] : ["editor"];
        res.json({
          code: 1,
          data: roles
        });
      });
    }
  },
  configureWebpack: {
    // 向index.html注入标题
    name: title
  },
  chainWebpack: config => {
    // 配置svg规则排除icons目录中svg文件处理
    config.module
      .rule("svg")
      .exclude.add(resolve("src/icons"))
      .end();
    // 新增icons规则，设置svg-sprite-loader处理icons目录中的svg
    config.module
      .rule("icons")
      .test(/\.svg$/)
      .include.add(resolve("src/icons"))
      .end()
      .use("svg-sprite-loader")
      .loader("svg-sprite-loader")
      .options({ symbolId: "icon-[name]" })
      .end();
  },
}; 
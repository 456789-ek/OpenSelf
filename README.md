# Openself

个人学习笔记、项目和奖项。静态页面，用浏览器打开 `index.html` 即可，GitHub Pages 直接发布仓库根目录，不需要构建服务器。

首页是缓慢漂移的宽银河：亮核偏在一侧，暗尘带把星云切成光河，近处少数大星带有光晕，鼠标移动时近星比远星位移更大。系统开启减少动态效果时银河保持静止。`openself` 仍用 React Bits 的 ParticleText（JavaScript + CSS）。银河脚本是 `js/sky.js`。三张入口卡片（笔记、项目、奖项）在 `js/bento.js`，效果对齐 React Bits MagicBento：聚光、边框光、悬停星粒和点击涟漪。已构建的粒子脚本是 `js/openself-particle.js`，GitHub Pages 直接使用它。源组件在 `components/ParticleText.jsx`，安装命令是 `npx shadcn@latest add @react-bits/ParticleText-JS-CSS`。改完标题挂载或粒子组件后运行 `npm run build:title`，把生成的脚本一并提交。

- `index.html` 首页
- `notes.html` 笔记页
- `projects.html` 项目页
- `awards.html` 奖项页
- `css/system.css` 内页可以共用的视觉系统
- `css/home.css` 首页与内页版式
- `js/home.js` 页面交互和镜头移动
- `js/sky.js` 首页银河
- `js/bento.js` 首页三张卡片

笔记、项目和奖项正文还没写，页面上的空位会等内容补上。

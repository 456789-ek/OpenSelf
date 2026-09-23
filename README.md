# Openself

个人学习笔记和项目介绍。静态页面，用浏览器打开 `index.html` 即可，GitHub Pages 直接发布仓库根目录，不需要构建服务器。

首页是夜空，`openself` 仍用 React Bits 的 ParticleText（JavaScript + CSS）。星空脚本是 `js/sky.js`。已构建的粒子脚本是 `js/openself-particle.js`，GitHub Pages 直接使用它。源组件在 `components/ParticleText.jsx`，安装命令是 `npx shadcn@latest add @react-bits/ParticleText-JS-CSS`。改完标题挂载或粒子组件后运行 `npm run build:title`，把生成的脚本一并提交。

- `index.html` 首页
- `notes.html` 笔记页
- `projects.html` 项目页
- `css/system.css` 笔记页可以共用的视觉系统
- `css/home.css` 首页版式
- `js/home.js` 页面交互
- `js/sky.js` 首页夜空

笔记和项目正文还没写，页面上的空位会等内容补上。

# 图片和视频资源

将截图、GIF、演示视频等文件放在此目录下。

## 目录结构

```
public/
├── images/           ← 截图和图片
│   ├── demo-*.png    ← 效果演示截图
│   └── card-author-*.png ← 卡作者指南截图
├── videos/           ← 演示视频
│   └── demo-*.mp4
└── logo.svg          ← 站点 Logo
```

## 在文档中引用

```markdown
<!-- 图片 -->
![描述文字](../public/images/文件名.png)

<!-- 视频 -->
<video src="../public/videos/文件名.mp4" controls />
```

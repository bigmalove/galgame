# 控制台命令

## window.galgame 全局对象

插件会在浏览器的 `window.galgame` 上暴露调试接口。按 `F12` 打开控制台即可使用。

## 全局导出对象

```javascript
window.galgame.LipSyncManager  // 口型同步管理器
window.galgame.Live2DManager    // Live2D 管理器
window.galgame.TTSManager       // TTS 语音管理器
window.galgame.BGMManager       // BGM 背景音乐管理器
window.galgame.effects          // 特效控制接口
```

::: info 兼容性
上述对象也同时挂载在 `window` 上（如 `window.Live2DManager`），以兼容旧版调用方式。
:::

## 特效控制

```javascript
// 查看帮助
galgame.effects.help()

// 预加载特效资源
galgame.effects.preload()

// 播放特效
galgame.effects.play('rain')
galgame.effects.play('snow')
galgame.effects.play('cherryBlossoms')

// 执行特效操作序列
galgame.effects.run([
  { action: 'perform', name: 'rain' },
  { action: 'perform', name: 'fog' },
])

// 清除所有特效
galgame.effects.clear()

// 启用/禁用特效系统
galgame.effects.enable(true)   // 启用
galgame.effects.enable(false)  // 禁用

// 设置画质等级
galgame.effects.quality('high')
galgame.effects.quality('balanced')  // 默认
galgame.effects.quality('mobile')

// 设置并发上限 (1-6)
galgame.effects.maxActive(3)

// 查看当前状态
galgame.effects.state()
// 返回: { effectsEnabled, effectsQuality, effectsAutoClearOnSceneChange, effectsMaxActive }
```

## Live2D 管理

```javascript
// 访问 Live2D 管理器
galgame.Live2DManager
```

## TTS 管理

```javascript
// 访问 TTS 管理器
galgame.TTSManager

// 停止当前播放
galgame.TTSManager.stop()
```

## BGM 管理

```javascript
// 访问 BGM 管理器
galgame.BGMManager

// 播放
galgame.BGMManager.play('歌曲名')

// 暂停/恢复
galgame.BGMManager.pause()
galgame.BGMManager.resume()

// 设置音量 (0-1)
galgame.BGMManager.setVolume(0.5)
```

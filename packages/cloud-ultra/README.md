# @b-map-viewer/cloud-ultra

面向 Cesium 的世界空间 Ultra 体积云，支持多层云、三维噪声、大气散射、级联云阴影和时间抗锯齿。

## 安装

```bash
npm install @b-map-viewer/cloud-ultra cesium
```

本包可以与 `b-map-viewer` 配合使用，也可以直接用于已有 Cesium Viewer，不依赖 Vue 或 `b-map-viewer`。

## 使用

```js
import { CloudUltraEffect } from '@b-map-viewer/cloud-ultra'

if (!CloudUltraEffect.isSupported(viewer)) {
  throw new Error('当前设备不支持 Ultra 体积云')
}

const cloud = new CloudUltraEffect(viewer, {
  coverage: 0.3,
  windSpeed: 10,
  temporalUpscale: true,
  perfOptimize: true,
  onProgress: (percent) => console.log(`资源准备 ${percent}%`),
})

try {
  await cloud.readyPromise
  cloud.setOptions({ coverage: 0.45 })
} catch (error) {
  cloud.destroy()
  throw error
}
// 退出场景：cloud.destroy()
```

按需加载：`const { CloudUltraEffect } = await import('@b-map-viewer/cloud-ultra')`。

资源随本包提供，首次创建时自动加载，无需指定资源路径、复制文件或安装专用 Vite 插件。应用仍需正常配置 Cesium 运行时资源，例如使用 `vite-plugin-cesium`。需要 WebGL 2 与浮点渲染目标支持。

## 生命周期

- `setOptions(options)` / `getOptions()`：更新、查询参数。
- `show()` / `hide()`：显示、暂停效果；暂停时保留 GPU 资源。
- `remove()` / `load(options?)`：释放、重新加载效果。
- `destroy()`：永久释放管线、纹理和 Worker；同一场景最多一个 Ultra 实例。

UMD 全局入口为 `BMapViewerCloudUltra.CloudUltraEffect`，使用时先加载 Cesium；部署需保持 `dist/assets` 与入口脚本的相对目录关系。

[完整文档](https://banyan666.github.io/BMapViewer/docs/weather/cloud-ultra) · [在线示例](https://banyan666.github.io/BMapViewer/#/weather)

## License

项目代码为 Apache-2.0。第三方资源的许可与来源完整收录在发布包的 `dist/NOTICE` 中。

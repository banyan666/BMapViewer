import { ungzip } from 'pako'

// npm 资源是独立的延迟加载 JS 模块，普通打包器可自动处理，无需复制文件或插件。
// 解压后的临时 Blob URL 只保留至纹理上传完成，取消/失败时也会释放。
export function decodeCloudUltraResources(data) {
  const urls = {}
  let released = false
  const release = () => {
    if (released) return
    released = true
    Object.values(urls).forEach((url) => URL.revokeObjectURL(url))
  }
  try {
    for (const [key, encoded] of Object.entries(data)) {
      const compressed = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0))
      const bytes = ungzip(compressed)
      urls[key] = URL.createObjectURL(new Blob([bytes], { type: key === 'worker' ? 'application/javascript' : 'application/octet-stream' }))
    }
    return { urls: Object.freeze(urls), release }
  } catch (error) { release(); throw error }
}

export function waitForCloudUltraResources(task, signal) {
  return new Promise((resolve, reject) => {
    const cancel = () => reject(signal.reason)
    if (signal.aborted) cancel()
    else signal.addEventListener('abort', cancel, { once: true })
    Promise.resolve(task).then((resources) => {
      signal.removeEventListener('abort', cancel)
      if (signal.aborted) resources.release()
      else resolve(resources)
    }, (error) => { signal.removeEventListener('abort', cancel); reject(error) })
  })
}

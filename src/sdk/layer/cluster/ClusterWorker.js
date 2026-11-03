import { computeScreenGrid, SCREEN_GRID_WORKER_SOURCE } from './screenGrid.js'

/** One active job plus one latest pending request. Old data/view results never replace newer ones. */
export default class ClusterWorker {
  constructor(onResult) {
    this.onResult = onResult
    this.epoch = 0
    this.sequence = 0
    this.running = false
    this.ready = false
    this.destroyed = false
    this.latest = null
    this.store = null
    this.worker = null
    this.url = null
    this.timer = null
    if (typeof Worker !== 'undefined') {
      try {
        this.url = URL.createObjectURL(new Blob([SCREEN_GRID_WORKER_SOURCE], { type: 'application/javascript' }))
        this.worker = new Worker(this.url)
        this.worker.onmessage = (event) => this.receive(event.data)
        this.worker.onerror = (event) => { event.preventDefault?.(); this.fallback() }
        this.worker.onmessageerror = () => this.fallback()
      } catch { this.fallback() }
    }
  }

  setData(store) {
    if (this.destroyed) return
    this.epoch++
    this.sequence++
    this.store = store
    this.latest = null
    this.running = false
    this.ready = !this.worker
    clearTimeout(this.timer); this.timer = null
    if (this.worker) {
      try { this.worker.postMessage({ type: 'setData', epoch: this.epoch, data: store }) }
      catch { this.fallback() }
    }
  }

  request(camera, options) {
    if (this.destroyed) return
    this.latest = { type: 'cluster', epoch: this.epoch, requestId: ++this.sequence, camera, options }
    this.dispatch()
  }

  invalidate() { this.sequence++; this.latest = null }

  dispatch() {
    if (this.destroyed || !this.ready || this.running || !this.latest || !this.store) return
    const message = this.latest
    this.running = true
    if (this.worker) {
      try { this.worker.postMessage(message) } catch { this.fallback() }
    } else {
      this.timer = setTimeout(() => {
        this.timer = null
        if (this.destroyed) return
        const started = performance.now()
        this.receive({ type: 'clusterResult', epoch: message.epoch, requestId: message.requestId,
          ...computeScreenGrid(this.store, message.camera, message.options), computeTime: performance.now() - started })
      }, 0)
    }
  }

  receive(message) {
    if (this.destroyed || message.epoch !== this.epoch) return
    if (message.type === 'dataReady') { this.ready = true; this.dispatch(); return }
    if (message.type !== 'clusterResult') return
    this.running = false
    if (message.requestId === this.sequence) {
      this.latest = null
      this.onResult(message)
    }
    this.dispatch()
  }

  releaseWorker() {
    this.worker?.terminate()
    this.worker = null
    if (this.url) URL.revokeObjectURL(this.url)
    this.url = null
  }

  fallback() {
    this.releaseWorker()
    this.ready = true
    this.running = false
    this.dispatch()
  }

  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    clearTimeout(this.timer)
    this.releaseWorker()
    this.store = this.latest = this.onResult = null
  }
}

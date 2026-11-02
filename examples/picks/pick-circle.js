export default {
  id: 'pick-circle',
  name: 'pickCircle',
  title: '圆形绘制',
  summary: '先确定圆心，再通过边缘控制点确定半径，回调按 unit 配置返回半径，支持 m / km。',
  instruction: '左键确定圆心，移动鼠标预览，再次单击确定圆的半径',
  code: `const tools = new PickTools(viewer, {
  unit: 'm', // m / km，控制返回的半径单位
  color: '#56e8e2',
  lineWidth: 3,
  pointSize: 10,
  fillOpacity: 0.25,
  isReserve: true,
  mouseHints: {
    show: true,
    text: '单击圆心，再次单击确定半径'
  }
})

tools.pickCircle((result) => {
  onResult(result)
})

return tools`,
}

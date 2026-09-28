const PLACE_NAMES = [
  '九台城区', '南山公园', '九台站', '九郊街道', '营城街道', '土们岭街道',
  '东湖街道', '卡伦湖街道', '兴隆街道', '苇子沟街道', '纪家街道', '波泥河街道',
  '龙嘉街道', '西营城街道', '沐石河街道', '城子街街道', '其塔木镇', '上河湾镇',
  '胡家回族乡', '莽卡满族乡', '饮马河', '八家子水库', '庙香山', '龙嘉机场',
  '九台工业园', '现代农业园', '能源中心', '物流基地', '生态湿地', '游客服务中心',
  '长春九台经济开发区综合服务中心', '庙香山冰雪运动旅游度假区',
]

export default {
  id: 'text-group',
  name: 'TextGroupLayer',
  title: 'Canvas 文字',
  group: '点位标注',
  summary: '用高 DPI Canvas 批量渲染文字，并根据屏幕重叠范围自动进行碰撞避让。',
  code: `const layer = new MapLayers.TextGroupLayer(viewer, {
  dpr: 1.4,
  maxWidth: 150,
  fontSize: 18,
  fontFamily: '"Microsoft YaHei", sans-serif',
  fontWeight: 700,
  color: '#dffaff',
  showBackground: true,
  backgroundColor: 'rgba(4, 28, 42, 0.72)',
  padding: [9, 5],
  border: true,
  borderColor: 'rgba(55, 224, 235, 0.75)',
  borderRadius: 4,
  overflowMode: 'wrap',
  shadowColor: 'rgba(0, 0, 0, 0.85)',
  shadowBlur: 3,
  enableCollisionDetection: true,
  collisionThreshold: 0.2,
  collisionPadding: 4,
  hideStrategy: 'distance',
  scaleByDistance: [3000, 1, 80000, 0.55]
})

const names = ${JSON.stringify(PLACE_NAMES)}
const center = [125.8337, 44.1471]
const colors = ['#8ff7ff', '#ffe082', '#b9f6ca', '#ffffff']
const data = names.map((text, index) => {
  const ring = Math.floor(index / 6) + 1
  const angle = (index * 137.5) * Math.PI / 180
  const longitude = center[0] + Math.cos(angle) * ring * 0.0065
  const latitude = center[1] + Math.sin(angle) * ring * 0.0042
  return {
    geometry: {
      type: 'Point',
      coordinates: [longitude, latitude, 30]
    },
    properties: {
      id: 'text-' + index,
      text,
      color: colors[index % colors.length],
      priority: index < 6 ? 10 : ring === 2 ? 5 : 1
    }
  }
})

layer.setData(data)

return layer`,
}

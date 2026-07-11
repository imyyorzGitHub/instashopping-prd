const BRAND_SILHOUETTE = {
  mode: "brand",
  brandFill: 0x16051f,
  fillOpacity: 0.96,
  brandRimA: 0xff4a9b,
  brandRimB: 0xff9a52,
  brandEdge: 0xff8f52,
  edgeOpacity: 0.36,
  brandRimPower: 2.1,
  brandRimStrength: 1.42
};

export const CHAPTERS = [
  {
    id: "performance", index: "01", landmarkId: "grand-lisboa", landmarkName: "新葡京",
    kicker: "业绩快照", title: "Q1 超挑战收官，Q2 信心起点",
    body: "大盘交易额 3,079 万、KA 交易额 1,544 万、拉回净增 4,480 均超挑战完成。毛利额 72 万未达标，暴露了转化与投放效率的瓶颈。",
    layout: "metrics",
    items: [
      { value: "3,079万", label: "大盘有效交易额", note: "目标 2,958 万 · 超挑战" },
      { value: "1,544万", label: "KA 有效交易额", note: "目标 1,361 万 · 超挑战" },
      { value: "4,480", label: "拉回净增用户", note: "目标 1,300 · 超挑战" },
      { value: "72万", label: "线上毛利额", note: "目标 91 万 · 瓶颈暴露" }
    ],
    duration: 3.2, handoffDuration: 3.8, finalExposure: 0.9,
    context: { finalOpacity: 0.06, finalEmissiveIntensity: 0.02 },
    camera: {
      desktop: { finalOffset: [-3.72, 0.78, 5.18], finalLookOffset: [-2.42, 3.48, -0.08], approachOffset: [-10.6, 6.6, 12.9], entryOffset: [-15.2, 12.2, 19.4], exitOffset: [-2.5, 11.8, 2.7], exitLookOffset: [-0.7, 6.0, 0], lookControlOffset: [-1.25, 1.55, 2.55], cameraControlLift: 2.15, finalFov: 64, fovBoost: 12.5, finalRoll: -1.1 },
      mobile: { finalOffset: [-3.08, 1.05, 5.82], finalLookOffset: [-1.55, 3.42, 0.02], approachOffset: [-8.4, 6.4, 12.6], entryOffset: [-11.8, 11.0, 18.0], exitOffset: [-1.8, 10.0, 3.1], exitLookOffset: [-0.4, 5.7, 0], lookControlOffset: [-0.9, 1.25, 2.5], cameraControlLift: 1.8, finalFov: 68, fovBoost: 10, finalRoll: -0.7 }
    },
    silhouette: { ...BRAND_SILHOUETTE },
    glow: "rgba(255, 105, 92, .22)", wipe: "#6d1739"
  },
  {
    id: "situation", index: "02", landmarkId: "st-pauls", landmarkName: "大三巴",
    kicker: "Situation · 瓶颈分析", title: "增长之后，瓶颈转向链路",
    body: "交易增长证明方向有效，但用户搜到后买不到、频道内发现效率低、商家投放门槛高，开始成为下一阶段增长约束。",
    layout: "rows",
    items: [
      { value: "搜索转化", label: "搜到，但不一定买到", note: "结果呈现与加购仍有空间" },
      { value: "发现效率", label: "入口仍然单一", note: "过度依赖首页曝光" },
      { value: "投放门槛", label: "商家难以自助调价", note: "毛利与曝光效率受限" }
    ],
    duration: 3.0, handoffDuration: 3.6, finalExposure: 0.9,
    context: { finalOpacity: 0.075, finalEmissiveIntensity: 0.026 },
    camera: {
      desktop: { finalOffset: [-2.55, 0.62, 3.72], finalLookOffset: [-1.42, 1.72, -0.05], approachOffset: [-7.8, 5.2, 9.6], entryOffset: [-11.6, 10.5, 15.0], exitOffset: [-1.4, 8.6, 2.6], exitLookOffset: [-0.2, 3.4, 0], lookControlOffset: [-0.8, 0.9, 1.8], cameraControlLift: 1.5, finalFov: 59, fovBoost: 10.5, finalRoll: 0.8 },
      mobile: { finalOffset: [-2.2, 0.82, 4.18], finalLookOffset: [-0.78, 1.78, 0], approachOffset: [-6.2, 5.1, 9.2], entryOffset: [-9.3, 9.0, 14.2], exitOffset: [-0.9, 7.8, 2.7], exitLookOffset: [0, 3.2, 0], lookControlOffset: [-0.5, 0.8, 1.7], cameraControlLift: 1.3, finalFov: 64, fovBoost: 9, finalRoll: 0.5 }
    },
    silhouette: { ...BRAND_SILHOUETTE, brandRimA: 0xff5e91, brandRimB: 0xffae66 },
    glow: "rgba(255, 119, 91, .2)", wipe: "#711a3d"
  },
  {
    id: "mapping", index: "03", landmarkId: "cotai", landmarkName: "路氹酒店群",
    kicker: "Task · OKR 映射", title: "一条链路，同时拉动五个目标",
    body: "把搜索入口、输入、结果、调权和转化串起来，让交易额、用户渗透、中腰部增长、毛利和 NPS 一起被拉动。",
    layout: "rows",
    items: [
      { value: "交易额 3,300万", label: "入口、结果、转化共同提升搜索成交", note: "交易额" },
      { value: "渗透率 13.2%", label: "热搜、常买、品类推荐降低进入门槛", note: "渗透" },
      { value: "中腰部 225万", label: "搜索广告位与投放工具增加曝光", note: "商家" },
      { value: "毛利额 72万", label: "推广自动定价提升投放效率", note: "毛利" },
      { value: "NPS 5", label: "减少无效搜索与加购路径", note: "体验" }
    ],
    duration: 3.2, handoffDuration: 3.9, finalExposure: 0.92,
    context: { finalOpacity: 0.065, finalEmissiveIntensity: 0.022 },
    camera: {
      desktop: { finalOffset: [-7.3, 1.35, 7.4], finalLookOffset: [-3.6, 2.15, 0.2], approachOffset: [-16.0, 8.0, 15.6], entryOffset: [-23.0, 15.5, 23.0], exitOffset: [-4.0, 12.5, 5.5], exitLookOffset: [-0.5, 4.2, 0], lookControlOffset: [-2.2, 1.1, 3.4], cameraControlLift: 2.5, finalFov: 62, fovBoost: 11.5, finalRoll: -0.7 },
      mobile: { finalOffset: [-6.1, 1.7, 8.3], finalLookOffset: [-2.2, 2.25, 0.1], approachOffset: [-13.5, 8.0, 15.4], entryOffset: [-18.0, 14.0, 22.0], exitOffset: [-2.8, 11.0, 5.7], exitLookOffset: [0, 4.0, 0], lookControlOffset: [-1.5, 1.0, 3.0], cameraControlLift: 2.1, finalFov: 68, fovBoost: 9.5, finalRoll: -0.45 }
    },
    silhouette: { ...BRAND_SILHOUETTE, brandRimA: 0xff478e, brandRimB: 0xffa64f },
    glow: "rgba(255, 92, 123, .21)", wipe: "#741941"
  },
  {
    id: "action", index: "04", landmarkId: "morpheus", landmarkName: "摩珀斯",
    kicker: "Action · 全链路优化", title: "不是项目清单，而是一条增长链路",
    body: "先铺入口、结果、调权、转化基础设施，再补齐关键词承接与自动定价，让搜索链路从能用走向可运营。",
    layout: "rows",
    items: [
      { value: "入口", label: "热搜 / 常买 / 品类推荐", note: "渗透率 ↑ · 交易额 ↑" },
      { value: "输入", label: "关键词输入页增加运营模块", note: "搜索门槛 ↓" },
      { value: "结果", label: "商品列表 + 综合搜索广告位", note: "曝光与转化 ↑" },
      { value: "调权", label: "搜索词加权与推广自动定价", note: "毛利效率 ↑" },
      { value: "转化", label: "推荐搭配覆盖点餐与搜索页", note: "加购转化 ↑" }
    ],
    duration: 3.0, handoffDuration: 3.6, finalExposure: 0.9,
    context: { finalOpacity: 0.065, finalEmissiveIntensity: 0.022 },
    camera: {
      desktop: { finalOffset: [-3.45, 0.72, 4.72], finalLookOffset: [-1.65, 2.55, 0], approachOffset: [-8.7, 6.6, 11.0], entryOffset: [-13.5, 12.4, 17.0], exitOffset: [-2.2, 10.0, 2.9], exitLookOffset: [-0.2, 4.8, 0], lookControlOffset: [-1.1, 1.2, 2.2], cameraControlLift: 1.8, finalFov: 61, fovBoost: 11, finalRoll: 0.95 },
      mobile: { finalOffset: [-2.9, 0.95, 5.3], finalLookOffset: [-0.95, 2.62, 0], approachOffset: [-7.0, 6.2, 10.8], entryOffset: [-10.5, 11.0, 16.0], exitOffset: [-1.4, 9.0, 3.1], exitLookOffset: [0, 4.5, 0], lookControlOffset: [-0.7, 1.0, 2.1], cameraControlLift: 1.55, finalFov: 66, fovBoost: 9, finalRoll: 0.65 }
    },
    silhouette: { ...BRAND_SILHOUETTE, brandRimA: 0xff4597, brandRimB: 0xff9c55 },
    glow: "rgba(255, 82, 133, .2)", wipe: "#6d173f"
  },
  {
    id: "result", index: "05", landmarkId: "airport", landmarkName: "澳门国际机场",
    kicker: "Result · 阶段结果", title: "链路已成形，进入持续迭代",
    body: "H1 完成入口、结果、调权与转化能力建设。最终经营数据确认前，本章只展示可核实的能力沉淀，不使用推测或占位数字。",
    layout: "rows",
    items: [
      { value: "入口矩阵", label: "热搜、常买与品类推荐形成多入口承接", note: "由单一曝光走向多场景发现" },
      { value: "结果承接", label: "商品列表与综合搜索广告位补齐结果页", note: "搜索结果具备运营与商业化空间" },
      { value: "运营抓手", label: "搜索词加权与推广自动定价可配置", note: "运营效率与毛利效率有明确抓手" },
      { value: "转化闭环", label: "推荐搭配覆盖点餐页与搜索页", note: "搜索、加购与成交不再割裂" }
    ],
    duration: 3.2, handoffDuration: 3.8, finalExposure: 0.94,
    context: { finalOpacity: 0.07, finalEmissiveIntensity: 0.026 },
    camera: {
      desktop: { finalOffset: [-12.8, 1.15, 10.6], finalLookOffset: [-6.2, 0.72, -5.8], approachOffset: [-24.0, 9.5, 21.0], entryOffset: [-34.0, 18.0, 31.0], exitOffset: [-8.0, 13.0, 9.0], exitLookOffset: [-4.0, 3.2, -4.0], lookControlOffset: [-3.8, 1.0, 3.8], cameraControlLift: 2.2, finalFov: 66, fovBoost: 12, finalRoll: -1.2 },
      mobile: { finalOffset: [-10.5, 1.45, 12.4], finalLookOffset: [-4.5, 0.8, -4.2], approachOffset: [-20.0, 9.2, 21.5], entryOffset: [-28.0, 16.5, 30.0], exitOffset: [-6.5, 11.5, 9.8], exitLookOffset: [-3.0, 3.0, -3.0], lookControlOffset: [-2.7, 0.9, 3.6], cameraControlLift: 1.9, finalFov: 71, fovBoost: 9.5, finalRoll: -0.75 }
    },
    silhouette: { ...BRAND_SILHOUETTE, brandRimA: 0xff5a8d, brandRimB: 0xffb05d },
    glow: "rgba(255, 116, 89, .2)", wipe: "#731b3b"
  },
  {
    id: "roadmap", index: "06", landmarkId: "macau-tower", landmarkName: "澳门塔",
    kicker: "Q3 展望", title: "下一步，让每条链路更聪明",
    body: "从链路打通走向精细化运营，继续推进综合搜索、热门商品召回、场景推荐和点金推广综合分拆分。",
    layout: "rows",
    items: [
      { value: "8.7", label: "综合搜索 2 期：意图识别与结果承接", note: "下一里程碑" },
      { value: "召回", label: "热门商品召回：补齐搜索供给", note: "供给效率" },
      { value: "推荐", label: "场景驱动推荐：搜索与加购协同", note: "用户效率" },
      { value: "分拆", label: "点金推广综合分拆分落地", note: "商业效率" }
    ],
    duration: 3.1, handoffDuration: 3.9, finalExposure: 0.92,
    context: { finalOpacity: 0.06, finalEmissiveIntensity: 0.022 },
    camera: {
      desktop: { finalOffset: [-3.65, 0.7, 5.1], finalLookOffset: [-1.8, 5.1, 0], approachOffset: [-9.8, 8.0, 12.8], entryOffset: [-15.5, 15.5, 20.0], exitOffset: [-2.0, 14.5, 2.5], exitLookOffset: [0, 7.2, 0], lookControlOffset: [-1.2, 2.2, 2.5], cameraControlLift: 2.4, finalFov: 63, fovBoost: 12, finalRoll: 0.65 },
      mobile: { finalOffset: [-3.0, 0.95, 5.8], finalLookOffset: [-0.9, 5.0, 0], approachOffset: [-7.8, 7.6, 12.6], entryOffset: [-12.0, 13.8, 19.0], exitOffset: [-1.2, 13.0, 2.8], exitLookOffset: [0, 7.0, 0], lookControlOffset: [-0.7, 1.9, 2.4], cameraControlLift: 2.0, finalFov: 68, fovBoost: 10, finalRoll: 0.4 }
    },
    silhouette: { ...BRAND_SILHOUETTE, brandRimA: 0xff4b96, brandRimB: 0xffa65a },
    glow: "rgba(255, 102, 104, .21)", wipe: "#70183e"
  }
];

export const FIRST_CHAPTER = CHAPTERS[0];

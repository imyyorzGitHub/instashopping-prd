export const CHAPTERS = [
  {
    id: "performance",
    index: "01",
    landmarkId: "grand-lisboa",
    landmarkName: "新葡京",
    kicker: "业绩快照",
    title: "Q1 超挑战收官，Q2 信心起点",
    body: "大盘交易额 3,079 万、KA 交易额 1,544 万、拉回净增 4,480 均超挑战完成。毛利额 72 万未达标，暴露了转化与投放效率的瓶颈。",
    metrics: [
      { value: "3,079万", label: "大盘有效交易额", note: "目标 2,958 万 · 超挑战" },
      { value: "1,544万", label: "KA 有效交易额", note: "目标 1,361 万 · 超挑战" },
      { value: "4,480", label: "拉回净增用户", note: "目标 1,300 · 超挑战" },
      { value: "72万", label: "线上毛利额", note: "目标 91 万 · 瓶颈暴露" }
    ],
    duration: 3.2,
    finalExposure: 0.86,
    context: {
      finalOpacity: 0.05,
      finalEmissiveIntensity: 0.012
    },
    camera: {
      desktop: {
        // Low, close and wide: the landmark occupies the right side like a cinematic poster.
        finalOffset: [-3.72, 0.78, 5.18],
        finalLookOffset: [-2.42, 3.48, -0.08],
        approachOffset: [-10.6, 6.6, 12.9],
        lookControlOffset: [-1.25, 1.55, 2.55],
        cameraControlLift: 2.15,
        finalFov: 64,
        fovBoost: 12.5,
        finalRoll: -1.1
      },
      mobile: {
        finalOffset: [-3.08, 1.05, 5.82],
        finalLookOffset: [-1.55, 3.42, 0.02],
        approachOffset: [-8.4, 6.4, 12.6],
        lookControlOffset: [-0.9, 1.25, 2.5],
        cameraControlLift: 1.8,
        finalFov: 68,
        fovBoost: 10,
        finalRoll: -0.7
      }
    },
    silhouette: {
      fill: 0x172b48,
      fillOpacity: 0.92,
      edge: 0x9ac5ec,
      edgeOpacity: 0.38
    }
  }
];

export const FIRST_CHAPTER = CHAPTERS[0];
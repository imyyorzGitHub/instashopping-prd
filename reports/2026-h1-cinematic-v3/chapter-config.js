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
    camera: {
      desktop: {
        finalOffset: [-5.7, 2.55, 7.35],
        finalLookOffset: [-1.75, 2.45, 0.15],
        approachOffset: [-11.8, 7.2, 14.6],
        finalFov: 48
      },
      mobile: {
        finalOffset: [-4.1, 3.15, 8.7],
        finalLookOffset: [-0.55, 2.65, 0.2],
        approachOffset: [-8.5, 7.8, 15.2],
        finalFov: 52
      }
    },
    silhouette: {
      fill: 0x122139,
      edge: 0x6e91bd,
      edgeOpacity: 0.52
    }
  }
];

export const FIRST_CHAPTER = CHAPTERS[0];

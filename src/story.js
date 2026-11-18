// 会話の一覧。at = そのせりふが出るドキドキ値(0〜1)
export const LINES = [
  { at: 0.00, who: 'she', text: '…ほんとに入れてもらっていいの?' },
  { at: 0.07, who: 'he',  text: 'うん。…ていうか、どうぞ' },
  { at: 0.14, who: 'she', text: 'ふふ、なんで敬語なの' },
  { at: 0.21, who: 'he',  text: 'いや…思ったより近いなって' },
  { at: 0.28, who: 'she', text: '…言わないでよ。意識しちゃうじゃん' },
  { at: 0.35, who: 'he',  text: 'ご、ごめん' },
  { at: 0.42, who: 'she', text: '…ねえ、そっちの肩びしょびしょだよ' },
  { at: 0.49, who: 'he',  text: '気のせいだよ' },
  { at: 0.56, who: 'she', text: '傘、ずっとこっちに傾けてるでしょ' },
  { at: 0.63, who: 'he',  text: '…バレてた?' },
  { at: 0.70, who: 'she', text: '…もうちょっとだけ、降っててほしいな' },
  { at: 0.77, who: 'he',  text: 'え?' },
  { at: 0.83, who: 'she', text: 'な、なんでもない!' },
  { at: 0.88, who: 'he',  text: 'あのさ…', climax: true },
  { at: 0.94, who: 'she', text: '……うん', climax: true },
];

export const PROMISE = '「晴れた日にも、会ってくれる?」\n「…うん。傘のいらない日にね」';

export const GOODBYE = {
  closed: '「あ…止んじゃったね」\n「…うん。じゃあ、また明日」',
  shelter: '「わっ、すごい雨…!」\n「…今日はここまで、だね。また明日」',
};

export function lineAt(doki) {
  let found = null;
  LINES.forEach((line, index) => { if (line.at <= doki) found = { index, line }; });
  return found;
}

export function isClimax(doki) {
  const cur = lineAt(doki);
  return !!(cur && cur.line.climax);
}

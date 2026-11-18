// 会話の一覧。at = そのせりふが出るドキドキ値(0〜1)
export const LINES = [
  { at: 0.00, who: 'she', text: 'ごめんね、急に降ってきちゃって…' },
  { at: 0.07, who: 'he',  text: 'いいよ。駅まで同じ方向だし' },
  { at: 0.15, who: 'she', text: '天気予報、晴れって言ってたのにな' },
  { at: 0.23, who: 'he',  text: '俺は信じてなかった。だから傘ある' },
  { at: 0.31, who: 'she', text: 'ふふ、なにそれ' },
  { at: 0.40, who: 'he',  text: '…肩、濡れてない?' },
  { at: 0.48, who: 'she', text: 'だいじょうぶ。…そっちこそ' },
  { at: 0.56, who: 'he',  text: 'こっちは平気。慣れてるから' },
  { at: 0.64, who: 'she', text: '雨の音って、ちょっと落ち着くよね' },
  { at: 0.72, who: 'he',  text: 'わかる。…なんか、話しやすい' },
  { at: 0.80, who: 'she', text: 'もうすぐ駅、着いちゃうね' },
  { at: 0.87, who: 'he',  text: 'あのさ…', climax: true },
  { at: 0.93, who: 'she', text: '…なに?', climax: true },
];

export const PROMISE = '「今度の日曜、一緒に出かけない?」\n「…うん、行く」';

export const GOODBYE = {
  closed: '「あ、止んだね」「…じゃあ、また明日」',
  shelter: '「すごい雨…!」「今日はここで。また明日」',
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

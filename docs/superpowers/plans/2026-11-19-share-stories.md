# 自分で作る物語とSNS共有 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 自分で書いた会話を遊んでクリアしたら、LINE風の共有画像と「その物語を遊べるリンク」をSNSに共有できるようにし、GitHub Pages で公開する。

**Architecture:** 物語は「ユーザー入力 → normalizeCustom で検証・整形 → ゲーム用 Story」に変換。リンクは JSON を deflate 圧縮して base64url にし `#s=` に入れる。共有画像は Canvas 2D で 1080×1920 に描く(吹き出しの配置計算は測り関数を差し込める純粋関数でテスト)。共有はスマホの共有シート、使えなければ保存+X投稿画面+リンクコピー。

**Tech Stack:** 既存のまま(ES Modules、Canvas 2D、node --test、Playwright)。圧縮は CompressionStream('deflate-raw')。

**Spec:** `docs/superpowers/specs/2026-11-18-aiaigasa-design.md`(「追加:自分で物語を作って共有する」)

## Global Constraints

- 会話 6〜15行、1行30字まで。題名20字まで。問いかけ・答え 各40字まで。行ごとに 'he' / 'she'
- 山場は最後の2行。失敗時は共通の文(「…また明日」+心の声)
- 共有画像 1080×1920。上にタイトル「絶対に相合傘をやめさせないゲーム」、下にURL `https://nagashinocat.github.io/aiaigasa/`
- 投稿文:「この二人の相合傘、守り切れる? #相合傘をやめさせない」+物語つきリンク
- リンク形式:`https://nagashinocat.github.io/aiaigasa/#s=<base64url>`。壊れていたらふつうのタイトルへ
- 組み込み6本もクリアしたら共有できる(リンクは `#story=<id>`)
- ユーザーの文字は textContent か Canvas でだけ描く(HTMLとして入れない)

## Review Focus

- 改ざん・途中で切れた `#s=` → 例外を出さずふつうのタイトルへ(Task 1 のテスト)
- 改行・絵文字・長い英単語を含む行 → 画像の吹き出しからはみ出さない(Task 3 のテスト:折り返し)
- 15行×30字の最大の物語 → 画像に収まり、本文の文字が 34px を下回らない(Task 3 のテスト)
- PC など共有シートがない環境 → 保存+X+コピーに切り替わる(Task 4 の e2e)
- `<script>` などを含む入力 → そのまま文字として表示される(Task 2 の e2e)

---

### Task 1: 物語の整形とリンク化(src/custom.js)

**Files:** Create `src/custom.js`, `tests/custom.test.js`

**Interfaces:**
- Produces:
  - `export const LIMITS = { minLines: 6, maxLines: 15, lineLen: 30, titleLen: 20, askLen: 40 }`
  - `export function normalizeCustom(input): { story: Story|null, errors: string[] }` — input `{ title, kids, lines:[{who,text}], ask, answer }`。文字の前後空白と改行を除き、長すぎる/少なすぎる/空はエラー(日本語文)。Story は既存と同じ形(id 'custom'、tune {}、ask/answer の who は最後の2行の話し手、goodbye 共通、endTitle「ふたりの約束、成立!」、blurb は題名)
  - `at` の割り振り:最後の2行以外を 0〜0.83 に等間隔(最初は0)、最後の2行は 0.88 と 0.94 で climax:true
  - `export async function encodeStory(input): Promise<string>`、`export async function decodeStory(code): Promise<Story|null>`(失敗は null)
  - `export function storyToInput(story)`(組み込み物語を入力形に戻す。共有画像用)

- [ ] **Step 1: テスト** — `normalizes a valid 6-line story`(at[0]=0、最後2行が climax で at .88/.94)、`rejects 5 lines and 16 lines`、`rejects a 31-char line`、`trims and removes newlines`、`roundtrip encode/decode equals normalize`、`decode garbage returns null`(`'%%%'`, `''`, 正しい code の末尾を切ったもの)、`decoded story is re-validated`(31字の行を含む JSON を手で圧縮 → null)
- [ ] **Step 2:** `npm test` → FAIL
- [ ] **Step 3:** 実装
- [ ] **Step 4:** `npm test` → PASS
- [ ] **Step 5:** commit `feat: custom story normalize and link codec`

### Task 2: 物語を書く画面(editor)

**Files:** Create `src/editor.js`; Modify `index.html`、`style.css`、`src/ui.js`(物語選びに「自分で作る」)、`src/main.js`、`tests/e2e.mjs`

**Interfaces:**
- Consumes: `normalizeCustom`, `LIMITS`
- Produces: `export function createEditor(doc, { storage, onPlay(story, input) }): { open(input?), close() }`
- 画面:題名、大人/子ども、行のリスト(行ごとに「彼/彼女」切替ボタン、入力欄、削除)、「行を足す」、問いかけ、答え、「遊んでみる」。エラーは一覧で上に表示。入力は1秒ごとに端末へ下書き保存(キー `aiaigasa-draft`、try/catch)。初期値は6行の見本(彼女/彼 交互の短い会話)
- main:`onPlay` で story を差し替えて startGame。カスタム物語の input を覚えておく(共有用)

- [ ] **Step 1: e2e** `editor`:自分で作る → 見本のまま遊んでみる → mode 'play'・story 'custom'。5行に減らすとエラー表示で始まらない。行に `<b>x</b>` と入れて遊ぶ → ふきだしの textContent に `<b>x</b>` がそのまま
- [ ] **Step 2:** `node tests/e2e.mjs editor` → FAIL
- [ ] **Step 3:** 実装
- [ ] **Step 4:** PASS、スクリーンショット `60-editor` を目で確認(390幅で崩れない)
- [ ] **Step 5:** commit `feat: story editor`

### Task 3: 共有画像(src/shareCard.js)

**Files:** Create `src/shareCard.js`, `tests/shareCard.test.js`

**Interfaces:**
- Produces:
  - `export function wrapText(text, maxWidth, measure): string[]` — measure(str)→幅。日本語は1文字単位、英単語は単語単位(1単語が maxWidth を超えたら文字で切る)
  - `export function layoutChat(lines, { width, top, bottom, measure }): { bubbles: [{who, rows, x, y, w, h}], fontSize }` — fontSize は 40 から始め、収まらなければ吹き出し間の余白を詰め、それでも無理なら 2 ずつ下げて最低 34
  - `export function renderShareCard(canvas, story, { url }): HTMLCanvasElement` — 1080×1920
- 絵:雨の夕空グラデーションと雨筋、上にタイトル、吹き出し(彼女=左・白、彼=右・淡い青)、最後に虹の弧と問いかけ・答え(少し大きく)、下に傘の二人のシルエットとURL

- [ ] **Step 1: テスト** — `wrapText splits Japanese by char`、`wrapText keeps English words, breaks overlong word`、`layoutChat fits 15 lines of 30 chars with fontSize >= 34`(measure = 文字数×fontSize)、`layoutChat alternates sides by who`
- [ ] **Step 2:** FAIL → **Step 3:** 実装 → **Step 4:** PASS
- [ ] **Step 5:** e2e `card`:`window.__debugCard('tenkin')` で描いた PNG を保存、1080×1920 であること、目で確認(15行の自作物語でも)
- [ ] **Step 6:** commit `feat: share card`

### Task 4: 共有の流れとリンクからの起動

**Files:** Create `src/share.js`; Modify `src/main.js`、`src/ui.js`、`index.html`、`tests/e2e.mjs`

**Interfaces:**
- Consumes: Task 1〜3
- Produces:
  - `export const SITE_URL = 'https://nagashinocat.github.io/aiaigasa/'`
  - `export function shareText(link): string` → 「この二人の相合傘、守り切れる? #相合傘をやめさせない\n」+link
  - `export async function shareStory({ canvas, link, nav, doc }): Promise<'sheet'|'fallback'>` — `nav.canShare({files})` が真なら共有シート、そうでなければ画像を保存リンクでダウンロード、X の投稿画面 `https://x.com/intent/post?text=` を開く、リンクをコピー
  - `export function readHash(hash): {kind:'custom', code}|{kind:'builtin', id}|null`
- 終了画面(クリア時のみ)に「共有する」ボタン。押すと画像を作って shareStory
- 起動時に readHash。あればオープニングのあと物語選びを飛ばしてその物語を開始。カスタムは decodeStory が null ならふつうに物語選びへ

- [ ] **Step 1: テスト(node)** — `readHash parses #s= and #story=`、`readHash returns null for others`、`shareText includes hashtag and link`
- [ ] **Step 2:** FAIL → 実装 → PASS
- [ ] **Step 3: e2e** `share`:自作物語をクリア → 共有する → (headless は共有シートなし)ダウンロードが発生し、ポップアップの URL が x.com/intent/post で、クリップボードに `#s=` 入りリンク。そのリンクを開き直すとオープニング後に story 'custom' で開始。壊したリンクではタイトル→物語選びに進める
- [ ] **Step 4:** commit `feat: share flow and story links`

### Task 5: GitHub Pages で公開

- [ ] **Step 1:** `nagashinocat/aiaigasa`(公開)を作成。できなければ本人に空のリポジトリを作ってもらう
- [ ] **Step 2:** 公開に必要なファイルだけを main に push(docs と tests も入れてよい。node_modules・screenshots・.superpowers は除外)
- [ ] **Step 3:** Pages を main / ルートで有効化
- [ ] **Step 4:** 公開URLを開いて表示されること、`#story=tenkin` で転勤が始まること
- [ ] **Step 5:** Claude のページも更新(共有ボタンはそこでは「保存できない」旨を出す)

### Task 6: 仕上げ

- [ ] `npm test` と `node tests/e2e.mjs` が通る
- [ ] Review Focus の5項目を確認
- [ ] 本人向けのまとめ

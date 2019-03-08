---
title: WebGL 2.0 - blitFramebufferでフレームバッファーをコピーする
author: 川勝 研太郎
published_date: 2019-03-08
modified_date: 2019-03-08
---

WebGL 2.0 で追加された`blitFramebuffer()`メソッドはフレームバッファー同士のコピーを行うAPIです。`blitFramebuffer()`メソッドを使うと、**テクスチャやオフスクリーンレンダリングで描画したフレームバッファーの内容を簡単に画面表示できます**。

WebGL 1.0 では、「テクスチャをちょっと画面に表示して確認したいな」、というときにわざわざスクリーンを覆う形に頂点を用意して、シェーダーでテクスチャを貼り付ける処理を記述する必要がありました。`blitFramebuffer()`メソッドは**頂点が不要で、シェーダーも使わず、ドローコールも行わずにテクスチャを画面に表示できるおもしろい機能**です。

## サンプルの紹介
`blitFramebuffer()`メソッドを使ってWebGLのテクスチャを**頂点やシェーダーを使わずに**画面表示するサンプルを紹介します。

[![](../imgs/webgl2_blitframebuffer.png)](https://ics-creative.github.io/web3d-maniacs/samples/webgl2_blitframebuffer)

- [サンプルを別ウインドウで再生する](https://ics-creative.github.io/web3d-maniacs/samples/webgl2_blitframebuffer)（[WebGL 2.0に対応したブラウザ](https://caniuse.com/#feat=webgl2)でご覧ください）
- [サンプルのソースコードを確認する](../samples/webgl2_blitframebuffer)

下準備として、テクスチャを作成して画像を転送しておきます。この部分は通常のテクスチャを作成する処理とまったく同じです。WebGLのテクスチャはデフォルトの設定では転送した画像が上下反転して取り扱いにくいため、`pixelStorei()`メソッドで転送時のY座標の設定を反転しておきます。

```js
// テクスチャを作成、転送
const texture = gl2.createTexture();
gl2.bindTexture(gl2.TEXTURE_2D, texture);
// テクスチャ転送時のY座標設定を反転しておく
gl2.pixelStorei(gl2.UNPACK_FLIP_Y_WEBGL, true);
gl2.texImage2D(gl2.TEXTURE_2D, 0, gl2.RGBA, gl2.RGBA, gl2.UNSIGNED_BYTE, textureImage);
```

次に、フレームバッファーを作成してテクスチャの関連付けを行います。この部分もフレームバッファーでオフスクリーンレンダリングを行う際の手順と同じです。

```js
// フレームバッファーを作成
const frameBuffer = gl2.createFramebuffer();
gl2.bindFramebuffer(gl2.FRAMEBUFFER, frameBuffer);
// フレームバッファーへテクスチャをアタッチ
gl2.framebufferTexture2D(gl2.FRAMEBUFFER, gl2.COLOR_ATTACHMENT0, gl2.TEXTURE_2D, texture, 0);
gl2.bindFramebuffer(gl2.FRAMEBUFFER, null);
```

ここからが重要なポイントです。コピーしたい読み込み先のフレームバッファーと、書き込み先のフレームバッファーを`bindFramebuffer()`メソッドで指定します。このとき、`bindFramebuffer()`メソッドの第一引数には`READ_FRAMEBUFFER`および`DRAW_FRAMEBUFFER`を指定します。この2つは WebGL 2.0 で新しくで追加されたenumで、それぞれ「読み込み先のフレームバッファー」「書き込み先のフレームバッファー」を意味します（そのままですね）。

サンプルでは、読み込み先としてテクスチャをアタッチしたフレームバッファーを、書き込み先としてデフォルトのフレームバッファーを指定しています。

```js
// blitFramebuffer()メソッドで操作するフレームバッファーを指定
// 読み込み先にテクスチャをアタッチしたフレームバッファーを指定
gl2.bindFramebuffer(gl2.READ_FRAMEBUFFER, frameBuffer);
// 書き込み先にnull（デフォルトのフレームバッファー）を指定
gl2.bindFramebuffer(gl2.DRAW_FRAMEBUFFER, null);
```

コピーされた領域の表示をわかりやすくするため、コピーする前に書き込み先のフレームバッファーを灰色でクリアしておきます。`clearBufferfv()`メソッドも WebGL 2.0 で追加されたAPIで、`DRAW_FRAMEBUFFER`としてバインドされているフレームバッファーの指定したドローバッファーを塗りつぶします。

```js
// 書き込み先フレームバッファーをクリア
gl2.clearBufferfv(gl2.COLOR, 0, [0.9, 0.9, 0.9, 1.0]);
```

いよいよ`blitFramebuffer()`メソッドでフレームバッファーをコピーします。第一〜第四引数は読み込み先のフレームバッファーの矩形領域を指定します。第五〜第八引数には書き込み先のフレームバッファーの矩形領域を指定します。このとき、読み込み先の矩形領域と書き込み先の矩形領域に異なるサイズを指定した場合は、拡縮されてコピーされます。第九引数にはコピーしたい情報を指定します。今回は画像の色をコピーするため、`COLOR_BUFFER_BIT`を指定しています。最後の第十引数には、拡縮された場合のフィルタリング方式を指定します。`COLOR_BUFFER_BIT`の場合、`NEAREST`か`LINEAR`を指定できます。

```js
// フレームバッファーをコピー
gl2.blitFramebuffer(
  0, 0, textureImage.width, textureImage.height,
  0, CANVAS_HEIGHT - textureImage.height, textureImage.width, CANVAS_HEIGHT,
  gl2.COLOR_BUFFER_BIT, gl2.NEAREST);
```

フレームバッファーのY座標もCanvasに対して反転しているので、左上に表示するためにCanvasの高さから引くことで反転して指定しています。

## TIPS
### アンチエイリアスの設定はfalseに
画像ファイルから読み込んだテクスチャを`blitFramebuffer()`メソッドでCanvasに表示する場合、最初に取得するWebGLコンテキストのアンチエイリアスの設定を`false`にする必要があります。これは、マルチサンプリングされていないフレームバッファーをマルチサンプリングされるフレームバッファーへ`blitFramebuffer()`メソッドでコピーしようとすると、WebGLのエラーが発生するためです。

```js
// WebGL2コンテキスト（WebGL2RenderingContext）を取得
// アンチエイリアスを無効に設定
const gl2 = canvas.getContext('webgl2', { antialias: false });
```

### 圧縮テクスチャは表示できない
この方法で圧縮テクスチャをCanvasに簡単に表示できれば確認がはかどると思うかもしれませんが、残念ながら`blitFramebuffer()`メソッドでは圧縮テクスチャは表示できません。圧縮テクスチャをアタッチしたフレームバッファーを`blitFramebuffer()`メソッドでコピーしようとするとWebGLのエラーが発生します。

こういったケースのように、読み込み先のフレームバッファーが不正な状態にある場合、`blitFramebuffer()`メソッドを実行するとWebGLのエラーが発生します。`checkFramebufferStatus()`メソッドで読み込み先のフレームバッファーの状態を確認し、`FRAMEBUFFER_COMPLETE`でない場合は処理を中止することでエラーを避けられます。

```js
if (gl2.checkFramebufferStatus(gl2.READ_FRAMEBUFFER) !== gl2.FRAMEBUFFER_COMPLETE) {
  // 読み込み先フレームバッファーの準備が完了していない場合は処理を中止
  console.log('読み込み先フレームバッファーが不正な状態です');
  return;
}
```

## リファレンス

- [3.7.4 Framebuffer objects / WebGL 2.0 Specification](https://www.khronos.org/registry/webgl/specs/latest/2.0/#3.7.4) - blitFramebuffer
- [WebGL2RenderingContext.blitFramebuffer()
 / Web APIs | MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext/blitFramebuffer)

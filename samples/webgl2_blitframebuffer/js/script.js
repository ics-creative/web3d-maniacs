const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 540;

const main = async () => {
  // キャンバスをセットアップ
  const canvas = document.getElementById('myCanvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;

  // WebGL2コンテキスト（WebGL2RenderingContext）を取得
  // アンチエイリアスを無効に設定
  const gl2 = canvas.getContext('webgl2', { antialias: false });
  if (!gl2) {
    // WebGL2をサポートしていない場合
    canvas.style.display = 'none';
    return;
  }
  document.getElementById('notSupportedDescription').style.display = 'none';

  // 画像を読みこむ
  const textureImage = await new Promise(resolve => {
    const image = new Image();
    image.onload = () => {
      resolve(image);
    };
    image.src = 'assets/logo.png';
  });

  // テクスチャを作成、転送
  const texture = gl2.createTexture();
  gl2.bindTexture(gl2.TEXTURE_2D, texture);
  // テクスチャ転送時のY座標設定を反転しておく
  gl2.pixelStorei(gl2.UNPACK_FLIP_Y_WEBGL, true);
  gl2.texImage2D(
    gl2.TEXTURE_2D,
    0,
    gl2.RGBA,
    gl2.RGBA,
    gl2.UNSIGNED_BYTE,
    textureImage
  );

  // フレームバッファーを作成
  const frameBuffer = gl2.createFramebuffer();
  gl2.bindFramebuffer(gl2.FRAMEBUFFER, frameBuffer);
  // フレームバッファーへテクスチャをアタッチ
  gl2.framebufferTexture2D(
    gl2.FRAMEBUFFER,
    gl2.COLOR_ATTACHMENT0,
    gl2.TEXTURE_2D,
    texture,
    0
  );
  gl2.bindFramebuffer(gl2.FRAMEBUFFER, null);

  // blitFramebuffer()で操作するフレームバッファーを指定
  // 読み込み先にテクスチャをアタッチしたフレームバッファーを指定
  gl2.bindFramebuffer(gl2.READ_FRAMEBUFFER, frameBuffer);
  // 書き込み先にnull（デフォルトのフレームバッファー）を指定
  gl2.bindFramebuffer(gl2.DRAW_FRAMEBUFFER, null);

  // 書き込み先フレームバッファーをクリア
  gl2.clearBufferfv(gl2.COLOR, 0, [0.9, 0.9, 0.9, 1.0]);

  if (
    gl2.checkFramebufferStatus(gl2.READ_FRAMEBUFFER) !==
    gl2.FRAMEBUFFER_COMPLETE
  ) {
    // 読み込み先フレームバッファーの準備が完了していない場合は処理を中止
    console.log('読み込み先フレームバッファーが不正な状態です');
    return;
  }

  // フレームバッファーをコピー
  gl2.blitFramebuffer(
    0,
    0,
    textureImage.width,
    textureImage.height,
    0,
    CANVAS_HEIGHT - textureImage.height,
    textureImage.width,
    CANVAS_HEIGHT,
    gl2.COLOR_BUFFER_BIT,
    gl2.NEAREST
  );
};

window.addEventListener('DOMContentLoaded', () => main());

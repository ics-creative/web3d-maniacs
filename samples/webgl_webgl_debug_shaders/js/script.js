const main = async () => {
  // キャンバスをセットアップ
  const canvas = document.createElement('canvas');

  // WebGLコンテキスト（WebGLRenderingContext）を取得
  const gl = canvas.getContext('webgl');

  // WEBGL_debug_shaders拡張を取得
  const ext = gl.getExtension('WEBGL_debug_shaders');
  if (!gl || !ext) {
    // WEBGL_debug_shaders拡張をサポートしていない場合
    document.getElementById('content').style.display = 'none';
    document.getElementById('notSupportedDescription').style.display = 'block';
    return;
  }

  ////////////////////////////////////////
  // 頂点シェーダー
  ////////////////////////////////////////

  // 頂点シェーダー用のテキストエリアを取得
  const vertexShaderSourceTextArea = document.getElementById(
    'vertexShaderSourceTextArea'
  );
  const vertexShaderTranslatedTextArea = document.getElementById(
    'vertexShaderTranslatedTextArea'
  );

  // 頂点シェーダーオブジェクトを作成
  const vertexShader = gl.createShader(gl.VERTEX_SHADER);

  // 頂点シェーダーの初期ソースコードを設定
  // language=GLSL
  vertexShaderSourceTextArea.value = `attribute vec3 position;
attribute vec4 color;
varying vec4 vColor;
uniform float uniformValue;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

/**
 * 使用されない関数
 */
float notUsedfunc(float value) {
  return value * value;
}

void main() {
  // 使用されない変数
  float notUsedValue = 7.0 * sin(uniformValue);

  // 最終的には使用されないが、代入が発生する変数
  float notUsedForOutputValue;
  notUsedForOutputValue = 9.0 * cos(uniformValue);
    
  // 三項演算子
  float value = uniformValue < 0.0 ? 1.0 : 2.0;

  // 254回以上のforループ
  for(int i = 0; i < 300; i++){
    value *= value;
  }

  vColor = color * value;

  // 行列演算
  mat4 mvpMatrix = projectionMatrix * modelViewMatrix;
  gl_Position = mvpMatrix * vec4(position, 1.0);
}`;

  // 頂点シェーダーのエディターをセットアップ
  setupShaderEditor(
    gl,
    ext,
    vertexShader,
    vertexShaderSourceTextArea,
    vertexShaderTranslatedTextArea
  );

  ////////////////////////////////////////
  // フラグメントシェーダー
  ////////////////////////////////////////

  // フラグメントシェーダー用のテキストエリアを取得
  const fragmentShaderSourceTextArea = document.getElementById(
    'fragmentShaderSourceTextArea'
  );
  const fragmentShaderTranslatedTextArea = document.getElementById(
    'fragmentShaderTranslatedTextArea'
  );

  // フラグメントシェーダーオブジェクトを作成
  const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);

  // フラグメントシェーダーの初期ソースコードを設定
  // language=GLSL
  fragmentShaderSourceTextArea.value = `precision mediump float;
varying vec4 vColor;
uniform float uniformValue;

/**
 * 使用される関数
 */
float usedFunc(float value) {
  return value * value;
}

void main() { 
  gl_FragColor = vColor * usedFunc(uniformValue);
}`;

  // フラグメントシェーダーのエディターをセットアップ
  setupShaderEditor(
    gl,
    ext,
    fragmentShader,
    fragmentShaderSourceTextArea,
    fragmentShaderTranslatedTextArea
  );
};

/**
 * シェーダーのエディターをセットアップします。
 */
const setupShaderEditor = (
  gl,
  ext,
  shader,
  shaderSourceTextArea,
  shaderTranslatedTextArea
) => {
  const compileShader = () => {
    // エディターからシェーダーソースコードを取得
    const shaderSource = shaderSourceTextArea.value;

    // シェーダーソースコードをセット
    gl.shaderSource(shader, shaderSource);

    // コンパイル
    gl.compileShader(shader);

    // コンパイル状態を取得
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      // コンパイル完了していない場合、エラーログを表示
      shaderTranslatedTextArea.value = gl.getShaderInfoLog(shader);
    } else {
      // コンパイル完了している場合、getTranslatedShaderSource()メソッドで変換済みシェーダーソースコードを表示
      shaderTranslatedTextArea.value = ext.getTranslatedShaderSource(shader);
    }
  };

  let shaderCompileTimerId;
  shaderSourceTextArea.addEventListener('input', () => {
    // ユーザー入力後、一定時間入力がなければコンパイル実行
    clearTimeout(shaderCompileTimerId);
    shaderCompileTimerId = setTimeout(compileShader, 1000);
  });

  // 初期値でコンパイル実行
  compileShader();
};

window.addEventListener('DOMContentLoaded', () => {
  main();
});

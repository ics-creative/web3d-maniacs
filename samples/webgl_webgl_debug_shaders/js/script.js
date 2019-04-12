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
    return;
  }
  document.getElementById('notSupportedDescription').style.display = 'none';

  // 頂点シェーダー用のテキストエリアを取得
  const vertexShaderSourceTextArea = document.getElementById(
    'vertexShaderSourceTextArea'
  );
  const vertexShaderTranslatedTextArea = document.getElementById(
    'vertexShaderTranslatedTextArea'
  );
  const vertexShaderLinkedTextArea = document.getElementById(
    'vertexShaderLinkedTextArea'
  );

  // フラグメントシェーダー用のテキストエリアを取得
  const fragmentShaderSourceTextArea = document.getElementById(
    'fragmentShaderSourceTextArea'
  );
  const fragmentShaderTranslatedTextArea = document.getElementById(
    'fragmentShaderTranslatedTextArea'
  );
  const fragmentShaderLinkedTextArea = document.getElementById(
    'fragmentShaderLinkedTextArea'
  );

  // WebGLProgramを作成
  const program = gl.createProgram();
  // 頂点シェーダーオブジェクトを作成
  const vertexShader = gl.createShader(gl.VERTEX_SHADER);
  gl.attachShader(program, vertexShader);
  // フラグメントシェーダーオブジェクトを作成
  const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.attachShader(program, fragmentShader);

  const linkProgram = setupLinkProgram(
    gl,
    ext,
    program,
    vertexShader,
    fragmentShader,
    vertexShaderLinkedTextArea,
    fragmentShaderLinkedTextArea
  );

  //// 頂点シェーダー

  // 頂点シェーダーの初期ソースコードを設定
  // language=GLSL
  vertexShaderSourceTextArea.value = `attribute vec3 position;
attribute vec4 color;
varying vec4 vColor;
uniform float value;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

void main() {
  float value2 = value < 0.0 ? 1.0 : 2.0;
  for(int i = 0; i < 300; i++){
    value2 += 0.1;
  }
  vColor = color * value2;
  mat4 mvpMatrix = projectionMatrix * modelViewMatrix;
  gl_Position = mvpMatrix * vec4(position, 1.0);
}`;

  // 頂点シェーダーのエディターをセットアップ
  setupShaderEditor(
    gl,
    ext,
    vertexShader,
    vertexShaderSourceTextArea,
    vertexShaderTranslatedTextArea,
    linkProgram
  );

  //// フラグメントシェーダー

  // フラグメントシェーダーの初期ソースコードを設定
  // language=GLSL
  fragmentShaderSourceTextArea.value = `precision mediump float;
varying vec4 vColor;

void main() { 
  gl_FragColor = vColor;
}`;

  // フラグメントシェーダーのエディターをセットアップ
  setupShaderEditor(
    gl,
    ext,
    fragmentShader,
    fragmentShaderSourceTextArea,
    fragmentShaderTranslatedTextArea,
    linkProgram
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
  shaderTranslatedTextArea,
  linkProgram
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

      linkProgram();
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

/**
 * シェーダーのエディターをセットアップします。
 */
const setupLinkProgram = (
  gl,
  ext,
  program,
  vertexShader,
  fragmentShader,
  vertexShaderLinkedTextArea,
  fragmentShaderLinkedTextArea
) => {
  return () => {
    gl.linkProgram(program);
    // リンク状態を取得
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      // リンク完了していない場合、エラーログを表示
      const errorLog = gl.getProgramInfoLog(program);
      vertexShaderLinkedTextArea.value = errorLog;
      fragmentShaderLinkedTextArea.value = errorLog;
    } else {
      // リンク完了している場合、getTranslatedShaderSource()メソッドで変換済みシェーダーソースコードを表示
      vertexShaderLinkedTextArea.value = ext.getTranslatedShaderSource(
        vertexShader
      );
      fragmentShaderLinkedTextArea.value = ext.getTranslatedShaderSource(
        fragmentShader
      );
    }
  };
};

window.addEventListener('DOMContentLoaded', () => main());

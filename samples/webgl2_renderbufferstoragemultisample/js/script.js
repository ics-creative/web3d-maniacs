const CANVAS_WIDTH = 512;
const CANVAS_HEIGHT = 512;
const TEXTURE_WIDTH = CANVAS_WIDTH;
const TEXTURE_HEIGHT = CANVAS_HEIGHT;

const DIRECT_RENDERING_MODE = 0;
const NORMAL_OFFSCREEN_RENDERING_MODE = 1;
const MULTISAMPLE_OFFSCREEN_RENDERING_MODE = 2;

const main = async () => {
  // キャンバスをセットアップ
  const canvas = document.getElementById('myCanvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;

  // WebGL2コンテキスト（WebGL2RenderingContext）を取得
  // アンチエイリアスを有効（デフォルト）に設定
  const gl2 = canvas.getContext('webgl2');
  if (!gl2) {
    // WebGL2をサポートしていない場合
    document.getElementById('content').style.display = 'none';
    return;
  }
  document.getElementById('notSupportedDescription').style.display = 'none';
  document.getElementById('container').style.width = `${CANVAS_WIDTH}px`;

  // 三角形の描画に必要なオブジェクト群を作成
  const triangleProgramSet = createTriangleProgramSet(gl2);
  if (!triangleProgramSet) {
    return;
  }

  // ポストエフェクトの描画に必要なオブジェクト群を作成
  const postEffectProgramSet = createPostEffectProgramSet(gl2);
  if (!postEffectProgramSet) {
    return;
  }

  // セレクトボックスのセットアップ
  let mode = MULTISAMPLE_OFFSCREEN_RENDERING_MODE;
  const selectBox = document.getElementById('selectBox');
  selectBox.selectedIndex = mode;
  selectBox.addEventListener('change', () => {
    mode = selectBox.selectedIndex;
    render();
  });

  // サンプル数の最大値を取得
  const maxSamples = gl2.getParameter(gl2.MAX_SAMPLES);
  console.log('MAX_SAMPLES: ', maxSamples);
  const samples = Math.min(8, maxSamples);

  // マルチサンプリング用のレンダーバッファーを作成
  const multiSampleRenderBuffer = gl2.createRenderbuffer();
  gl2.bindRenderbuffer(gl2.RENDERBUFFER, multiSampleRenderBuffer);
  // レンダーバッファーにマルチサンプリングを設定
  gl2.renderbufferStorageMultisample(
    gl2.RENDERBUFFER,
    samples,
    gl2.RGBA8,
    TEXTURE_WIDTH,
    TEXTURE_HEIGHT
  );

  // マルチサンプリング用のフレームバッファーを作成
  const multiSampleFrameBuffer = gl2.createFramebuffer();
  gl2.bindFramebuffer(gl2.FRAMEBUFFER, multiSampleFrameBuffer);
  // フレームバッファーにレンダーバッファーをアタッチ
  gl2.framebufferRenderbuffer(
    gl2.FRAMEBUFFER,
    gl2.COLOR_ATTACHMENT0,
    gl2.RENDERBUFFER,
    multiSampleRenderBuffer
  );

  // 通常のフレームバッファーに紐付けるテクスチャを作成
  const frameBufferTargetTexture = gl2.createTexture();
  gl2.bindTexture(gl2.TEXTURE_2D, frameBufferTargetTexture);
  gl2.texStorage2D(gl2.TEXTURE_2D, 1, gl2.RGBA8, TEXTURE_WIDTH, TEXTURE_HEIGHT);

  // 通常のフレームバッファーを作成
  const normalFrameBuffer = gl2.createFramebuffer();
  gl2.bindFramebuffer(gl2.FRAMEBUFFER, normalFrameBuffer);
  gl2.framebufferTexture2D(
    gl2.FRAMEBUFFER,
    gl2.COLOR_ATTACHMENT0,
    gl2.TEXTURE_2D,
    frameBufferTargetTexture,
    0
  );

  // バインドをクリア
  gl2.bindTexture(gl2.TEXTURE_2D, null);
  gl2.bindRenderbuffer(gl2.RENDERBUFFER, null);
  gl2.bindFramebuffer(gl2.FRAMEBUFFER, null);

  // 描画の設定
  gl2.clearColor(0.0, 0.0, 0.0, 1.0);
  gl2.enable(gl2.CULL_FACE);

  /**
   * 現在のモードに応じたレンダリングを実行します。
   */
  const render = () => {
    // オフスクリーンレンダリングの場合、描画先のフレームバッファーを指定する
    if (mode === MULTISAMPLE_OFFSCREEN_RENDERING_MODE) {
      // マルチサンプリングのオフスクリーンレンダリングの場合

      // 描画先のフレームバッファーとしてマルチサンプリングのフレームバッファーを指定
      gl2.bindFramebuffer(gl2.FRAMEBUFFER, multiSampleFrameBuffer);
      gl2.viewport(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);
    } else if (mode === NORMAL_OFFSCREEN_RENDERING_MODE) {
      // 通常のオフスクリーンレンダリングの場合

      // 描画先のフレームバッファーとして通常のフレームバッファーを指定
      gl2.bindFramebuffer(gl2.FRAMEBUFFER, normalFrameBuffer);
      gl2.viewport(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);
    }
    gl2.clear(gl2.COLOR_BUFFER_BIT);

    // 三角形をレンダリング
    gl2.useProgram(triangleProgramSet.program);
    gl2.bindVertexArray(triangleProgramSet.vertexArrayObject);
    gl2.drawArrays(gl2.TRIANGLES, 0, triangleProgramSet.vertexCount);

    if (mode === MULTISAMPLE_OFFSCREEN_RENDERING_MODE) {
      // マルチサンプリングのオフスクリーンレンダリングの場合

      // bindFramebuffer()メソッドでマルチサンプリングしたフレームバッファーをテクスチャと紐付いたフレームバッファーへコピー
      gl2.bindFramebuffer(gl2.READ_FRAMEBUFFER, multiSampleFrameBuffer);
      gl2.bindFramebuffer(gl2.DRAW_FRAMEBUFFER, normalFrameBuffer);
      gl2.blitFramebuffer(
        0,
        0,
        TEXTURE_WIDTH,
        TEXTURE_HEIGHT,
        0,
        0,
        TEXTURE_WIDTH,
        TEXTURE_HEIGHT,
        gl2.COLOR_BUFFER_BIT,
        gl2.NEAREST
      );
    }

    // オフスクリーンレンダリングの場合、描画先のフレームバッファーを指定する
    if (
      mode === MULTISAMPLE_OFFSCREEN_RENDERING_MODE ||
      mode === NORMAL_OFFSCREEN_RENDERING_MODE
    ) {
      // 描画先のフレームバッファーとしてデフォルトのフレームバッファーを指定
      gl2.bindFramebuffer(gl2.FRAMEBUFFER, null);
      gl2.viewport(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      gl2.clear(gl2.COLOR_BUFFER_BIT);

      // ポストエフェクトをレンダリング
      gl2.useProgram(postEffectProgramSet.program);
      gl2.activeTexture(gl2.TEXTURE0);
      gl2.bindTexture(gl2.TEXTURE_2D, frameBufferTargetTexture);
      gl2.uniform1i(postEffectProgramSet.textrueLocation, 0);
      gl2.bindVertexArray(postEffectProgramSet.vertexArrayObject);
      gl2.drawElements(
        gl2.TRIANGLES,
        postEffectProgramSet.numIndices,
        gl2.UNSIGNED_INT,
        0
      );
    }
  };

  // 描画処理
  render();
};

/**
 * 画像を読み込んでWebGLTextureオブジェクトを作成します。
 */
const createImageTexture = async (gl2, url) => {
  // 画像を読みこむ
  const textureImage = await new Promise(resolve => {
    const image = new Image();
    image.onload = () => {
      resolve(image);
    };
    image.src = url;
  });

  // テクスチャを作成、転送
  const texture = gl2.createTexture();
  gl2.bindTexture(gl2.TEXTURE_2D, texture);
  gl2.texImage2D(
    gl2.TEXTURE_2D,
    0,
    gl2.RGBA,
    gl2.RGBA,
    gl2.UNSIGNED_BYTE,
    textureImage
  );
  gl2.generateMipmap(gl2.TEXTURE_2D);
  gl2.bindTexture(gl2.TEXTURE_2D, null);

  return texture;
};

/**
 * 三角形の描画に必要なオブジェクト群を作成します。
 */
const createTriangleProgramSet = gl2 => {
  // language=GLSL
  const vertexShaderSource = `#version 300 es
    in vec3 position;
    in vec4 color;
    out vec4 vColor;
  
    void main(void)
    {
      gl_Position = vec4(position, 1.0);
      vColor = color;
    }
  `;

  // language=GLSL
  const fragmentShaderSource = `#version 300 es
    precision mediump float;
  
    in vec4 vColor;
    out vec4 outColor;
  
    void main(void)
    {
      outColor = vColor;
    }
  `;

  const program = createProgram(gl2, vertexShaderSource, fragmentShaderSource);
  if (!program) {
    return null;
  }

  const r = 0.9;
  const RAD = Math.PI / 180;
  const t1 = 90 * RAD;
  const t2 = t1 + 120 * RAD;
  const t3 = t2 + 120 * RAD;
  const vertices = new Float32Array([
    // x, y, z, r, g, b, a
    r * Math.cos(t1),
    r * Math.sin(t1),
    0.0,
    1.0,
    0.0,
    0.0,
    1.0,
    r * Math.cos(t2),
    r * Math.sin(t2),
    0.0,
    0.0,
    1.0,
    0.0,
    1.0,
    r * Math.cos(t3),
    r * Math.sin(t3),
    0.0,
    0.0,
    0.0,
    1.0,
    1.0
  ]);
  const attributeList = [
    { locationIndex: gl2.getAttribLocation(program, 'position'), size: 3 },
    { locationIndex: gl2.getAttribLocation(program, 'color'), size: 4 }
  ];
  const vertexArrayObject = createVertexArray(gl2, vertices, attributeList);

  return { program, vertexArrayObject, vertexCount: 3 };
};

/**
 * ポストエフェクトの描画に必要なオブジェクト群を作成します。
 */
const createPostEffectProgramSet = gl2 => {
  // language=GLSL
  const vertexShaderSource = `#version 300 es
    in vec3 position;
    in vec2 uv;
    out vec2 vUv;
  
    void main(void)
    {
      gl_Position = vec4(position, 1.0);
      vUv = uv;
    }
  `;

  // language=GLSL
  const fragmentShaderSource = `#version 300 es
    #define SPILT_NUM 16.0
  
    precision mediump float;
  
    in vec2 vUv;
    out vec4 outColor;
  
    uniform sampler2D screenTexture;
    
    void main(void)
    {
      vec4 color = texture(screenTexture, vUv);
      // 階調化
      color.rgb = floor(color.rgb * SPILT_NUM) / SPILT_NUM;
      outColor = color;
    }
  `;

  const program = createProgram(gl2, vertexShaderSource, fragmentShaderSource);
  if (!program) {
    return null;
  }

  const vertices = new Float32Array([
    // x, y, z, u, v
    -1.0,
    1.0,
    0.0,
    0.0,
    1.0,

    -1.0,
    -1.0,
    0.0,
    0.0,
    0.0,

    1.0,
    1.0,
    0.0,
    1.0,
    1.0,

    1.0,
    -1.0,
    0.0,
    1.0,
    0.0
  ]);
  const indices = new Uint32Array([0, 1, 2, 2, 1, 3]);
  const attributeList = [
    { locationIndex: gl2.getAttribLocation(program, 'position'), size: 3 },
    { locationIndex: gl2.getAttribLocation(program, 'uv'), size: 2 }
  ];
  const vertexArrayObject = createVertexArray(
    gl2,
    vertices,
    attributeList,
    indices
  );

  const textrueLocation = gl2.getUniformLocation(program, 'screenTexture');

  return {
    program,
    vertexArrayObject,
    numIndices: indices.length,
    textrueLocation
  };
};

/**
 * WebGLProgramを作成します。
 */
const createProgram = (gl2, vertexShaderSource, fragmentShaderSource) => {
  const vertexShader = gl2.createShader(gl2.VERTEX_SHADER);
  gl2.shaderSource(vertexShader, vertexShaderSource);
  gl2.compileShader(vertexShader);
  if (!gl2.getShaderParameter(vertexShader, gl2.COMPILE_STATUS)) {
    console.log(gl2.getShaderInfoLog(vertexShader));
    return null;
  }

  const fragmentShader = gl2.createShader(gl2.FRAGMENT_SHADER);
  gl2.shaderSource(fragmentShader, fragmentShaderSource);
  gl2.compileShader(fragmentShader);
  if (!gl2.getShaderParameter(fragmentShader, gl2.COMPILE_STATUS)) {
    console.log(gl2.getShaderInfoLog(fragmentShader));
    return null;
  }

  const program = gl2.createProgram();
  gl2.attachShader(program, vertexShader);
  gl2.attachShader(program, fragmentShader);
  gl2.linkProgram(program);
  if (!gl2.getProgramParameter(program, gl2.LINK_STATUS)) {
    console.log(gl2.getProgramInfoLog(program));
    return null;
  }

  return program;
};

/**
 * VeretexArrayオブジェクトを作成します。
 */
const createVertexArray = (gl2, vertices, attributeList, indices = null) => {
  const vertexArrayObject = gl2.createVertexArray();
  gl2.bindVertexArray(vertexArrayObject);

  const vertexBufferObject = gl2.createBuffer();
  gl2.bindBuffer(gl2.ARRAY_BUFFER, vertexBufferObject);
  gl2.bufferData(gl2.ARRAY_BUFFER, vertices, gl2.STATIC_DRAW);

  const stride =
    attributeList.reduce(
      (accumulator, currentValue) => accumulator + currentValue.size,
      0
    ) * 4;

  let offset = 0;
  attributeList.forEach(attribute => {
    gl2.enableVertexAttribArray(attribute.locationIndex);
    gl2.vertexAttribPointer(
      attribute.locationIndex,
      attribute.size,
      gl2.FLOAT,
      false,
      stride,
      offset
    );
    offset += attribute.size * 4;
  });

  if (indices) {
    const indexBufferObject = gl2.createBuffer();
    gl2.bindBuffer(gl2.ELEMENT_ARRAY_BUFFER, indexBufferObject);
    gl2.bufferData(gl2.ELEMENT_ARRAY_BUFFER, indices, gl2.STATIC_DRAW);
  }

  gl2.bindVertexArray(null);
  gl2.bindBuffer(gl2.ARRAY_BUFFER, null);
  gl2.bindBuffer(gl2.ELEMENT_ARRAY_BUFFER, null);

  return vertexArrayObject;
};

window.addEventListener('DOMContentLoaded', () => main());

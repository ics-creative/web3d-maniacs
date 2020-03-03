const RAD = Math.PI / 180;
const CANVAS_WIDTH = 512;
const CANVAS_HEIGHT = 512;

// テクスチャ画像1枚ごとのサイズ
const IMAGE_WIDTH = 256;
const IMAGE_HEIGHT = 256;

// テクスチャ数
const NUM_TEXTURES = 32;

const main = async () => {
  // キャンバスをセットアップ
  const canvas = document.getElementById('myCanvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;

  // WebGL2コンテキスト（WebGL2RenderingContext）を取得
  const gl2 = canvas.getContext('webgl2');
  if (!gl2) {
    // WebGL2をサポートしていない場合
    document.getElementById('content').style.display = 'none';
    return;
  }

  gl2.bindTexture(gl2.TEXTURE_2D_ARRAY, null);
  if (gl2.getError() !== gl2.NO_ERROR) {
    // WebGL2をサポートしているが、TEXTURE_2D_ARRAYのバインドをサポートしていない場合（Safari等）
    document.getElementById('content').style.display = 'none';
    return;
  }

  document.getElementById('notSupportedDescription').style.display = 'none';
  document.getElementById('container').style.width = `${CANVAS_WIDTH}px`;

  // テクスチャ設定の最大値を取得
  console.log('MAX_TEXTURE_IMAGE_UNITS: ', gl2.getParameter(gl2.MAX_TEXTURE_IMAGE_UNITS));
  console.log('MAX_ARRAY_TEXTURE_LAYERS: ', gl2.getParameter(gl2.MAX_ARRAY_TEXTURE_LAYERS));

  // オブジェクトの描画に必要なオブジェクト群を作成
  const renderProgramSet = createRenderProgramSet(gl2);
  if (!renderProgramSet) {
    return;
  }

  // 描画の設定
  gl2.clearColor(0.1, 0.1, 0.1, 1.0);
  gl2.clearDepth(1.0);
  gl2.enable(gl2.DEPTH_TEST);
  gl2.depthFunc(gl2.LEQUAL);
  gl2.enable(gl2.BLEND);
  gl2.blendFuncSeparate(gl2.SRC_ALPHA, gl2.ONE_MINUS_SRC_ALPHA, gl2.ONE, gl2.ONE);

  // テクスチャ画像のRGBA値取得用の2Dキャンバスを作成
  const canvas2d = document.createElement('canvas');
  canvas2d.width = IMAGE_WIDTH;
  canvas2d.height = IMAGE_HEIGHT;
  const context2d = canvas2d.getContext('2d');

  // テクスチャ1枚の要素数
  // 幅 * 高さ * 4要素(RGBA)
  const elementsPerTexture = IMAGE_WIDTH * IMAGE_HEIGHT * 4;

  // テクスチャ配列用のUint8Arrayを確保
  // 要素数: テクスチャ1枚の要素数 * テクスチャ数
  const pixelData = new Uint8Array(elementsPerTexture * NUM_TEXTURES);

  for (let i = 0; i < NUM_TEXTURES; i++) {
    // テクスチャ画像の読み込み
    const textureImage = await loadImage(`assets/${i}.jpg`);
    // テクスチャ画像をキャンバスに描画
    context2d.drawImage(textureImage, 0, 0);
    // RGBA値の取得
    const imageData = context2d.getImageData(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
    // RGBA値のセット
    // i番目のテクスチャなので、テクスチャi枚の要素数をオフセットに指定
    pixelData.set(imageData.data, elementsPerTexture * i);
  }

  // テクスチャを作成、転送
  const texture = gl2.createTexture();

  // 0番のテクスチャユニットを指定
  gl2.activeTexture(gl2.TEXTURE0);
  // バインドするターゲットとしてTEXTURE_2D_ARRAYを指定
  gl2.bindTexture(gl2.TEXTURE_2D_ARRAY, texture);
  // 転送にはtexImage3D()メソッドを使用する
  gl2.texImage3D(
    gl2.TEXTURE_2D_ARRAY,
    0,
    gl2.RGBA,
    IMAGE_WIDTH,
    IMAGE_HEIGHT,
    NUM_TEXTURES,
    0,
    gl2.RGBA,
    gl2.UNSIGNED_BYTE,
    pixelData
  );
  // テクスチャパラメータを設定
  gl2.texParameteri(gl2.TEXTURE_2D_ARRAY, gl2.TEXTURE_MAG_FILTER, gl2.NEAREST);
  gl2.texParameteri(gl2.TEXTURE_2D_ARRAY, gl2.TEXTURE_MIN_FILTER, gl2.LINEAR_MIPMAP_LINEAR);
  gl2.texParameteri(gl2.TEXTURE_2D_ARRAY, gl2.TEXTURE_WRAP_S, gl2.CLAMP_TO_EDGE);
  gl2.texParameteri(gl2.TEXTURE_2D_ARRAY, gl2.TEXTURE_WRAP_T, gl2.CLAMP_TO_EDGE);
  // ミップマップを作成
  gl2.generateMipmap(gl2.TEXTURE_2D_ARRAY);

  gl2.useProgram(renderProgramSet.program);

  // カメラ
  const camera = new Camera(45 * RAD, CANVAS_WIDTH / CANVAS_HEIGHT, 0.1, 1000.0);
  const cameraController = new CameraController(camera, canvas);

  /**
   * レンダリングを実行します。
   */
  const render = () => {
    // カメラの設定
    cameraController.update();

    // 描画処理
    gl2.clear(gl2.COLOR_BUFFER_BIT);
    gl2.uniform3fv(renderProgramSet.uniformLocation.cameraPosition, camera.cameraPos);
    gl2.uniformMatrix4fv(renderProgramSet.uniformLocation.mvpMatrix, false, camera.cameraMatrix);
    // 通常のTEXTURE_2Dと同じようにuniform locationを指定
    gl2.uniform1i(renderProgramSet.uniformLocation.textureArray, 0);
    gl2.bindVertexArray(renderProgramSet.vertexArray);
    gl2.drawElementsInstanced(gl2.TRIANGLES, renderProgramSet.numIndices, gl2.UNSIGNED_INT, 0, NUM_TEXTURES);

    requestAnimationFrame(render);
  };

  // 描画処理
  render();
};

/**
 * 画像を読み込みます。
 */
const loadImage = async url =>
  new Promise(resolve => {
    const image = new Image();
    image.onload = () => {
      resolve(image);
    };
    image.src = url;
  });

/**
 * テクスチャの描画に必要なオブジェクト群を作成します。
 */
const createRenderProgramSet = gl2 => {
  // language=GLSL
  const vertexShaderSource = `#version 300 es
  #define PI2 ${Math.PI * 2.0}

  in vec2 position;
  in vec2 uv;
  in float alpha;
  
  out vec2 vUv;
  out float vTextureIndex;
  out float vFog;
  out float vAlpha;
  
  uniform vec3 cameraPosition;
  uniform mat4 mvpMatrix;
  
  const float radius = 20.0;
  const float numInstances = ${NUM_TEXTURES}.0;

  void main(void)
  {
    float theta = float(gl_InstanceID) / numInstances * PI2;
    float cosT = cos(theta);
    float sinT = sin(theta);
    vec3 instancePosition = radius * vec3(cosT, 0.0, sinT);
    mat3 rotY = mat3(sinT, 0.0, -cosT, 0.0, 1.0, 0.0, cosT, 0.0, sinT);
    gl_Position = mvpMatrix * vec4(instancePosition + rotY * vec3(position, 0.0), 1.0);
    vUv = uv;
    vTextureIndex = float(gl_InstanceID);
    vFog = clamp(length(cameraPosition - instancePosition) / 100.0, 0.0, 1.0);
    vAlpha = alpha;
  }
  `;

  // language=GLSL
  const fragmentShaderSource = `#version 300 es
  precision mediump float;
  // sampler2DArrayの精度を指定
  precision mediump sampler2DArray;

  in vec2 vUv;
  in float vTextureIndex;
  in float vFog;
  in float vAlpha;

  out vec4 outColor;

  // sampler2D型の代わりにsampler2DArray型を使用
  uniform sampler2DArray textureArray;

  void main(void)
  {
    // texture()関数の第一引数にsampler2DArrayを指定し、第二引数にvec3(u, v, layer)を指定する
    vec4 color = texture(textureArray, vec3(vUv, vTextureIndex));
    color.a = vAlpha;
    outColor = mix(color, vec4(0.1, 0.1, 0.1, vAlpha), vFog);
  }
  `;

  const program = createProgram(gl2, vertexShaderSource, fragmentShaderSource);
  if (!program) {
    return null;
  }

  const vertices = new Float32Array([
    // x, y, u, v, a
    // cover
    -1.0, 1.0, 0.0, 0.0, 1.0,
    -1.0, -1.0, 0.0, 1.0, 1.0,
    1.0, 1.0, 1.0, 0.0, 1.0,
    1.0, -1.0, 1.0, 1.0, 1.0,

    // reflection
    -1.0, -1.1, 0.0, 1.0, 0.5,
    -1.0, -3.1, 0.0, 0.0, -0.2,
    1.0, -1.1, 1.0, 1.0, 0.5,
    1.0, -3.1, 1.0, 0.0, -0.2
  ]);
  const indices = new Uint32Array([0, 1, 2, 2, 1, 3, 4, 5, 6, 6, 5, 7]);

  const attributeSetList = [
    {
      attributeList: [
        {name: 'position', size: 2},
        {name: 'uv', size: 2},
        {name: 'alpha', size: 1}
      ],
      usage: gl2.STATIC_DRAW,
      data: vertices
    }
  ];

  attributeSetList.forEach(attributeSet => {
    attributeSet.attributeList.forEach(attribute => {
      attribute.locationIndex = gl2.getAttribLocation(program, attribute.name);
    });
  });

  const vertexArray = createVertexArray(gl2, attributeSetList, indices);

  const uniformLocation = {
    cameraPosition: gl2.getUniformLocation(program, 'cameraPosition'),
    mvpMatrix: gl2.getUniformLocation(program, 'mvpMatrix'),
    textureArray: gl2.getUniformLocation(program, 'textureArray')
  };

  return {
    program,
    vertexArray,
    numIndices: indices.length,
    uniformLocation
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
const createVertexArray = (gl2, attributeSetList, indices = null) => {
  const vertexArray = gl2.createVertexArray();
  gl2.bindVertexArray(vertexArray);

  attributeSetList.forEach(attributeSet => {
    const vertexBuffer = gl2.createBuffer();
    gl2.bindBuffer(gl2.ARRAY_BUFFER, vertexBuffer);
    gl2.bufferData(gl2.ARRAY_BUFFER, attributeSet.data, attributeSet.usage);
    attributeSet.buffer = vertexBuffer;

    const stride =
      attributeSet.attributeList.reduce(
        (accumulator, currentValue) => accumulator + currentValue.size,
        0
      ) * Float32Array.BYTES_PER_ELEMENT;

    let offset = 0;
    attributeSet.attributeList.forEach(attribute => {
      gl2.enableVertexAttribArray(attribute.locationIndex);
      gl2.vertexAttribPointer(
        attribute.locationIndex,
        attribute.size,
        gl2.FLOAT,
        false,
        stride,
        offset
      );
      offset += attribute.size * Float32Array.BYTES_PER_ELEMENT;
    });
  });

  if (indices) {
    const indexBuffer = gl2.createBuffer();
    gl2.bindBuffer(gl2.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl2.bufferData(gl2.ELEMENT_ARRAY_BUFFER, indices, gl2.STATIC_DRAW);
  }

  gl2.bindVertexArray(null);
  gl2.bindBuffer(gl2.ARRAY_BUFFER, null);
  gl2.bindBuffer(gl2.ELEMENT_ARRAY_BUFFER, null);

  return vertexArray;
};

/**
 * カメラのクラスです
 */
class Camera {
  constructor(fov, aspect, zNear, zFar) {
    // カメラのUPベクトル
    this.cameraUp = vec3.fromValues(0.0, 1.0, 0.0);
    // カメラ座標
    this.cameraPos = vec3.create();
    // プロジェクション変換行列
    this.projectionMatrix = mat4.create();
    mat4.perspective(this.projectionMatrix, fov, aspect, zNear, zFar);
    // カメラ変換行列
    this.cameraMatrix = mat4.create();

    this.x = 0.0;
    this.y = 0.0;
    this.z = 0.0;
  }

  lookAt(point) {
    vec3.set(this.cameraPos, this.x, this.y, this.z);
    mat4.lookAt(this.cameraMatrix, this.cameraPos, point, this.cameraUp);
    mat4.multiply(this.cameraMatrix, this.projectionMatrix, this.cameraMatrix);
  }
}

/**
 * ユーザー操作に応じてカメラをコントロールするクラスです
 */
class CameraController {
  constructor(camera, stage) {
    this._camera = camera;

    this.cameraTarget = vec3.fromValues(0.0, 0.0, 0.0);
    this.cameraRadiusBase = 23;
    this.cameraRotation = 0;

    this._oldStageX = 0.5;
    this._oldStageY = 0.5;
    this._targetStageX = 0.75;
    this._targetStageY = 0.5;

    stage.addEventListener('mousemove', event => {
      this._moveHandler(event);
    });

    // for touch
    this.isTouch = false;
    this._identifier = -1;
    if ('ontouchstart' in window) {
      stage.addEventListener('touchstart', event => {
        this._touchStartHandler(event);
      });
      stage.addEventListener('touchmove', event => {
        this._touchMoveHandler(event);
      });
      document.addEventListener('touchend', event => {
        this._touchEndHandler(event);
      });
    }
  }

  update(factor = 0.1) {
    const stageX =
      this._oldStageX + (this._targetStageX - this._oldStageX) * factor;
    const stageY =
      this._oldStageY + (this._targetStageY - this._oldStageY) * factor;

    this.cameraRotation += (stageX - 0.5) / 50;
    const cameraRadius = this.cameraRadiusBase + stageY * 20;

    this._camera.x = cameraRadius * Math.cos(this.cameraRotation);
    this._camera.z = cameraRadius * Math.sin(this.cameraRotation);
    this._camera.y = -0.7 + stageY * 10;
    this._camera.lookAt(this.cameraTarget);

    this._oldStageX = stageX;
    this._oldStageY = stageY;
  }

  _moveHandler(event) {
    const rect = event.target.getBoundingClientRect();
    const stageX = event.clientX - rect.left;
    const stageY = event.clientY - rect.top;

    this._updateTarget(stageX, stageY);
  }

  _touchStartHandler(event) {
    event.preventDefault();
    if (!this.isTouch) {
      const touches = event.changedTouches;
      const touch = touches[0];
      this.isTouch = true;
      this._identifier = touch.identifier;
      const target = touch.target;
      const stageX = touch.pageX - target.offsetLeft;
      const stageY = touch.pageY - target.offsetTop;

      this._updateTarget(stageX, stageY);
    }
  }

  _touchMoveHandler(event) {
    event.preventDefault();

    const touches = event.changedTouches;
    const touchLength = touches.length;
    for (let i = 0; i < touchLength; i++) {
      const touch = touches[i];
      if (touch.identifier === this._identifier) {
        const target = touch.target;
        const stageX = touch.pageX - target.offsetLeft;
        const stageY = touch.pageY - target.offsetTop;
        this._updateTarget(stageX, stageY);
        break;
      }
    }
  }

  _touchEndHandler(event) {
    if (this.isTouch) {
      event.preventDefault();
    }
    this.isTouch = false;
    this._identifier = -1;
  }

  _updateTarget(newX, newY) {
    const stageX = newX / CANVAS_WIDTH;
    const stageY = newY / CANVAS_HEIGHT;
    if (stageX < 0.4 || stageX > 0.6) {
      this._targetStageX = stageX;
    } else {
      this._targetStageX = 0.5;
    }
    this._targetStageY = stageY;
  }
}

window.addEventListener('DOMContentLoaded', () => main());

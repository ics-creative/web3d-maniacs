import {Camera} from "./Camera.js";
import {RoundCameraController} from "./RoundCameraController.js";
import {SceneObject} from "./SceneObject.js";

const RAD = Math.PI / 180;
const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 540;

// テクスチャ画像1枚ごとのサイズ
const IMAGE_WIDTH = 512;
const IMAGE_HEIGHT = 512;

// テクスチャ数
const NUM_TEXTURES = 351;

const main = async () => {
  const content = document.getElementById("content");
  const notSupportedDescription = document.getElementById("notSupportedDescription");

  // キャンバスをセットアップ
  const canvas = document.getElementById("myCanvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;

  // WebGL2コンテキスト（WebGL2RenderingContext）を取得
  const gl2 = canvas.getContext("webgl2");
  if (!gl2) {
    // WebGL2をサポートしていない場合
    content.style.display = "none";
    notSupportedDescription.style.display = "block";
    return;
  }

  gl2.bindTexture(gl2.TEXTURE_3D, null);
  if (gl2.getError() !== gl2.NO_ERROR) {
    // WebGL2をサポートしているが、TEXTURE_3Dのバインドをサポートしていない場合
    content.style.display = "none";
    notSupportedDescription.style.display = "block";
    return;
  }

  const loading = document.getElementById("loading");
  content.style.width = loading.style.width = `${CANVAS_WIDTH}px`;
  content.style.height = loading.style.height = `${CANVAS_HEIGHT}px`;

  // テクスチャ設定の最大値を取得
  console.log("MAX_3D_TEXTURE_SIZE: ", gl2.getParameter(gl2.MAX_3D_TEXTURE_SIZE));

  // オブジェクトの描画に必要なオブジェクト群を作成
  const renderProgramSet = createRenderProgramSet(gl2);
  if (!renderProgramSet) {
    return;
  }

  const obj = new SceneObject();

  const param = {
    iteration: 100,
    baseAlpha: 0.05,
    threshold: 0.5,
    slicePosition: 0.0,
    radius: 2.0,
    theta: 180,
    phi: 90
  };
  const action = {
    reflectParameter: () => {
      param.radius = cameraController.radius;
      param.theta = Math.round(cameraController._theta);
      param.phi = Math.round(cameraController._phi);
      history.replaceState(undefined, "", `#${Object.keys(param).sort().map(key => param[key]).join("/")}`);
    }
  };

  try {
    const paramArr = window.location.hash.substring(1).split("/").map(str => parseFloat(str));
    if (paramArr && paramArr.length >= 7) {
      Object.keys(param).sort().forEach((key, index) => {
        if (!isNaN(paramArr[index])) {
          param[key] = paramArr[index];
        }
      });
    }
  } catch {
  }

  const gui = new dat.GUI({autoPlace: true});
  gui.add(param, "iteration", 1, 300).step(1);
  gui.add(param, "baseAlpha", 0.0, 1.0).step(0.001);
  gui.add(param, "threshold", 0.0, 1.0).step(0.01);
  gui.add(param, "slicePosition", 0.0, 1.0).step(0.01);
  gui.add(action, "reflectParameter").name("reflect to URL");

  // 描画の設定
  gl2.clearColor(0.1, 0.1, 0.1, 1.0);
  gl2.enable(gl2.CULL_FACE);
  gl2.enable(gl2.BLEND);
  gl2.blendFuncSeparate(gl2.SRC_ALPHA, gl2.ONE_MINUS_SRC_ALPHA, gl2.ONE, gl2.ONE);

  // 背景色を描画
  gl2.clear(gl2.COLOR_BUFFER_BIT);

  // テクスチャ画像のRGBA値取得用の2Dキャンバスを作成
  const canvas2d = document.createElement("canvas");
  canvas2d.width = IMAGE_WIDTH;
  canvas2d.height = IMAGE_HEIGHT;
  const context2d = canvas2d.getContext("2d");

  // テクスチャ1枚の要素数
  // 幅 * 高さ * 4要素(RGBA)
  const elementsPerTexture = IMAGE_WIDTH * IMAGE_HEIGHT * 4;

  // 3Dテクスチャ用のUint8Arrayを確保
  // 要素数: テクスチャ1枚の要素数 * テクスチャ数
  const pixelData = new Uint8Array(elementsPerTexture * NUM_TEXTURES);

  const strLength = NUM_TEXTURES.toString().length;
  const showLoadingProgress = progress => {
    loading.querySelector(".progress").innerHTML = `${String(progress).padStart(strLength, "0")} / ${NUM_TEXTURES}`;
  };
  // ローディング表示
  loading.style.display = "flex";

  showLoadingProgress(0);

  let numCompletedImages = 0;
  const taskList = [...Array(NUM_TEXTURES).keys()].map(i => new Promise(async resolve => {
    // テクスチャ画像の読み込み
    const textureImage = await loadImage(`assets/${String(i + 1).padStart(8, "0")}.JPG`);
    // テクスチャ画像をキャンバスに描画
    context2d.drawImage(textureImage, 0, 0);
    // RGBA値の取得
    const imageData = context2d.getImageData(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
    // RGBA値のセット
    // i番目のテクスチャなので、テクスチャi枚の要素数をオフセットに指定
    pixelData.set(imageData.data, elementsPerTexture * i);

    numCompletedImages += 1;
    showLoadingProgress(numCompletedImages);

    resolve();
  }));

  await Promise.all(taskList);

  // テクスチャを作成、転送
  const texture = gl2.createTexture();

  // 0番のテクスチャユニットを指定
  gl2.activeTexture(gl2.TEXTURE0);
  // バインドするターゲットとしてTEXTURE_3Dを指定
  gl2.bindTexture(gl2.TEXTURE_3D, texture);
  // 転送にはtexImage3D()メソッドを使用する
  gl2.texImage3D(
    gl2.TEXTURE_3D,
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
  gl2.texParameteri(gl2.TEXTURE_3D, gl2.TEXTURE_MAG_FILTER, gl2.LINEAR);
  gl2.texParameteri(gl2.TEXTURE_3D, gl2.TEXTURE_MIN_FILTER, gl2.LINEAR_MIPMAP_LINEAR);
  gl2.texParameteri(gl2.TEXTURE_3D, gl2.TEXTURE_WRAP_S, gl2.CLAMP_TO_EDGE);
  gl2.texParameteri(gl2.TEXTURE_3D, gl2.TEXTURE_WRAP_T, gl2.CLAMP_TO_EDGE);
  gl2.texParameteri(gl2.TEXTURE_3D, gl2.TEXTURE_WRAP_R, gl2.CLAMP_TO_EDGE);
  // ミップマップを作成
  gl2.generateMipmap(gl2.TEXTURE_3D);

  // ローディング非表示
  loading.style.display = "none";

  gl2.useProgram(renderProgramSet.program);

  // カメラ
  const camera = new Camera(45 * RAD, CANVAS_WIDTH / CANVAS_HEIGHT, 0.1, 1000.0);
  const cameraController = new RoundCameraController(camera, canvas);
  cameraController.radius = param.radius;
  cameraController.set(param.theta, param.phi);
  cameraController.update(1.0);

  const mvpMatrix = mat4.create();
  const invertMvMatrix = mat4.create();
  const originVec = vec4.fromValues(0, 0, 0, 1);
  const modelSpaceVec = vec4.create();

  /**
   * レンダリングを実行します。
   */
  const render = () => {
    // カメラの設定
    cameraController.update();

    mat4.multiply(mvpMatrix, camera.getCameraMtx(), obj.getModelMatrix());

    mat4.multiply(invertMvMatrix, camera.getLookMtx(), obj.getModelMatrix());
    mat4.invert(invertMvMatrix, invertMvMatrix);
    vec4.transformMat4(modelSpaceVec, originVec, invertMvMatrix);

    // 描画準備
    gl2.uniformMatrix4fv(renderProgramSet.uniformLocation.mvpMatrix, false, mvpMatrix);
    gl2.uniform4fv(renderProgramSet.uniformLocation.modelSpaceCameraPosition, modelSpaceVec);
    gl2.uniform1f(renderProgramSet.uniformLocation.iteration, param.iteration);
    gl2.uniform1f(renderProgramSet.uniformLocation.baseAlpha, param.baseAlpha);
    gl2.uniform1f(renderProgramSet.uniformLocation.threshold, param.threshold);
    gl2.uniform1f(renderProgramSet.uniformLocation.slicePosition, param.slicePosition);
    // 通常のTEXTURE_2Dと同じようにuniform locationを指定
    gl2.uniform1i(renderProgramSet.uniformLocation.texture3D, 0);
    gl2.bindVertexArray(renderProgramSet.vertexArray);

    // 描画処理
    gl2.clear(gl2.COLOR_BUFFER_BIT);
    gl2.drawElements(gl2.TRIANGLES, renderProgramSet.numIndices, gl2.UNSIGNED_INT, 0);

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
  in vec3 position;
  out vec3 vPosition;
  uniform mat4 mvpMatrix;

  void main(void)
  {
    vPosition = position;
    gl_Position = mvpMatrix * vec4(position, 1.0);
  }
  `;

  // language=GLSL
  const fragmentShaderSource = `#version 300 es
  #define R3 ${Math.sqrt(3)}
  
  precision mediump float;
  // sampler3Dの精度を指定
  precision mediump sampler3D;

  in vec3 vPosition;
  out vec4 outColor;

  // sampler2D型の代わりにsampler3D型を使用
  uniform sampler3D texture3D;
  uniform vec4 modelSpaceCameraPosition;
  uniform float iteration;
  uniform float baseAlpha;
  uniform float threshold;
  uniform float slicePosition;

  void main(void)
  {
    // レイ1ステップのベクトルを計算
    vec3 eyeDirectionStep = normalize(vPosition - modelSpaceCameraPosition.xyz) * R3 / iteration;

    outColor = vec4(0.0);
    for(float i = 0.0; i < iteration; i++){
      // 3Dテクスチャ座標を計算
      vec3 textureCoord = vec3(0.5) - vec3(vPosition + eyeDirectionStep * (iteration - 1.0 - i));
      
      // テクスチャ座標が範囲内の場合のみ
      if(textureCoord.x > 0.0 && textureCoord.x < 1.0 
      && textureCoord.y > 0.0 && textureCoord.y < 1.0 
      && textureCoord.z > 0.0 && textureCoord.z < 1.0 - slicePosition){
        // texture()関数の第一引数にsampler3Dを指定し、第二引数にvec3(u, v, w)を指定する
        vec4 color = texture(texture3D, textureCoord);
        // しきい値未満の色の場合非表示とする
        float cutoffAlpha = baseAlpha * step(threshold, color.r);
        outColor = color * cutoffAlpha + outColor * (1.0 - cutoffAlpha);
      }
    }
  }
  `;

  const program = createProgram(gl2, vertexShaderSource, fragmentShaderSource);
  if (!program) {
    return null;
  }

  // キューブ（立方体）の頂点構造を定義
  const vertices = new Float32Array([
    // x, y, z
    -0.5, 0.5, 0.5,
    -0.5, -0.5, 0.5,
    0.5, 0.5, 0.5,
    0.5, -0.5, 0.5,

    -0.5, 0.5, -0.5,
    -0.5, -0.5, -0.5,
    0.5, 0.5, -0.5,
    0.5, -0.5, -0.5,
  ]);
  const indices = new Uint32Array([
    0, 1, 2, 2, 1, 3,
    2, 3, 6, 6, 3, 7,
    6, 7, 4, 4, 7, 5,
    4, 5, 0, 0, 5, 1,
    4, 0, 6, 6, 0, 2,
    1, 5, 3, 3, 5, 7
  ]);

  const attributeSetList = [
    {
      attributeList: [
        {name: "position", size: 3}
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
    mvpMatrix: gl2.getUniformLocation(program, "mvpMatrix"),
    iteration: gl2.getUniformLocation(program, "iteration"),
    baseAlpha: gl2.getUniformLocation(program, "baseAlpha"),
    threshold: gl2.getUniformLocation(program, "threshold"),
    slicePosition: gl2.getUniformLocation(program, "slicePosition"),
    texture3D: gl2.getUniformLocation(program, "texture3D"),
    modelSpaceCameraPosition: gl2.getUniformLocation(program, "modelSpaceCameraPosition")
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

window.addEventListener("DOMContentLoaded", () => {
  main();
});

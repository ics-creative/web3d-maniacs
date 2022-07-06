import {Camera} from "./Camera.js";
import {RoundCameraController} from "./RoundCameraController.js";
import {GLTFLoader} from "./GLTFLoader.js";
import {SceneObject} from "./SceneObject.js";

const {vec3, vec4} = glMatrix;

const RAD = Math.PI / 180;
const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 540;

const AMBIENT_LIGHT_COLOR = vec4.fromValues(0.2, 0.2, 0.2, 1.0);
const DIRECTIONAL_LIGHT_COLOR = vec4.fromValues(0.8, 0.8, 0.8, 1.0);
const DIRECTIONAL_LIGHT_DIRECTION = vec3.fromValues(1.0, 1.0, 1.0);

const main = async () => {
  const content = document.getElementById("content");
  const notSupportedDescription = document.getElementById("notSupportedDescription");

  // キャンバスをセットアップ
  const canvas = document.getElementById("myCanvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  content.style.width = `${CANVAS_WIDTH}px`;
  content.style.height = `${CANVAS_HEIGHT}px`;

  // WebGL2コンテキスト（WebGL2RenderingContext）を取得
  const gl2 = canvas.getContext("webgl2");
  if (!gl2) {
    // WebGL2をサポートしていない場合
    content.style.display = "none";
    notSupportedDescription.style.display = "block";
    return;
  }

  // GLTFモデルを読み込み
  const gltfData = await GLTFLoader.load("assets/Suzanne.gltf");
  console.log(gltfData);

  const locationIndex = {position: 0, normal: 1};
  const attributeBufferList = [
    {
      attributeList: [{name: "position", size: 3, locationIndex: locationIndex.position}],
      data: gltfData.position.data,
      usage: gl2.STATIC_DRAW
    },
    {
      attributeList: [{name: "normal", size: 3, locationIndex: locationIndex.normal}],
      data: gltfData.normal.data,
      usage: gl2.STATIC_DRAW
    }
  ];

  // ライティングを含めたレンダリングをする本描画用シェーダーを作成
  const renderProgramSet = createRenderProgramSet(gl2, locationIndex);
  // 深度のみを更新する深度テスト用シェーダーを作成
  const depthWriteProgramSet = createDepthWriteProgramSet(gl2, locationIndex);
  if (!renderProgramSet || !depthWriteProgramSet) {
    return;
  }

  // ジオメトリ設定を作成
  const renderGeometrySet = createRenderGeometrySet(gl2, attributeBufferList, gltfData.indices.data);
  gl2.bindVertexArray(renderGeometrySet.vertexArray);

  // 描画オブジェクトの設定
  const red = {
    name: "Model A (RED)",
    color: new Float32Array([1.0, 0.0, 0.0, 1.0]),
    transform: new SceneObject(),
    rotation: {x: -90, y: 90}
  };
  red.transform.x = -1;

  const green = {
    name: "Model B (GREEN)",
    color: new Float32Array([0.0, 1.0, 0.0, 1.0]),
    transform: new SceneObject(),
    rotation: {x: -90, y: 0}
  };
  green.transform.x = 2;

  const objList = [red, green];

  // モデルの状態を操作するGUIを作成
  const gui = new lil.GUI({container: document.getElementById("gui")});
  objList.forEach((obj) => {
    const folder = gui.addFolder(obj.name);
    folder.open();
    folder.add(obj.transform, "x", -5, 5).step(0.01);
    folder.add(obj.transform, "y", -5, 5).step(0.01);
    folder.add(obj.transform, "z", -5, 5).step(0.01);
    folder.add(obj.rotation, "x", -90, 90).step(1).name("rotation x");
    folder.add(obj.rotation, "y", -90, 90).step(1).name("rotation y");
  });

  // 描画の設定
  // カラーバッファのクリア色を設定
  gl2.clearColor(0.5, 0.5, 0.5, 1.0);
  // 隠面カリングを有効化
  gl2.enable(gl2.CULL_FACE);
  // CCWを表面に設定
  gl2.frontFace(gl2.CCW);
  // 深度テストを有効化
  gl2.enable(gl2.DEPTH_TEST);
  // 深度バッファのクリア値を設定
  gl2.clearDepth(1.0);

  // 背景色を描画
  gl2.clear(gl2.COLOR_BUFFER_BIT);


  // カメラ
  const camera = new Camera(45 * RAD, CANVAS_WIDTH / CANVAS_HEIGHT, 0.1, 1000.0);
  const cameraController = new RoundCameraController(camera, canvas);
  canvas.style.cursor = "move";
  cameraController.radius = 10;
  cameraController.radiusOffset = 1;
  cameraController.rotate(0, 0);

  // オクルージョンクエリとデバッグ表示のDOMをまとめたオブジェクトを作成

  /** @type {QueryPool} */
  const queryAB = {
    availableList: [],
    waitingList: [],
    dom: document.getElementById("ab")
  };

  /** @type {QueryPool} */
  const queryBA = {
    availableList: [],
    waitingList: [],
    dom: document.getElementById("ba")
  };

  const collisionDom = document.getElementById("collision");

  /**
   * 与えられたクエリプールについて、キューの最初のクエリがクエリ結果取得可能であれば返却
   * @param {QueryPool} queryPool
   * @return {WebGLQuery || null}
   */
  const getResultAvailableQuery = (queryPool) => {
    const waitingQuery = queryPool.waitingList.length ? queryPool.waitingList[0] : null;
    if (waitingQuery && gl2.getQueryParameter(waitingQuery, gl2.QUERY_RESULT_AVAILABLE)) {
      queryPool.availableList.push(queryPool.waitingList.shift());
      return waitingQuery;
    }
    return null;
  };

  /**
   * 与えられたクエリプールについて、使用可能なクエリを返却
   * @param {QueryPool} queryPool
   * @return {WebGLQuery}
   */
  const getAvailableQuery = (querySet) => {
    const availableQuery = querySet.availableList.length ? querySet.availableList.shift() : gl2.createQuery();
    querySet.waitingList.push(availableQuery);
    return availableQuery;
  };

  /**
   * レンダリングを実行
   */
  const render = () => {
    // カメラを更新
    cameraController.update(0.1);
    const cameraMatrix = camera.getCameraMatrix();

    // モデルの状態を更新
    for (let i = 0; i < objList.length; i++) {
      const obj = objList[i];
      obj.transform.rotationX = obj.rotation.x * RAD;
      obj.transform.rotationY = obj.rotation.y * RAD;
    }

    // 衝突しているかどうか
    let isCollided = false;

    // 過去に取得したクエリから衝突を判定
    {
      // A→Bの結果を取得
      const resultAvailableQueryAB = getResultAvailableQuery(queryAB);
      let anySamplesPassedConservativeAB;
      if (resultAvailableQueryAB) {
        anySamplesPassedConservativeAB = gl2.getQueryParameter(resultAvailableQueryAB, gl2.QUERY_RESULT);
        queryAB.dom.innerText = anySamplesPassedConservativeAB;
      }

      // B→Aの結果を取得
      const resultAvailableQueryBA = getResultAvailableQuery(queryBA);
      let anySamplesPassedConservativeBA;
      if (resultAvailableQueryBA) {
        anySamplesPassedConservativeBA = gl2.getQueryParameter(resultAvailableQueryBA, gl2.QUERY_RESULT);
        queryBA.dom.innerText = anySamplesPassedConservativeBA;
      }

      // 衝突しているかどうかを判定
      if (resultAvailableQueryAB && resultAvailableQueryBA) {
        isCollided = anySamplesPassedConservativeAB && anySamplesPassedConservativeBA;
        collisionDom.innerText = (isCollided === 1).toString();
      }
    }

    // 以下描画処理
    {
      // 最初に深度のみで判定するため、カラーバッファへの書き込みを無効化
      gl2.colorMask(false, false, false, false);

      // 深度のみ描画するシェーダーに変更
      gl2.useProgram(depthWriteProgramSet.program);
      gl2.uniformMatrix4fv(depthWriteProgramSet.uniformLocation.vpMatrix, false, cameraMatrix);

      // 深度バッファへの書き込みを有効化（深度バッファをクリアするため、このタイミングで）
      gl2.depthMask(true);
      // ステップ1 深度バッファをクリア
      gl2.clear(gl2.DEPTH_BUFFER_BIT);

      // 赤→緑の順番で描画を実行する（緑の裏面が完全に赤の表面より前にあるかどうかを計測）
      {
        // ステップ2
        {
          // 深度テストの合格条件を「以下」に設定
          gl2.depthFunc(gl2.LEQUAL);
          // 深度バッファへの書き込みを有効化（上記ですでに呼んでいるので不要）
          // gl2.depthMask(true);
          // 表面のみ描画
          gl2.cullFace(gl2.BACK);

          // 最初のモデル（赤）を描画
          gl2.uniformMatrix4fv(depthWriteProgramSet.uniformLocation.modelMatrix, false, red.transform.getModelMatrix());
          gl2.drawElements(gl2.TRIANGLES, gltfData.indices.length, gl2.UNSIGNED_SHORT, 0);
        }

        // ステップ3
        {
          // 深度テストの合格条件を「以上」に設定
          gl2.depthFunc(gl2.GEQUAL);
          // 深度バッファへの書き込みを無効化
          gl2.depthMask(false);
          // 裏面のみ描画
          gl2.cullFace(gl2.FRONT);

          // クエリ計測を開始
          gl2.beginQuery(gl2.ANY_SAMPLES_PASSED_CONSERVATIVE, getAvailableQuery(queryAB));
          // 次のモデル（緑）を描画
          gl2.uniformMatrix4fv(depthWriteProgramSet.uniformLocation.modelMatrix, false, green.transform.getModelMatrix());
          gl2.drawElements(gl2.TRIANGLES, gltfData.indices.length, gl2.UNSIGNED_SHORT, 0);
          // クエリ計測を終了
          gl2.endQuery(gl2.ANY_SAMPLES_PASSED_CONSERVATIVE);
        }
      }

      // 以下赤と緑の役割を交換して再度同じ処理を実行

      // 深度バッファへの書き込みを有効化（深度バッファをクリアするため、このタイミングで）
      gl2.depthMask(true);
      // ステップ1 深度バッファをクリア
      gl2.clear(gl2.DEPTH_BUFFER_BIT);

      // 緑→赤の順番で描画を実行する（赤の裏面が完全に緑の表面より前にあるかどうかを計測）
      {
        // ステップ2
        {
          // 深度テストの合格条件を「以下」に設定
          gl2.depthFunc(gl2.LEQUAL);
          // 深度バッファへの書き込みを有効化（上記ですでに呼んでいるので不要）
          // gl2.depthMask(true);
          // 表面のみ描画
          gl2.cullFace(gl2.BACK);

          // 最初のモデル（緑）を描画
          gl2.uniformMatrix4fv(depthWriteProgramSet.uniformLocation.modelMatrix, false, green.transform.getModelMatrix());
          gl2.drawElements(gl2.TRIANGLES, gltfData.indices.length, gl2.UNSIGNED_SHORT, 0);
        }

        // ステップ3
        {
          // 深度テストの合格条件を「以上」に設定
          gl2.depthFunc(gl2.GEQUAL);
          // 深度バッファへの書き込みを無効化
          gl2.depthMask(false);
          // 裏面のみ描画
          gl2.cullFace(gl2.FRONT);

          // クエリ計測を開始
          gl2.beginQuery(gl2.ANY_SAMPLES_PASSED_CONSERVATIVE, getAvailableQuery(queryBA));
          // 次のモデル（赤）を描画
          gl2.uniformMatrix4fv(depthWriteProgramSet.uniformLocation.modelMatrix, false, red.transform.getModelMatrix());
          gl2.drawElements(gl2.TRIANGLES, gltfData.indices.length, gl2.UNSIGNED_SHORT, 0);
          // クエリ計測を終了
          gl2.endQuery(gl2.ANY_SAMPLES_PASSED_CONSERVATIVE);
        }
      }
    }

    // 以下本描画に向けて設定

    // 深度テストの合格条件を「以下」に設定
    gl2.depthFunc(gl2.LEQUAL);
    // 深度バッファへの書き込みを有効化
    gl2.depthMask(true);
    // 表面のみ描画
    gl2.cullFace(gl2.BACK);
    // カラーバッファへの書き込みを有効化
    gl2.colorMask(true, true, true, true);
    // カラーバッファと深度バッファをクリア
    gl2.clear(gl2.COLOR_BUFFER_BIT | gl2.DEPTH_BUFFER_BIT);

    // モデルの本描画
    gl2.useProgram(renderProgramSet.program);
    gl2.uniformMatrix4fv(renderProgramSet.uniformLocation.vpMatrix, false, cameraMatrix);
    gl2.uniform4fv(renderProgramSet.uniformLocation.ambientLightColor, AMBIENT_LIGHT_COLOR);
    gl2.uniform4fv(renderProgramSet.uniformLocation.directionalLightColor, DIRECTIONAL_LIGHT_COLOR);
    gl2.uniform3fv(renderProgramSet.uniformLocation.directionalLightDirection, DIRECTIONAL_LIGHT_DIRECTION);
    for (let i = 0; i < objList.length; i++) {
      const obj = objList[i];
      gl2.uniformMatrix4fv(renderProgramSet.uniformLocation.modelMatrix, false, obj.transform.getModelMatrix());
      gl2.uniform4fv(renderProgramSet.uniformLocation.baseColor, obj.color);
      // 衝突していればオブジェクトを光らせる
      gl2.uniform1f(renderProgramSet.uniformLocation.collidedColorFactor, isCollided ? 2.0 : 1.0);
      gl2.drawElements(gl2.TRIANGLES, gltfData.indices.length, gl2.UNSIGNED_SHORT, 0);
    }

    requestAnimationFrame(render);
  };

  render();
};

/**
 * ライティングを含めたレンダリングをする本描画用シェーダーを作成
 */
const createRenderProgramSet = (gl2, locationIndex) => {
  // language=GLSL
  const vertexShaderSource = `#version 300 es
  layout (location = ${locationIndex.position}) in vec3 position;
  layout (location = ${locationIndex.normal}) in vec3 normal;
  out vec4 vColor;

  uniform mat4 vpMatrix;
  uniform mat4 modelMatrix;
  uniform float collidedColorFactor;
  uniform vec4 baseColor;
  uniform vec4 ambientLightColor;
  uniform vec4 directionalLightColor;
  uniform vec3 directionalLightDirection;

  void main(void)
  {
    mat3 nMatrix = mat3(modelMatrix);
    nMatrix = inverse(nMatrix);
    vec3 worldNormal = normalize(normalize(normal) * nMatrix);// transpose
    float diffuse = dot(worldNormal.xyz, normalize(directionalLightDirection));
    diffuse = clamp(diffuse, 0.0, 1.0);

    vColor = baseColor * (ambientLightColor + diffuse * directionalLightColor) * collidedColorFactor;
    gl_Position = vpMatrix * modelMatrix * vec4(position, 1.0);
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
  const uniformNameList = [
    "vpMatrix",
    "modelMatrix",
    "collidedColorFactor",
    "baseColor",
    "ambientLightColor",
    "directionalLightColor",
    "directionalLightDirection"
  ];
  const uniformLocation = {};
  uniformNameList.forEach(name => {
    uniformLocation[name] = gl2.getUniformLocation(program, name);
  });

  return {
    program,
    uniformLocation
  };
};

/**
 * 深度のみを更新する深度テスト用シェーダーを作成
 */
const createDepthWriteProgramSet = (gl2, locationIndex) => {
  // language=GLSL
  const vertexShaderSource = `#version 300 es
  layout (location = ${locationIndex.position}) in vec3 position;

  uniform mat4 vpMatrix;
  uniform mat4 modelMatrix;

  void main(void)
  {
    gl_Position = vpMatrix * modelMatrix * vec4(position, 1.0);
  }
  `;

  // language=GLSL
  const fragmentShaderSource = `#version 300 es
  precision mediump float;

  out vec4 outColor;

  void main(void)
  {
    outColor = vec4(1.0);
  }
  `;

  const program = createProgram(gl2, vertexShaderSource, fragmentShaderSource);
  if (!program) {
    return null;
  }
  const uniformNameList = [
    "vpMatrix",
    "modelMatrix"
  ];
  const uniformLocation = {};
  uniformNameList.forEach(name => {
    uniformLocation[name] = gl2.getUniformLocation(program, name);
  });

  return {
    program,
    uniformLocation
  };
};

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

const createRenderGeometrySet = (gl2, attributeBufferList, indices = null) => {
  const vertexArray = gl2.createVertexArray();
  gl2.bindVertexArray(vertexArray);

  const vertexBufferObjectList = [];

  attributeBufferList.forEach((attributePerBuffer, i) => {
    const vertexBufferObject = createVertexBuffer(gl2, attributePerBuffer.data, attributePerBuffer.usage);
    vertexBufferObjectList[i] = vertexBufferObject;
    gl2.bindBuffer(gl2.ARRAY_BUFFER, vertexBufferObject.buffer);

    const stride =
      attributePerBuffer.attributeList.reduce(
        (accumulator, currentValue) => accumulator + currentValue.size,
        0
      ) * Float32Array.BYTES_PER_ELEMENT;

    let offset = 0;
    attributePerBuffer.attributeList.forEach(attribute => {
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
    const indexBufferObject = gl2.createBuffer();
    gl2.bindBuffer(gl2.ELEMENT_ARRAY_BUFFER, indexBufferObject);
    gl2.bufferData(gl2.ELEMENT_ARRAY_BUFFER, indices, gl2.STATIC_DRAW);
  }

  gl2.bindVertexArray(null);
  gl2.bindBuffer(gl2.ARRAY_BUFFER, null);
  gl2.bindBuffer(gl2.ELEMENT_ARRAY_BUFFER, null);

  return {vertexArray, vertexBufferObjectList};
};

const createVertexBuffer = (gl2, bufferData, usage) => {
  const buffer = gl2.createBuffer();
  gl2.bindBuffer(gl2.ARRAY_BUFFER, buffer);
  gl2.bufferData(gl2.ARRAY_BUFFER, bufferData, usage);

  gl2.bindBuffer(gl2.ARRAY_BUFFER, null);

  const updateBuffer = () => {
    gl2.bindBuffer(gl2.ARRAY_BUFFER, buffer);
    gl2.bufferSubData(gl2.ARRAY_BUFFER, 0, bufferData);
    gl2.bindBuffer(gl2.ARRAY_BUFFER, null);
  };

  return {
    buffer,
    updateBuffer
  };
};

window.addEventListener("DOMContentLoaded", () => main());

/**
 * @typedef {Object} QueryPool
 *
 * @property {WebGLQuery[]} availableList
 * @property {WebGLQuery[]} waitingList
 * @property {HTMLDivElement} dom
 */
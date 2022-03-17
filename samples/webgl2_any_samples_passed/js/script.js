const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 540;

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

  content.style.width = `${CANVAS_WIDTH}px`;
  content.style.height = `${CANVAS_HEIGHT}px`;

  // 描画に描画に必要なオブジェクト群を作成
  const renderProgramSet = createRenderProgramSet(gl2);
  if (!renderProgramSet) {
    return;
  }

  // GUIを作成
  const gui = new lil.GUI({autoPlace: false});
  document.getElementById("gui").appendChild(gui.domElement);

  // オブジェクトを赤緑青の順番（この順番で描画する）に定義
  const geometryList = [
    {
      id: "red",
      color: new Float32Array([1.0, 0.0, 0.0, 1.0]),
      parameter: {x: 0, y: 0, z: 0, scale: 100.0}
    },
    {
      id: "green",
      color: new Float32Array([0.0, 1.0, 0.0, 1.0]),
      parameter: {x: 0, y: 0, z: 0.5, scale: 30.0}
    },
    {
      id: "blue",
      color: new Float32Array([0.0, 0.0, 1.0, 1.0]),
      parameter: {x: 30.0, y: 30.0, z: 0.2, scale: 100.0}
    }
  ];

  geometryList.forEach(geometry => {
    // クエリ結果の出力先エレメントを保持
    geometry.stateElement = document.getElementById(geometry.id);

    // オブジェクトごとのクエリ格納用配列を準備
    geometry.query = {
      // 使用可能なクエリリスト
      availableList: [],

      // 使用中のクエリリスト
      waitingList: []
    }

    // GUIを追加
    const folder = gui.addFolder(geometry.id.toUpperCase());
    const xyDisable = geometry.id === "green";
    folder.add(geometry.parameter, "x", -CANVAS_WIDTH / 2, CANVAS_WIDTH / 2, 1).listen().disable(xyDisable);
    folder.add(geometry.parameter, "y", -CANVAS_HEIGHT / 2, CANVAS_HEIGHT / 2, 1).listen().disable(xyDisable);
    folder.add(geometry.parameter, "z", 0, 1, 0.1);
    folder.add(geometry.parameter, "scale", 10.0, 100.0, 10);
  });

  // マウス座標
  const mouse = {x: 100, y: 0};
  canvas.addEventListener('mousemove', event => {
    const rect = event.target.getBoundingClientRect();
    mouse.x = event.clientX - rect.left - CANVAS_WIDTH / 2;
    mouse.y = CANVAS_HEIGHT / 2 - (event.clientY - rect.top);
  });
  canvas.addEventListener('touchmove', event => {
    if (event.targetTouches.length === 1) {
      const touch = event.targetTouches[0];
      const rect = event.target.getBoundingClientRect();
      mouse.x = touch.pageX - rect.left - CANVAS_WIDTH / 2;
      mouse.y = CANVAS_HEIGHT / 2 - (touch.pageY - rect.top);
    }
  }, false);

  // 描画の設定
  gl2.clearColor(0.1, 0.1, 0.1, 1.0);
  gl2.enable(gl2.CULL_FACE);
  gl2.frontFace(gl2.CCW);
  // 深度テストを設定
  gl2.enable(gl2.DEPTH_TEST);
  gl2.depthFunc(gl2.LEQUAL);
  gl2.clearDepth(1.0);

  // 背景色を描画
  gl2.clear(gl2.COLOR_BUFFER_BIT | gl2.DEPTH_BUFFER_BIT);

  // 使用するシェーダーとオブジェクト横断で共通の定数値を設定
  gl2.useProgram(renderProgramSet.program);
  gl2.uniform4fv(renderProgramSet.uniformLocation.canvasSize, new Float32Array([CANVAS_WIDTH, CANVAS_HEIGHT, 2.0 / CANVAS_WIDTH, 2.0 / CANVAS_HEIGHT]));
  gl2.bindVertexArray(renderProgramSet.vertexArray);

  /**
   * レンダリングを実行します。
   */
  const render = () => {
    // 緑オブジェクトをマウスに追従
    geometryList[1].parameter.x = mouse.x;
    geometryList[1].parameter.y = mouse.y;

    // バッファのクリア
    gl2.clear(gl2.COLOR_BUFFER_BIT | gl2.DEPTH_BUFFER_BIT);

    for (let i = 0; i < geometryList.length; i++) {
      const geometry = geometryList[i];
      // 描画するオブジェクトのパラメータを設定
      gl2.uniform4fv(renderProgramSet.uniformLocation.color, geometry.color);
      gl2.uniform4f(renderProgramSet.uniformLocation.parameter, geometry.parameter.x, geometry.parameter.y, geometry.parameter.z, geometry.parameter.scale);

      // 使用中のクエリを取得
      const waitingQuery = geometry.query.waitingList.length ? geometry.query.waitingList[0] : null;
      // クエリ結果が取得可能か確認
      if (waitingQuery && gl2.getQueryParameter(waitingQuery, gl2.QUERY_RESULT_AVAILABLE)) {
        // クエリ結果を取得
        const anySamplesPassed = gl2.getQueryParameter(waitingQuery, gl2.QUERY_RESULT);
        geometry.stateElement.innerHTML = String(anySamplesPassed);

        // 使用が終わったクエリを使用可能リストに移動
        geometry.query.availableList.push(geometry.query.waitingList.shift());
      }

      // 使用可能なクエリをリストから取得（なければ新たに作成）
      const availableQuery = geometry.query.availableList.length ? geometry.query.availableList.shift() : gl2.createQuery();
      // 使用中のクエリリストに移動
      geometry.query.waitingList.push(availableQuery);

      // 深度テスト成功状況の計測開始
      gl2.beginQuery(gl2.ANY_SAMPLES_PASSED, availableQuery);

      // 描画コマンド
      gl2.drawElements(gl2.TRIANGLES, renderProgramSet.numIndices, gl2.UNSIGNED_INT, 0);

      // 深度テスト成功状況の計測終了
      gl2.endQuery(gl2.ANY_SAMPLES_PASSED);
    }

    requestAnimationFrame(render);
  };

  requestAnimationFrame(render);
};

const createRenderProgramSet = gl2 => {
  // language=GLSL
  const vertexShaderSource = `#version 300 es
  in vec2 position;
  out vec4 vColor;
  uniform vec4 canvasSize;
  uniform vec4 color;
  uniform vec4 parameter;

  void main(void)
  {
    gl_Position = vec4((position * parameter.ww + parameter.xy) * canvasSize.zw, parameter.z, 1.0);
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

  const vertices = new Float32Array([
    // x, y
    -0.5, 0.5,
    -0.5, -0.5,
    0.5, 0.5,
    0.5, -0.5
  ]);
  const indices = new Uint32Array([0, 1, 2, 2, 1, 3]);

  const attributeSetList = [
    {
      attributeList: [
        {name: "position", size: 2}
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
    canvasSize: gl2.getUniformLocation(program, 'canvasSize'),
    color: gl2.getUniformLocation(program, 'color'),
    parameter: gl2.getUniformLocation(program, 'parameter')
  };

  return {
    program,
    vertexArray,
    numIndices: indices.length,
    uniformLocation
  };
};

const createProgram = (gl2, vertexShaderSource, fragmentShaderSource) => {
  const vertexShader = gl2.createShader(gl2.VERTEX_SHADER);
  gl2.shaderSource(vertexShader, vertexShaderSource);
  gl2.compileShader(vertexShader);
  if (!gl2.getShaderParameter(vertexShader, gl2.COMPILE_STATUS)) {
    console.warn(gl2.getShaderInfoLog(vertexShader));
    return null;
  }

  const fragmentShader = gl2.createShader(gl2.FRAGMENT_SHADER);
  gl2.shaderSource(fragmentShader, fragmentShaderSource);
  gl2.compileShader(fragmentShader);
  if (!gl2.getShaderParameter(fragmentShader, gl2.COMPILE_STATUS)) {
    console.warn(gl2.getShaderInfoLog(fragmentShader));
    return null;
  }

  const program = gl2.createProgram();
  gl2.attachShader(program, vertexShader);
  gl2.attachShader(program, fragmentShader);
  gl2.linkProgram(program);
  if (!gl2.getProgramParameter(program, gl2.LINK_STATUS)) {
    console.warn(gl2.getProgramInfoLog(program));
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

    const stride = attributeSet.attributeList.reduce(
      (accumulator, currentValue) => accumulator + currentValue.size,
      0
    ) * Float32Array.BYTES_PER_ELEMENT;

    let offset = 0;
    attributeSet.attributeList.forEach(attribute => {
      gl2.enableVertexAttribArray(attribute.locationIndex);
      gl2.vertexAttribPointer(attribute.locationIndex, attribute.size, gl2.FLOAT, false, stride, offset);
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

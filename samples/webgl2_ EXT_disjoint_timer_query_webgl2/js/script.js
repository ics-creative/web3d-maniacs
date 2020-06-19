const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 540;

const main = async () => {
  const content = document.getElementById("content");
  const notSupportedDescription = document.getElementById("notSupportedDescription");
  const notExtSupportedDescription = document.getElementById("notExtSupportedDescription");

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

  // EXT_disjoint_timer_query_webgl2拡張を取得（有効化）
  const ext = gl2.getExtension("EXT_disjoint_timer_query_webgl2");
  if (!ext) {
    // WebGL2をサポートしているが、EXT_disjoint_timer_query_webgl2拡張をサポートしていない場合
    content.style.display = "none";
    notExtSupportedDescription.style.display = "block";
    return;
  }

  content.style.width = `${CANVAS_WIDTH}px`;
  content.style.height = `${CANVAS_HEIGHT}px`;
  const fps = document.getElementById("fps");
  const cpu = document.getElementById("cpu");
  const gpu = document.getElementById("gpu");

  // 描画に描画に必要なオブジェクト群を作成
  const renderProgramSet = createRenderProgramSet(gl2);
  if (!renderProgramSet) {
    return;
  }

  // 描画の設定
  gl2.clearColor(0.1, 0.1, 0.1, 1.0);
  // 背景色を描画
  gl2.clear(gl2.COLOR_BUFFER_BIT);

  // 使用するシェーダーと定数値を設定
  gl2.useProgram(renderProgramSet.program);
  gl2.uniform4fv(renderProgramSet.uniformLocation.screen, new Float32Array([CANVAS_WIDTH, CANVAS_HEIGHT, Math.max(1 / CANVAS_WIDTH, 1 / CANVAS_HEIGHT), 0.0]));

  // シェーダー内のループ数を設定できるGUIを作成
  const setting = {loop: 6};
  const gui = new dat.GUI({autoPlace: false});
  document.getElementById("gui").appendChild(gui.domElement);
  const slider = gui.add(setting, "loop", 0, 12, 1);
  const input = slider.domElement.querySelector("input");
  const updateFakeValue = () => input.value = 1 << input.value;
  updateFakeValue();
  const updateDisplay = slider.updateDisplay;
  slider.updateDisplay = function () {
    const result = updateDisplay.apply(this);
    updateFakeValue();
    return result;
  };

  // 各種計測結果
  const stats = {
    fps: [],
    cpu: [],
    gpu: []
  };
  // statsの更新頻度
  const updateCount = 10;
  // statsの計測回数
  let count = 0;

  const clearStatsData = () => {
    count = 0;
    stats.fps = [];
    stats.cpu = [];
    stats.gpu = [];
  };

  // クエリを格納するオブジェクト
  const querySet = {
    // 使用可能なクエリリスト
    availableList: [],

    // 使用中のクエリリスト
    usingList: []
  };

  // 配列内の平均値を計算する関数
  const calcArrayAverage = arr => arr.reduce((accumulator, currentValue) => accumulator + currentValue, 0) / arr.length;

  // カメラ位置
  const camera = new Float32Array([0.0, 0.0, 0.0]);

  // マウス座標
  const mouse = {x: 0, y: 0};
  canvas.addEventListener('mousemove', event => {
    const rect = event.target.getBoundingClientRect();
    mouse.x = event.clientX - rect.left - CANVAS_WIDTH / 2;
    mouse.y = CANVAS_HEIGHT / 2 - (event.clientY - rect.top);
  });

  // カメラ位置の計算に使用するフレーム数
  const maxFrame = 20000;
  let frame = maxFrame * Math.random();

  // 最初のCPU時間を計測
  let previousTime = performance.now();

  /**
   * レンダリングを実行します。
   */
  const render = () => {
    // 前回のrequestAnimationFrame()実行時の時間からFPSを計測
    const currentTime = performance.now();
    stats.fps.push(1000 / (currentTime - previousTime));
    previousTime = currentTime;

    frame += 1.0;
    if (frame > maxFrame) {
      frame = 0.0;
    }
    camera[0] = frame * 0.1 + mouse.x * 0.005;
    camera[1] = frame * 0.04 + mouse.y * 0.005;

    // GPUの不整合をチェック
    const disjoint = gl2.getParameter(ext.GPU_DISJOINT_EXT);
    if (disjoint) {
      // 計測をやり直す
      // 使用中のクエリを全て削除
      querySet.usingList.forEach(query => gl2.deleteQuery(query));
      querySet.usingList = [];

      clearStatsData();
    } else {
      // 使用中のクエリを取得
      const usingQuery = querySet.usingList.length ? querySet.usingList[0] : null;
      if (usingQuery) {
        // クエリ結果が取得可能か
        const available = gl2.getQueryParameter(usingQuery, gl2.QUERY_RESULT_AVAILABLE);
        if (available) {
          // クエリ結果（経過ナノ秒）を取得
          const timeElapsed = gl2.getQueryParameter(usingQuery, gl2.QUERY_RESULT);
          // ミリ秒に変換してリストに追加
          stats.gpu.push(timeElapsed / (1000 * 1000));
          // 使用が終わったクエリを使用可能リストに移動
          querySet.availableList.push(querySet.usingList.shift());
        }
      }
    }

    // 描画処理
    gl2.clear(gl2.COLOR_BUFFER_BIT);
    gl2.uniform1i(renderProgramSet.uniformLocation.loop, 1 << setting.loop);
    gl2.uniform3fv(renderProgramSet.uniformLocation.camera, camera);
    gl2.bindVertexArray(renderProgramSet.vertexArray);

    // 使用可能なクエリをリストから取得（なければ新たに作成）
    const availableQuery = querySet.availableList.length ? querySet.availableList.shift() : gl2.createQuery();
    // GPU実行時間計測開始
    gl2.beginQuery(ext.TIME_ELAPSED_EXT, availableQuery);
    // CPU実行時間計測開始
    const cpuTime = performance.now();
    // 描画コマンド
    gl2.drawElements(gl2.TRIANGLES, renderProgramSet.numIndices, gl2.UNSIGNED_INT, 0);
    // CPU実行時間計測終了
    stats.cpu.push(performance.now() - cpuTime);
    // GPU実行時間計測終了
    gl2.endQuery(ext.TIME_ELAPSED_EXT);
    // 使用中のクエリリストに移動
    querySet.usingList.push(availableQuery);

    count += 1;
    if (count === updateCount) {
      // 情報表示を更新
      fps.innerHTML = `${calcArrayAverage(stats.fps).toFixed(1)}`;
      cpu.innerHTML = `${calcArrayAverage(stats.cpu).toFixed(3)} ms`;
      gpu.innerHTML = `${calcArrayAverage(stats.gpu).toFixed(3)} ms`;

      clearStatsData();
    }

    requestAnimationFrame(render);
  };

  requestAnimationFrame(render);
};

const createRenderProgramSet = gl2 => {
  // language=GLSL
  const vertexShaderSource = `#version 300 es
  in vec2 position;

  void main(void)
  {
    gl_Position = vec4(position, 0.0, 1.0);
  }
  `;

  // language=GLSL
  const fragmentShaderSource = `#version 300 es
  #define PI 3.141592653589793

  precision mediump float;

  uniform int loop;
  uniform vec4 screen;
  uniform vec3 camera;

  out vec4 outColor;

  const float fov = 45.0 * 0.5 * PI / 180.0;
  const float d = 0.0001;

  const vec3 lightDir = vec3(-0.5, 0.5, 0.5);

  vec3 hsv2rgb(float h, float s, float v){
    return ((clamp(abs(fract(h + vec3(0, 2, 1) / 3.0) * 6.0 - 3.0)- 1.0, 0.0, 1.0) - 1.0) * s + 1.0) * v;
  }

  float getLinear010(float r, float u){
    return 1.0 - abs(2.0 * mod(r, u) / u - 1.0);
  }

  vec3 trans(vec3 p){
    return mod(p, 4.0) - 2.0;
  }

  float distanceFunc(vec3 p){
    return length(trans(p)) - 1.0;
  }

  vec3 getNormal(vec3 p){
    return normalize(vec3(
    distanceFunc(p + vec3(d, 0.0, 0.0)) - distanceFunc(p + vec3(-d, 0.0, 0.0)),
    distanceFunc(p + vec3(0.0, d, 0.0)) - distanceFunc(p + vec3(0.0, -d, 0.0)),
    distanceFunc(p + vec3(0.0, 0.0, d)) - distanceFunc(p + vec3(0.0, 0.0, -d))
    ));
  }

  void main(void){
    vec2 p = (gl_FragCoord.xy * 2.0 - screen.xy) * screen.z;
    vec3 ray = normalize(vec3(sin(fov) * p.x, sin(fov) * p.y, -cos(fov)));

    float distance = 0.0;
    float rayLength = 0.0;
    vec3  rayPos = camera;
    for (int i = 0; i < loop; i++){
      distance = distanceFunc(rayPos);
      rayLength += distance;
      rayPos = camera + ray * rayLength;
    }

    if (abs(distance) < 0.001){
      vec3 normal = getNormal(rayPos);
      float intensity = clamp(dot(lightDir, normal), 0.0, 1.0);
      outColor = vec4(hsv2rgb(getLinear010(rayPos.x, 2000.0), 0.5 + 0.3 * getLinear010(rayPos.y, 100.0), 0.9) * intensity, clamp(1.3 + rayPos.z / 100.0, 0.6, 1.0));
    } else {
      outColor = vec4(vec3(0.2), 1.0);
    }
  }
  `;

  const program = createProgram(gl2, vertexShaderSource, fragmentShaderSource);
  if (!program) {
    return null;
  }

  const vertices = new Float32Array([
    // x, y
    -1.0, 1.0,
    -1.0, -1.0,
    1.0, 1.0,
    1.0, -1.0
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
    loop: gl2.getUniformLocation(program, "loop"),
    screen: gl2.getUniformLocation(program, "screen"),
    camera: gl2.getUniformLocation(program, "camera")
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

window.addEventListener("DOMContentLoaded", () => main());

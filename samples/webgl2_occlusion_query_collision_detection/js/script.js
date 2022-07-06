import {Camera} from "./webgl/Camera.js";
import {RoundCameraController} from "./webgl/RoundCameraController.js";
import {SceneObject} from "./webgl/SceneObject.js";
import {GLTF} from "./webgl/gltf/GLTF.js";
import {load, save} from "./initialSetting.js";
import {DepthWriteSkinningProgram} from "./DepthWriteSkinningProgram.js";
import {SkinningProgram} from "./SkinningProgram.js";
import {SkinningTextureProgram} from "./SkinningTextureProgram.js";
import {createLinePlaneRenderProgramSet} from "./linePlane.js";

const {vec3, vec4, mat4} = glMatrix;

const RAD = Math.PI / 180;
const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 540;

const DEFAULT_MODEL_BASE_COLOR = vec4.fromValues(0.8, 1.0, 0.4, 1);
const AMBIENT_LIGHT_COLOR = vec4.fromValues(0.2, 0.2, 0.2, 1.0);
const DIRECTIONAL_LIGHT_COLOR = vec4.fromValues(1.0, 1.0, 1.0, 1.0);
const DIRECTIONAL_LIGHT_DIRECTION = vec3.fromValues(1.0, 1.0, 1.0);

/**
 * @enum {number}
 */
const DepthCameraType = {
  PERSPECTIVE: 1, // 視点と同じ
  Z: 2, //  Z軸上の固定カメラから
  XYZ: 3 // XYZ軸上の3方向の固定カメラから
};

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

  // 描画の設定
  // カラーバッファのクリア色を設定
  gl2.clearColor(0.2, 0.2, 0.2, 1.0);
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

  const loading = document.getElementById("loading");
  content.style.width = loading.style.width = `${CANVAS_WIDTH}px`;
  content.style.height = loading.style.height = `${CANVAS_HEIGHT}px`;

  // スキンアニメーションGLTF用のシェーダ
  const skinningProgram = new SkinningProgram(32);
  skinningProgram.createProgram(gl2);

  // スキンアニメーションGLTF（テクスチャマッピングあり）用のシェーダ
  const skinningTextureProgram = new SkinningTextureProgram(32);
  skinningTextureProgram.createProgram(gl2);

  // 深度のみを更新するスキンアニメーションGLTF用のシェーダ
  const depthWriteSkinningProgram = new DepthWriteSkinningProgram(32);
  depthWriteSkinningProgram.createProgram(gl2);

  // URLハッシュからカメラ位置の初期設定を取得
  const initialHashSetting = load(location.hash);

  // 2種のGLTFモデル及びその状態を保持するオブジェクトを作成
  const modelSetList = await Promise.all(
    [
      {
        name: "CesiumMan (Object A)",
        url: "assets/CesiumMan.glb",
        modelTransform: {scale: 10.0, y: -10, rotationX: -90 * RAD},
        position: {x: -5, y: 0, z: 0},
        program: skinningTextureProgram,
        initialHashSetting: initialHashSetting?.modelSetList[0]
      },
      {
        name: "BrainStem (Object B)",
        url: "assets/BrainStem.glb",
        modelTransform: {scale: 10.0, y: -10},
        position: {x: 5, y: 0, z: 0},
        program: skinningProgram,
        initialHashSetting: initialHashSetting?.modelSetList[1]
      }
    ].map(
      async (modelSetting) => {
        const model = new GLTF();
        await model.loadModel(modelSetting.url);

        model.createGeometrySet(gl2);
        model.createTextures(gl2);
        model.attachProgram(gl2, modelSetting.program);
        model.attachProgram(gl2, depthWriteSkinningProgram);
        console.log({model})

        model.container.y = modelSetting.modelTransform.y;
        model.container.scaleAll = modelSetting.modelTransform.scale;
        model.container.rotationX = modelSetting.modelTransform.rotationX || 0;

        const modelInitialHashSetting = modelSetting.initialHashSetting;
        const guiSetting = modelInitialHashSetting ? {
          isManualChanging: false,
          time: modelInitialHashSetting.time,
          isPlaying: modelInitialHashSetting.isPlaying,
          x: modelInitialHashSetting.x,
          y: modelInitialHashSetting.y,
          z: modelInitialHashSetting.z
        } : {
          isManualChanging: false,
          time: 0.0,
          isPlaying: true,
          x: modelSetting.position.x,
          y: modelSetting.position.y,
          z: modelSetting.position.z
        };

        const positionContainer = new SceneObject();
        positionContainer.addChild(model.container);
        positionContainer.x = guiSetting.x;
        positionContainer.y = guiSetting.y;
        positionContainer.z = guiSetting.z;

        return {
          model,
          positionContainer,
          modelSetting,
          guiSetting
        };
      }));

  // 床のオブジェクト
  const linePlaneRenderProgramSet = createLinePlaneRenderProgramSet(gl2);
  if (!linePlaneRenderProgramSet) {
    return;
  }
  linePlaneRenderProgramSet.container.y = -10;
  linePlaneRenderProgramSet.container.scaleAll = 100;

  // ローディング非表示
  loading.style.display = "none";

  // カメラ
  const camera = new Camera(45 * RAD, CANVAS_WIDTH / CANVAS_HEIGHT, 0.1, 1000.0);
  const cameraController = new RoundCameraController(camera, canvas);

  // カメラ位置の初期設定
  if (initialHashSetting) {
    cameraController.radius = initialHashSetting.radius;
    cameraController.theta = initialHashSetting.theta;
    cameraController.phi = initialHashSetting.phi;
  } else {
    cameraController.radius = 50;
    cameraController.theta = 0;
    cameraController.phi = 90;
  }
  cameraController.radiusOffset = 1;
  cameraController.update(1.0);
  canvas.style.cursor = "move";

  // モデルの状態を操作するGUIを作成
  const gui = new lil.GUI({container: document.getElementById("gui")});
  modelSetList.forEach((modelSet) => {
    const model = modelSet.model;
    const modelSetting = modelSet.modelSetting;
    const guiSetting = modelSet.guiSetting;
    const positionContainer = modelSet.positionContainer;

    model.animator.playByIndex(0, true);
    if (!guiSetting.isPlaying) {
      modelSet.model.animator.pause();
    }
    modelSet.model.animator.setTimeSecond(guiSetting.time, true);

    const folder = gui.addFolder(modelSetting.name);
    folder.add(guiSetting, "x", -10, 10, 1).onChange((value) => {
      positionContainer.x = value;
    }).listen();
    folder.add(guiSetting, "y", -10, 10, 1).onChange((value) => {
      positionContainer.y = value;
    }).listen();
    folder.add(guiSetting, "z", -10, 10, 1).onChange((value) => {
      positionContainer.z = value;
    }).listen();

    guiSetting.resetPosition = () => {
      guiSetting.x = positionContainer.x = modelSetting.position.x;
      guiSetting.y = positionContainer.y = modelSetting.position.y;
      guiSetting.z = positionContainer.z = modelSetting.position.z;
    };
    folder.add(guiSetting, "resetPosition").name("reset position");

    folder.add(guiSetting, "isPlaying").name("play animation").onChange(() => {
      if (model.animator.isPlaying) {
        model.animator.pause();
      } else {
        model.animator.resume();
      }
    }).listen();

    const timeGUI = folder.add(guiSetting, "time", 0, model.animator.playingAnimationDurationSecond, 0.01).name("animation time");
    timeGUI.listen(true);
    timeGUI.onChange((value) => {
      guiSetting.isManualChanging = true;
      timeGUI.listen(false);

      if (!model.animator.isPlaying) {
        model.animator.setTimeSecond(value);
      }
    });
    timeGUI.onFinishChange((value) => {
      model.animator.setTimeSecond(value);

      guiSetting.isManualChanging = false;
      timeGUI.listen(true);
    });

    return guiSetting;
  });

  // 状態を保存したURLハッシュを作成するデバッグ用関数をWindowに公開
  window.saveState = () => {
    const savedSetting = {
      radius: cameraController.radius,
      theta: cameraController.theta,
      phi: cameraController.phi,
      modelSetList: modelSetList.map(({guiSetting, model}) => {
        return {
          time: model.animator.elapsedTimeSecond,
          isPlaying: guiSetting.isPlaying,
          x: guiSetting.x,
          y: guiSetting.y,
          z: guiSetting.z
        }
      })
    };
    return location.origin + location.pathname + save(savedSetting);
  };

  // URLクエリパラメータから深度テスト時の視点のタイプを取得
  const typeQuery = parseInt(new URL(window.location.href).searchParams.get("type"));
  const depthCameraType = (typeQuery === DepthCameraType.XYZ || typeQuery === DepthCameraType.Z) ? typeQuery : DepthCameraType.PERSPECTIVE;

  // オクルージョンクエリと深度の視点をまとめたオブジェクトを深度の視点の数ぶん作成
  /** @type {QuerySet[]} */
  const querySetList = [...Array(depthCameraType === DepthCameraType.XYZ ? 3 : 1)].map(() => {
    return {
      queryAB: {
        availableList: [],
        waitingList: []
      },
      queryBA: {
        availableList: [],
        waitingList: []
      },
      vpMatrix: undefined
    };
  });

  // 深度視点が通常の視点と同じでないタイプの場合、固定カメラの配置場所を定義し、View-Projection変換行列を作成
  if (depthCameraType !== DepthCameraType.PERSPECTIVE) {
    const depthCamera = new Camera(45 * RAD, CANVAS_WIDTH / CANVAS_HEIGHT, 0.1, 1000.0);
    const depthCameraTarget = vec3.fromValues(0.0, 0.0, 0.0);
    (depthCameraType === DepthCameraType.XYZ ? [
      {x: 60, y: 0, z: 0},
      {x: 0, y: 60, z: 0.0001},
      {x: 0, y: 0, z: 60}
    ] : [
      {x: 0, y: 0, z: 60}
    ]).forEach((position, index) => {
      depthCamera.x = position.x;
      depthCamera.y = position.y;
      depthCamera.z = position.z;
      depthCamera.lookAt(depthCameraTarget);
      querySetList[index].vpMatrix = mat4.clone(depthCamera.getCameraMatrix());
    });
  }

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
  const getAvailableQuery = (queryPool) => {
    const availableQuery = queryPool.availableList.length ? queryPool.availableList.shift() : gl2.createQuery();
    queryPool.waitingList.push(availableQuery);
    return availableQuery;
  };

  /**
   * GLTFモデルを与えられた視点から深度のみを出力するシェーダーで描画
   * @param {GLTF} model
   * @param {mat4} vpMatrix
   */
  const drawModelWithDepthWriteShader = (model, vpMatrix) => {
    gl2.uniformMatrix4fv(depthWriteSkinningProgram.uniformLocation.mMatrix, false, model.container.getModelMatrix());
    gl2.uniformMatrix4fv(depthWriteSkinningProgram.uniformLocation.vpMatrix, false, vpMatrix);
    gl2.uniformMatrix4fv(depthWriteSkinningProgram.uniformLocation.boneMatrix, false, model.animator.skinningTransformMatrixArrayBuffer);

    for (let j = 0; j < model.meshes.length; j++) {
      const mesh = model.meshes[j];
      for (let i = 0; i < mesh.primitives.length; i++) {
        const primitive = mesh.primitives[i];
        gl2.bindVertexArray(primitive.vertexArraySetMap.get(depthWriteSkinningProgram).vertexArray);
        gl2.drawElements(gl2.TRIANGLES, primitive.geometrySet.indices.length, primitive.geometrySet.indices.componentType, 0);
      }
    }
  };

  /**
   * モデルを順番に描画し。オクルージョンクエリで前後関係を計測
   * @param {GLTF} formerModel
   * @param {GLTF} latterModel
   * @param {mat4} vpMatrix
   * @param {QueryPool} queryPool
   */
  const drawModelsInOrderAndQueryOcclusion = (formerModel, latterModel, vpMatrix, queryPool) => {
    // 深度バッファへの書き込みを有効化（深度バッファをクリアするため、このタイミングで）
    gl2.depthMask(true);
    // ステップ1 深度バッファをクリア
    gl2.clear(gl2.DEPTH_BUFFER_BIT);

    // ステップ2
    {
      // 深度テストの合格条件を「以下」に設定
      gl2.depthFunc(gl2.LEQUAL);
      // 深度バッファへの書き込みを有効化（上記ですでに呼んでいるので不要）
      // gl2.depthMask(true);
      // 表面のみ描画
      gl2.cullFace(gl2.BACK);

      // 最初のモデルを描画
      drawModelWithDepthWriteShader(formerModel, vpMatrix);
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
      gl2.beginQuery(gl2.ANY_SAMPLES_PASSED_CONSERVATIVE, getAvailableQuery(queryPool));
      // 次のモデルを描画
      drawModelWithDepthWriteShader(latterModel, vpMatrix);
      // クエリ計測を終了
      gl2.endQuery(gl2.ANY_SAMPLES_PASSED_CONSERVATIVE);
    }
  }

  /**
   * レンダリングを実行
   */
  const render = () => {
    // カメラを更新
    cameraController.update();
    const vpMatrix = camera.getCameraMatrix();
    if (depthCameraType === DepthCameraType.PERSPECTIVE) {
      // 深度カメラの視点が通常カメラの視点と同じタイプの場合は、カメラの行列をコピー
      querySetList[0].vpMatrix = vpMatrix;
    }

    // スキンアニメーション更新
    modelSetList.forEach((modelSet) => {
      const model = modelSet.model;
      const guiSetting = modelSet.guiSetting;
      model.animator.update();
      if (!guiSetting.isManualChanging) {
        // GUIのアニメーションタイムスライダーを手動で変更中でない場合はUIの表示を実時間と同期
        guiSetting.time = model.animator.elapsedTimeSecond;
      }
    });

    // 衝突しているかどうか
    let isCollided = true;

    // 過去に取得したクエリから衝突を判定
    querySetList.forEach((querySet) => {
      // A→Bの結果を取得
      const resultAvailableQueryAB = getResultAvailableQuery(querySet.queryAB);
      let anySamplesPassedConservativeAB;
      if (resultAvailableQueryAB) {
        anySamplesPassedConservativeAB = gl2.getQueryParameter(resultAvailableQueryAB, gl2.QUERY_RESULT);
        // console.log("AB", anySamplesPassedConservativeAB);
      }

      // B→Aの結果を取得
      const resultAvailableQueryBA = getResultAvailableQuery(querySet.queryBA);
      let anySamplesPassedConservativeBA;
      if (resultAvailableQueryBA) {
        anySamplesPassedConservativeBA = gl2.getQueryParameter(resultAvailableQueryBA, gl2.QUERY_RESULT);
        // console.log("BA", anySamplesPassedConservativeBA);
      }

      // 衝突しているかどうかを判定
      if (resultAvailableQueryAB && resultAvailableQueryBA) {
        // console.log(anySamplesPassedConservativeAB, anySamplesPassedConservativeBA);
        isCollided &&= anySamplesPassedConservativeAB && anySamplesPassedConservativeBA;
      } else {
        isCollided = false;
      }
    })

    // 以下描画処理

    // 最初に深度のみで判定するため、カラーバッファへの書き込みを無効化
    gl2.colorMask(false, false, false, false);

    // 深度のみ描画するシェーダーに変更
    gl2.useProgram(depthWriteSkinningProgram.program);

    // 深度視点ぶんクエリ計測を実行
    querySetList.forEach((querySet) => {
      // A→Bでクエリ計測
      drawModelsInOrderAndQueryOcclusion(modelSetList[0].model, modelSetList[1].model, querySet.vpMatrix, querySet.queryAB);

      // B→Aでクエリ計測
      drawModelsInOrderAndQueryOcclusion(modelSetList[1].model, modelSetList[0].model, querySet.vpMatrix, querySet.queryBA);
    });

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
    modelSetList.forEach((modelSet) => {
      const program = modelSet.modelSetting.program;
      gl2.useProgram(program.program);

      const model = modelSet.model;

      gl2.uniformMatrix4fv(program.uniformLocation.mMatrix, false, model.container.getModelMatrix());
      gl2.uniformMatrix4fv(program.uniformLocation.vpMatrix, false, vpMatrix);

      gl2.uniform3fv(program.uniformLocation.directionalLightDirection, DIRECTIONAL_LIGHT_DIRECTION);
      gl2.uniform4fv(program.uniformLocation.ambientLightColor, AMBIENT_LIGHT_COLOR);
      gl2.uniform4fv(program.uniformLocation.directionalLightColor, DIRECTIONAL_LIGHT_COLOR);
      gl2.uniform1f(program.uniformLocation.collidedColorFactor, isCollided ? 2.5 : 1.0);

      gl2.uniformMatrix4fv(program.uniformLocation.boneMatrix, false, model.animator.skinningTransformMatrixArrayBuffer);

      for (let j = 0; j < model.meshes.length; j++) {
        const mesh = model.meshes[j];
        for (let i = 0; i < mesh.primitives.length; i++) {
          const primitive = mesh.primitives[i];
          const pbrMetallicRoughness = (model.materials[primitive.materialIndex])?.pbrMetallicRoughness;
          if (pbrMetallicRoughness) {
            gl2.uniform4fv(program.uniformLocation.baseColorFactor, pbrMetallicRoughness.baseColorFactor);
            if (pbrMetallicRoughness?.baseColorTexture) {
              const baseColorTexture = pbrMetallicRoughness.baseColorTexture;
              gl2.activeTexture(gl2.TEXTURE0);
              gl2.bindTexture(gl2.TEXTURE_2D, model.textures[baseColorTexture.textureIndex].data);
              gl2.bindSampler(0, model.textureSamplers[baseColorTexture.samplerIndex]);
              gl2.uniform1i(program.uniformLocation.baseColorTexture, 0);
            }
          } else {
            gl2.uniform4fv(program.uniformLocation.baseColorFactor, DEFAULT_MODEL_BASE_COLOR);
          }

          gl2.bindVertexArray(primitive.vertexArraySetMap.get(program).vertexArray);
          gl2.drawElements(gl2.TRIANGLES, primitive.geometrySet.indices.length, primitive.geometrySet.indices.componentType, 0);
        }
      }
    });

    {
      // 床の描画
      gl2.useProgram(linePlaneRenderProgramSet.program);
      gl2.uniformMatrix4fv(linePlaneRenderProgramSet.uniformLocation.mMatrix, false, linePlaneRenderProgramSet.container.getModelMatrix());
      gl2.uniformMatrix4fv(linePlaneRenderProgramSet.uniformLocation.vpMatrix, false, vpMatrix);
      gl2.bindVertexArray(linePlaneRenderProgramSet.vertexArray);
      gl2.drawElements(gl2.LINES, linePlaneRenderProgramSet.geometrySet.indices.length, linePlaneRenderProgramSet.geometrySet.indices.componentType, 0);
    }

    requestAnimationFrame(render);
  };

  // 描画処理
  render();
};

window.addEventListener("DOMContentLoaded", () => {
  main();
});

/**
 * @typedef {Object} QueryPool
 *
 * @property {WebGLQuery[]} availableList
 * @property {WebGLQuery[]} waitingList
 */

/**
 * @typedef {Object} QuerySet
 *
 * @property {QueryPool} queryAB
 * @property {QueryPool} queryBA
 * @property {mat4} vpMatrix
 */
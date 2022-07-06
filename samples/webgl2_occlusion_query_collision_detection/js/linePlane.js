import {createBuffers, createProgram, createVertexArray, getAttribLocations} from "./webgl/webglHelper.js";
import {SceneObject} from "./webgl/SceneObject.js";

/**
 * 平面描画に必要なオブジェクト群を作成します。
 *
 * @public
 * @param {WebGL2RenderingContext} gl2
 * @return {LinePlaneRenderProgramSet | null}
 */
export const createLinePlaneRenderProgramSet = (gl2) => {
  // language=GLSL
  const vertexShaderSource = `#version 300 es
  in vec3 position;
  in vec3 color;
  out vec3 vColor;

  uniform mat4 mMatrix;
  uniform mat4 vpMatrix;

  void main(void)
  {
    gl_Position = (vpMatrix * mMatrix) * vec4(position, 1.0);
    vColor = color;
  }
  `;

  // language=GLSL
  const fragmentShaderSource = `#version 300 es
  precision mediump float;

  in vec3 vColor;

  out vec4 outColor;

  void main(void)
  {
    outColor = vec4(vColor, 1.0);
  }
  `;

  const program = createProgram(gl2, vertexShaderSource, fragmentShaderSource);
  if (!program) {
    return null;
  }

  const uniformLocation = {
    mMatrix: gl2.getUniformLocation(program, "mMatrix"),
    vpMatrix: gl2.getUniformLocation(program, "vpMatrix"),
  };

  const verticesArr = [];
  const indicesArr = [];

  const numLines = 20;

  const blue = 0.5
  for (let i = 0; i < numLines; i++) {
    const ratio = i / (numLines - 1);
    const z = -0.5 + ratio;
    verticesArr.push(
      // x, y, z
      -0.5, 0.0, z,
      // r, g, b
      0.0, ratio, blue);

    verticesArr.push(
      // x, y, z
      0.5, 0.0, z,
      // r, g, b
      1.0, ratio, blue);

    indicesArr.push(i * 4, i * 4 + 1);

    verticesArr.push(
      // x, y, z
      z, 0.0, -0.5,
      // r, g, b
      ratio, 0.0, blue);

    verticesArr.push(
      // x, y, z
      z, 0.0, 0.5,
      // r, g, b
      ratio, 1.0, blue);

    indicesArr.push(i * 4 + 2, i * 4 + 3);
  }

  const vertices = new Float32Array(verticesArr);
  const indices = new Uint16Array(indicesArr);

  /** @type {GeometrySet} */
  const geometrySet = {
    attributeSetList: [{
      attributeList: [
        {
          name: "position",
          size: 3,
          type: gl2.FLOAT,
          divisor: -1,
          locationIndex: undefined
        },
        {
          name: "color",
          size: 3,
          type: gl2.FLOAT,
          divisor: -1,
          locationIndex: undefined
        }
      ],
      bufferSet: {
        usage: gl2.STATIC_DRAW,
        data: vertices,
        buffer: undefined
      }
    }],
    indices: {
      usage: gl2.STATIC_DRAW,
      data: indices,
      buffer: undefined,
      length: indices.length,
      componentType: gl2.UNSIGNED_SHORT
    }
  };

  geometrySet.attributeSetList.forEach(attributeSet => {
    attributeSet.attributeList.forEach(attribute => {
      attribute.locationIndex = gl2.getAttribLocation(program, attribute.name);
    });
  });

  const locationIndexList = getAttribLocations(gl2, geometrySet, program);
  createBuffers(gl2, geometrySet);
  const vertexArray = createVertexArray(gl2, geometrySet, locationIndexList);

  return {
    program,
    uniformLocation,
    vertexArray,
    geometrySet,
    container: new SceneObject()
  };
};


/**
 * @typedef {Object} LinePlaneRenderProgramSet
 *
 * @property {WebGLProgram} program
 * @property {UniformLocation} uniformLocation
 * @property {WebGLVertexArrayObject} vertexArray
 * @property {GeometrySet} geometrySet
 * @property {SceneObject} container
 */
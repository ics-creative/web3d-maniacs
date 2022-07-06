import {createProgram} from "./webgl/webglHelper.js";
import {ProgramObject} from "./webgl/ProgramObject.js";

export class DepthWriteSkinningProgram extends ProgramObject {
  /**
   * @private
   * @type {number}
   */
  #maxJointNum = 1;

  /**
   * @public
   * @param {number} maxJointNum
   */
  constructor(maxJointNum) {
    super();
    this.#maxJointNum = maxJointNum;
  }

  /**
   * @inheritDoc
   */
  createProgram = (gl2) => {
    // language=GLSL
    const vertexShaderSource = `#version 300 es
  in vec3 position;
  in vec3 normal;
  in vec4 weight;
  in uvec4 bone;

  uniform mat4 mMatrix;
  uniform mat4 vpMatrix;
  uniform mat4 boneMatrix[${this.#maxJointNum}];

  void main(void)
  {
    mat4 skinningMatrix = boneMatrix[bone.x] * weight.x;
    skinningMatrix += boneMatrix[bone.y] * weight.y;
    skinningMatrix += boneMatrix[bone.z] * weight.z;
    skinningMatrix += boneMatrix[bone.w] * weight.w;
    vec4 skinnedPosition = skinningMatrix * vec4(position, 1.0);
    // float(bone.x) * weight.x;
    // vec4 skinnedPosition = vec4(position, 1.0);

    gl_Position = (vpMatrix * mMatrix) * skinnedPosition;
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

    this.program = createProgram(gl2, vertexShaderSource, fragmentShaderSource);

    this.uniformLocation = {
      mMatrix: gl2.getUniformLocation(this.program, "mMatrix"),
      vpMatrix: gl2.getUniformLocation(this.program, "vpMatrix"),
      boneMatrix: gl2.getUniformLocation(this.program, "boneMatrix")
    };
  };
}
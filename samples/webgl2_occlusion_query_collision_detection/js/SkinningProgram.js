import {createProgram} from "./webgl/webglHelper.js";
import {ProgramObject} from "./webgl/ProgramObject.js";

export class SkinningProgram extends ProgramObject {
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

  out vec4 vColor;

  uniform mat4 mMatrix;
  uniform mat4 vpMatrix;
  uniform vec4 baseColorFactor;
  uniform vec3 directionalLightDirection;
  uniform vec4 ambientLightColor;
  uniform vec4 directionalLightColor;
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

    mat3 skinningNormalMatrix = mat3(skinningMatrix);
    skinningNormalMatrix = inverse(skinningNormalMatrix);
    skinningNormalMatrix = transpose(skinningNormalMatrix);
    vec3 skinnedNormal = normalize(skinningNormalMatrix * normal);
    // vec3 skinnedNormal = normalize(normal);

    mat3 nMatrix = mat3(mMatrix);
    nMatrix = inverse(nMatrix);
    nMatrix = transpose(nMatrix);
    vec3 worldNormal = normalize(nMatrix * skinnedNormal);

    float diffuse = dot(worldNormal, normalize(directionalLightDirection));
    diffuse = clamp(diffuse, 0.0, 1.0);
    
    //vColor = vec4(worldNormal, 1.0);
    vColor = baseColorFactor * (ambientLightColor + diffuse * directionalLightColor);
  }
  `;

    // language=GLSL
    const fragmentShaderSource = `#version 300 es
  precision mediump float;

  in vec4 vColor;

  out vec4 outColor;

  uniform float collidedColorFactor;

  void main(void)
  {
    outColor = vColor * collidedColorFactor;
  }
  `;

    this.program = createProgram(gl2, vertexShaderSource, fragmentShaderSource);

    this.uniformLocation = {
      mMatrix: gl2.getUniformLocation(this.program, "mMatrix"),
      vpMatrix: gl2.getUniformLocation(this.program, "vpMatrix"),
      baseColorFactor: gl2.getUniformLocation(this.program, "baseColorFactor"),
      directionalLightDirection: gl2.getUniformLocation(this.program, "directionalLightDirection"),
      collidedColorFactor: gl2.getUniformLocation(this.program, "collidedColorFactor"),
      ambientLightColor: gl2.getUniformLocation(this.program, "ambientLightColor"),
      directionalLightColor: gl2.getUniformLocation(this.program, "directionalLightColor"),
      boneMatrix: gl2.getUniformLocation(this.program, "boneMatrix")
    };
  };
}
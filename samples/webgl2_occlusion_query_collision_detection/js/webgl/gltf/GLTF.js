import {createBuffers, createVertexArray, getAttribLocations} from "../webglHelper.js";
import {SceneObject} from "../SceneObject.js";
import {GLTFLoader} from "./GLTFLoader.js";
import {GLTFAnimator} from "./GLTFAnimator.js";

export class GLTF {
  /**
   * @public
   * @type {GLTFData}
   */
  data = undefined;

  /**
   * @public
   * @type {SceneObject}
   */
  container = undefined;

  /**
   * @public
   * @type {Mesh[]}
   */
  meshes = undefined;

  /**
   * @public
   * @type {GLTFMaterialData[]}
   */
  materials = undefined;

  /**
   * @public
   * @type {Texture[]}
   */
  textures = undefined;

  /**
   * @public
   * @type {WebGLSampler[]}
   */
  textureSamplers = undefined;

  /**
   * @public
   * @type {GLTFAnimator}
   */
  animator = undefined;

  /**
   * @public
   */
  constructor() {
  }

  /**
   * @public
   * @param {string} url
   * @return {Promise<void>}
   */
  loadModel = async (url) => {
    const data = await GLTFLoader.load(url);
    this.data = data;

    console.log({parsed: data});

    this.materials = data.materials;
    this.animator = new GLTFAnimator(this.data);
  }

  /**
   * GeometrySetを作成します。
   *
   * @param {WebGL2RenderingContext} gl2
   */
  createGeometrySet = (gl2) => {
    this.meshes = [];
    for (let j = 0; j < this.data.meshes.length; j++) {
      const mesh = this.data.meshes[j];
      const primitives = [];
      for (let i = 0; i < mesh.primitives.length; i++) {
        const primitive = mesh.primitives[i];

        // position
        const attributeSetList = [
          {
            attributeList: [
              {
                name: "position",
                size: 3,
                type: gl2.FLOAT,
                divisor: -1
              }
            ],
            bufferSet: {
              usage: gl2.STATIC_DRAW,
              data: primitive.position.data,
              buffer: undefined
            }
          }
        ];

        if (primitive.uv) {
          // uv
          attributeSetList.push(
            {
              attributeList: [
                {
                  name: "uv",
                  size: 2,
                  type: gl2.FLOAT,
                  divisor: -1
                }
              ],
              bufferSet: {
                usage: gl2.STATIC_DRAW,
                data: primitive.uv.data,
                buffer: undefined
              }
            }
          );
        }

        if (primitive.normal) {
          // normal
          attributeSetList.push(
            {
              attributeList: [
                {
                  name: "normal",
                  size: 3,
                  type: gl2.FLOAT,
                  divisor: -1
                }
              ],
              bufferSet: {
                usage: gl2.STATIC_DRAW,
                data: primitive.normal.data,
                buffer: undefined
              }
            }
          );
        }

        if (primitive.weights && primitive.boneIndices) {
          // weight, bone
          attributeSetList.push(
            {
              attributeList: [
                {
                  name: "weight",
                  size: 4,
                  type: gl2.FLOAT,
                  divisor: -1
                }
              ],
              bufferSet: {
                usage: gl2.STATIC_DRAW,
                data: primitive.weights.data,
                buffer: undefined
              }
            },
            {
              attributeList: [
                {
                  name: "bone",
                  size: 4,
                  type: gl2.UNSIGNED_SHORT,
                  divisor: -1
                }
              ],
              bufferSet: {
                usage: gl2.STATIC_DRAW,
                data: primitive.boneIndices.data,
                buffer: undefined
              }
            }
          );
        }

        /** @type {GeometrySet} */
        const geometrySet = {
          attributeSetList,
          indices: {
            usage: gl2.STATIC_DRAW,
            data: primitive.indices.data,
            buffer: undefined,
            length: primitive.indices.data.length,
            componentType: primitive.indices.componentType
          }
        };

        createBuffers(gl2, geometrySet);

        primitives.push({
          geometrySet,
          vertexArraySetMap: new Map(),
          materialIndex: primitive.material
        });
      }
      this.meshes.push({primitives});
    }

    this.container = new SceneObject();
  };

  /**
   * WebGLTextureを作成します。
   *
   * @param {WebGL2RenderingContext} gl2
   */
  createTextures = (gl2) => {
    if (this.data.images) {
      this.textures = [];
      for (let i = 0; i < this.data.images.length; i++) {
        const image = this.data.images[i];

        const texture = gl2.createTexture();
        gl2.bindTexture(gl2.TEXTURE_2D, texture);
        gl2.texStorage2D(gl2.TEXTURE_2D, 1, gl2.RGBA8, image.data.width, image.data.height);
        gl2.texSubImage2D(gl2.TEXTURE_2D, 0, 0, 0, image.data.width, image.data.height, gl2.RGBA, gl2.UNSIGNED_BYTE, image.data);
        gl2.generateMipmap(gl2.TEXTURE_2D);
        gl2.bindTexture(gl2.TEXTURE_2D, null);

        this.textures[i] = {
          originalImage: image.data,
          data: texture
        };
      }
    }

    if (this.data.textureSamplers) {
      this.textureSamplers = [];
      for (let i = 0; i < this.data.textureSamplers.length; i++) {
        const samplerData = this.data.textureSamplers[i];
        const sampler = gl2.createSampler();
        gl2.samplerParameteri(sampler, gl2.TEXTURE_MAG_FILTER, samplerData.magFilter);
        gl2.samplerParameteri(sampler, gl2.TEXTURE_MIN_FILTER, samplerData.minFilter);
        gl2.samplerParameteri(sampler, gl2.TEXTURE_WRAP_S, samplerData.wrapS);
        gl2.samplerParameteri(sampler, gl2.TEXTURE_WRAP_T, samplerData.wrapT);

        this.textureSamplers[i] = sampler;
      }
    }
  }

  /**
   * GeometryにProgramを紐付けします。
   *
   * @param {WebGL2RenderingContext} gl2
   * @param {ProgramObject} program
   */
  attachProgram = (gl2, program) => {
    for (let j = 0; j < this.meshes.length; j++) {
      const mesh = this.meshes[j];
      for (let i = 0; i < mesh.primitives.length; i++) {
        const primitive = mesh.primitives[i];

        const geometrySet = primitive.geometrySet;

        const locationIndexList = getAttribLocations(gl2, geometrySet, program.program);
        const vertexArray = createVertexArray(gl2, geometrySet, locationIndexList);

        primitive.vertexArraySetMap.set(
          program,
          {
            locationIndexList,
            vertexArray
          }
        );
      }
    }
  };
}

/**
 * @typedef {Object} VertexArraySet
 *
 * @property {WebGLVertexArrayObject} vertexArray
 * @property {LocationIndexSetList} locationIndexList
 */

/**
 * @typedef {Object} Primitive
 *
 * @property {GeometrySet} geometrySet
 * @property {Map<ProgramObject, VertexArraySet>} vertexArraySetMap
 * @property {GLTFMaterialData} materialIndex
 */

/**
 * @typedef {Object} Mesh
 *
 * @property {Primitive[]} primitives
 */

/**
 * @typedef {Object} Texture
 *
 * @property {ImageBitmap} originalImage
 * @property {WebGLTexture} data
 */
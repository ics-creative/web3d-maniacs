export class GLTFLoader {
  /**
   * @public
   * @param {string} url
   * @param {GLTFFileType} fileType
   * @return {Promise<GLTFData>}
   */
  static load = async (url, fileType = GLTFFileType.UNKNOWN) => {
    const pathArr = url.split("/");
    pathArr.pop();
    const relativePath = pathArr.join("/");

    const file = await GLTFLoader.#loadFile(url, fileType);

    const json = file.json;
    console.log({origin: json});

    const nodes = json.nodes;

    const nodeLength = nodes.length;
    const nodeDataList = new Array(nodeLength);
    const hierarchy = GLTFLoader.#parseSceneNode(json.scenes[0].nodes, nodes, nodeDataList);

    const bufferDataList = await GLTFLoader.#loadBuffers(json.buffers, file.binaryChunk, relativePath);
    const bufferViewsDataList = GLTFLoader.#loadBufferViews(json.bufferViews, bufferDataList, file.binaryChunk?.offset || 0);
    const accessorsDataList = GLTFLoader.#loadAccessors(json.accessors, bufferViewsDataList);

    const data = {
      images: undefined,
      textureSamplers: undefined,
      materials: undefined,
      meshes: [],
      joints: undefined,
      animations: undefined,
      hierarchy,
      rawData: json
    };

    if (json.hasOwnProperty("images")) {
      const imageLength = json.images.length;
      data.images = [];
      for (let i = 0; i < imageLength; i++) {
        data.images[i] = await GLTFLoader.#parseImage(json.images[i], bufferViewsDataList, relativePath);
      }
    }

    if (json.hasOwnProperty("samplers")) {
      const samplerLength = json.samplers.length;
      data.textureSamplers = [];
      for (let i = 0; i < samplerLength; i++) {
        data.textureSamplers[i] = GLTFLoader.#parseSampler(json.samplers[i]);
      }
    }

    if (json.hasOwnProperty("materials")) {
      const materialLength = json.materials.length;
      data.materials = [];
      for (let i = 0; i < materialLength; i++) {
        data.materials[i] = GLTFLoader.#parseMaterial(json.materials[i], json.textures);
      }
    }

    if (json.hasOwnProperty("meshes")) {
      const meshLength = json.meshes.length;
      for (let i = 0; i < meshLength; i++) {
        data.meshes[i] = GLTFLoader.#parseMesh(json.meshes[i], json.accessors, accessorsDataList);
      }
    }

    const skin = json.skins && json.skins[0];
    if (skin) {
      const jointLength = skin.joints.length;
      data.joints = [];
      let inverseBindMatrices = null;
      if (skin.hasOwnProperty("inverseBindMatrices")) {
        inverseBindMatrices = accessorsDataList[skin.inverseBindMatrices];
      }
      for (let i = 0; i < jointLength; i++) {
        const jointIndex = skin.joints[i];
        const node = nodes[jointIndex];
        const jointChildren = [];
        if (node.children) {
          const childLength = node.children.length;
          for (let j = 0; j < childLength; j++) {
            jointChildren[j] = skin.joints.indexOf(node.children[j]);
          }
        }

        const inverseBindMatrix = inverseBindMatrices
          ? new Float32Array(inverseBindMatrices.buffer, inverseBindMatrices.byteOffset + i * 16 * 4, 16)
          : new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

        data.joints[i] = {
          node,
          inverseBindMatrix,
          jointChildren
        };
      }
    }

    if (skin && json.hasOwnProperty("animations")) {
      const animations = json.animations;
      const animationLength = animations.length;
      data.animations = [];
      for (let i = 0; i < animationLength; i++) {
        const animation = animations[i];
        const channels = animation.channels;
        const channelLength = channels.length;
        const channelDataList = [];

        const samplers = animation.samplers;

        let maxInput = -1.0;
        for (let j = 0; j < channelLength; j++) {
          const channel = channels[j];
          const jointIndex = skin.joints.indexOf(channel.target.node);

          // if(jointIndex === -1)
          // {
          //   break;
          // }

          const sampler = samplers[channel.sampler];

          const inputLength = json.accessors[sampler.input].count;
          const channelMaxInput = accessorsDataList[sampler.input][inputLength - 1];

          if (channelMaxInput > maxInput) {
            maxInput = channelMaxInput;
          }

          channelDataList[j] = {
            target: jointIndex,
            path: channel.target.path,
            interpolation: sampler.interpolation,
            length: inputLength,
            input: accessorsDataList[sampler.input],
            output: accessorsDataList[sampler.output]
          };
        }

        data.animations[i] = {
          name: animation.name,
          channels: channelDataList,
          maxInput: maxInput
        };
      }
    }

    return data;
  }

  /**
   * @private
   * @param {string} url
   * @param {GLTFFileType} fileType
   * @return {Promise<{json: any, binaryChunk?: GLTFBinaryChunk}>}
   */
  static #loadFile = async (url, fileType) => {
    if (fileType === GLTFFileType.JSON) {
      const json = await fetch(url).then((response) => response.json());
      return {json};
    } else {
      const arrayBuffer = await fetch(url).then((response) => response.arrayBuffer());
      const header = new Uint32Array(arrayBuffer, 0, 3);
      if (header[0] === 0x46546C67) {
        // const version = header[1];
        // const byteLength = header[2];
        let offset = 3 * Uint32Array.BYTES_PER_ELEMENT;
        const jsonChunkHeader = new Uint32Array(arrayBuffer, offset, 2);
        offset += 2 * Uint32Array.BYTES_PER_ELEMENT;
        const jsonChunkData = new Uint8Array(arrayBuffer, offset, jsonChunkHeader[0]);
        offset += jsonChunkHeader[0];
        const binaryChunkHeader = new Uint32Array(arrayBuffer, offset, 2);
        offset += 2 * Uint32Array.BYTES_PER_ELEMENT;
        // const binaryChunkData = new Uint8Array(arrayBuffer, offset, binaryChunkHeader[0]);
        const jsonChunk = JSON.parse(new TextDecoder().decode(jsonChunkData));
        return {json: jsonChunk, binaryChunk: {buffer: arrayBuffer, offset, byteLength: binaryChunkHeader[0]}};
      } else {
        const json = JSON.parse(new TextDecoder().decode(arrayBuffer));
        return {json};
      }
    }
  }

  /**
   * @private
   * @param {any} image
   * @param {DataView[]} bufferViewsDataList
   * @param {string} relativePath
   * @return {Promise<GLTFImageData>}
   */
  static #parseImage = async (image, bufferViewsDataList, relativePath) => {
    const data = {};

    if (image.hasOwnProperty("name")) {
      data.name = image.name;
    }

    if (image.hasOwnProperty("mimeType")) {
      data.mimeType = image.mimeType;
    }

    if (image.hasOwnProperty("uri")) {
      data.data = await fetch(relativePath + "/" + image.uri).then((response) => response.blob()).then((blob) => createImageBitmap(blob));
    } else {
      data.data = await createImageBitmap(new Blob([bufferViewsDataList[image.bufferView]], {type: data.mimeType}));
    }

    const DEBUG = false;
    if (DEBUG) {
      const cv = document.createElement("canvas");
      cv.width = data.data.width;
      cv.height = data.data.height;
      document.body.appendChild(cv);
      cv.getContext("2d").drawImage(data.data, 0, 0);
    }

    return data;
  }

  /**
   * @private
   * @type {any} sampler
   * @return {GLTFTextureSamplerData}
   */
  static #parseSampler = (sampler) => {
    return {
      magFilter: sampler ? sampler.magFilter : GLenumSamplerDefaultType.FILTER_LINEAR,
      minFilter: sampler ? sampler.minFilter : GLenumSamplerDefaultType.FILTER_NEAREST_MIPMAP_LINEAR,
      wrapS: sampler ? sampler.wrapS : GLenumSamplerDefaultType.WRAP_REPEAT,
      wrapT: sampler ? sampler.wrapT : GLenumSamplerDefaultType.WRAP_REPEAT
    };
  }

  /**
   * @private
   * @param {any} material
   * @param {any[]} textures
   * @return {GLTFMaterialData}
   */
  static #parseMaterial = (material, textures) => {
    const data = {};

    if (material.hasOwnProperty("name")) {
      data.name = material.name;
    }

    const pbrMetallicRoughnessData = {};
    pbrMetallicRoughnessData.baseColorFactor = new Float32Array(material.pbrMetallicRoughness?.baseColorFactor || [1, 1, 1, 1]);
    pbrMetallicRoughnessData.metallicFactor = new Float32Array(material.pbrMetallicRoughness?.metallicFactor || 1.0);
    pbrMetallicRoughnessData.roughnessFactor = new Float32Array(material.pbrMetallicRoughness?.roughnessFactor || 1.0);
    if (material.hasOwnProperty("pbrMetallicRoughness")) {
      const pbrMetallicRoughness = material.pbrMetallicRoughness;
      if (pbrMetallicRoughness.hasOwnProperty("baseColorTexture")) {
        const baseColorTexture = pbrMetallicRoughness.baseColorTexture;
        const texture = textures[baseColorTexture.index];
        pbrMetallicRoughnessData.baseColorTexture = {
          textureIndex: texture.source,
          samplerIndex: texture.sampler,
          texCoord: baseColorTexture.texCoord || 0
        };
      }
      if (pbrMetallicRoughness.hasOwnProperty("metallicRoughnessTexture")) {
        const metallicRoughnessTexture = pbrMetallicRoughness.metallicRoughnessTexture;
        const texture = textures[metallicRoughnessTexture.index];
        pbrMetallicRoughnessData.metallicRoughnessTexture = {
          index: metallicRoughnessTexture.index,
          samplerIndex: texture.sampler,
          texCoord: metallicRoughnessTexture.texCoord || 0
        };
      }
    }
    data.pbrMetallicRoughness = pbrMetallicRoughnessData;

    if (material.hasOwnProperty("normalTexture")) {
      const normalTexture = material.normalTexture;
      const texture = textures[normalTexture.index];
      data.normalTexture = {
        index: normalTexture.index,
        texCoord: normalTexture.texCoord || 0,
        samplerIndex: texture.sampler,
        scale: normalTexture.scale || 1.0
      };
    }

    return data;
  }

  /**
   * @private
   * @param {any} mesh
   * @param {any} accessors
   * @param {ArrayBufferView[]} accessorsDataList
   * @return {GLTFMeshData}
   */
  static #parseMesh = (mesh, accessors, accessorsDataList) => {
    const primitiveLength = mesh.primitives.length;
    const primitives = [];
    for (let i = 0; i < primitiveLength; i++) {
      primitives[i] = GLTFLoader.#parsePrimitive(mesh.primitives[i], accessors, accessorsDataList);
    }

    return {
      primitives
    };
  }

  /**
   * @private
   * @param {any} primitive
   * @param {any} accessors
   * @param {ArrayBufferView[]} accessorsDataList
   * @return {GLTFPrimitiveData}
   */
  static #parsePrimitive = (primitive, accessors, accessorsDataList) => {
    const primitiveData = {};

    switch (primitive.mode) {
      case GLenumRenderingPrimitive.POINTS:
        primitiveData.primitiveType = PrimitiveType.POINTS;
        break;
      case GLenumRenderingPrimitive.LINES:
        primitiveData.primitiveType = PrimitiveType.LINES;
        break;
      case GLenumRenderingPrimitive.TRIANGLES:
      default:
        primitiveData.primitiveType = PrimitiveType.TRIANGLES;
        break;
    }

    const attributes = primitive.attributes;

    const positionAccessorIndex = attributes[AttributeType.POSITION];
    const positionAccessor = accessors[positionAccessorIndex];

    primitiveData.numVertices = positionAccessor.count;

    primitiveData.position = {
      data: accessorsDataList[positionAccessorIndex],
      num: GLTFLoader.#getAccessorTypeSize(positionAccessor.type),
      min: positionAccessor.min,
      max: positionAccessor.max
    };
    // console.log(data);

    if (attributes.hasOwnProperty(AttributeType.TEXCOORD_0)) {
      const uvAccessorIndex = attributes[AttributeType.TEXCOORD_0];
      primitiveData.uv = {
        data: accessorsDataList[uvAccessorIndex],
        num: GLTFLoader.#getAccessorTypeSize(accessors[uvAccessorIndex].type)
      };
    }

    if (attributes.hasOwnProperty(AttributeType.NORMAL)) {
      const normalAccessorIndex = attributes[AttributeType.NORMAL];
      primitiveData.normal = {
        data: accessorsDataList[normalAccessorIndex],
        num: GLTFLoader.#getAccessorTypeSize(accessors[normalAccessorIndex].type)
      };
    }

    if (attributes.hasOwnProperty(AttributeType.JOINTS_0)) {
      const joints0AccessorIndex = attributes[AttributeType.JOINTS_0];
      primitiveData.boneIndices = {
        data: accessorsDataList[joints0AccessorIndex],
        num: GLTFLoader.#getAccessorTypeSize(accessors[joints0AccessorIndex].type)
      };
    }

    if (attributes.hasOwnProperty(AttributeType.WEIGHTS_0)) {
      const weights0AccessorIndex = attributes[AttributeType.WEIGHTS_0];
      primitiveData.weights = {
        data: accessorsDataList[weights0AccessorIndex],
        num: GLTFLoader.#getAccessorTypeSize(accessors[weights0AccessorIndex].type)
      };
    }

    if (primitive.hasOwnProperty("indices")) {
      const indicesAccessorIndex = primitive.indices;
      primitiveData.indices = {
        componentType: accessors[indicesAccessorIndex].componentType,
        data: accessorsDataList[indicesAccessorIndex]
      };
    }

    if (primitive.hasOwnProperty("material")) {
      primitiveData.material = primitive.material;
    }

    return primitiveData;
  }

  /**
   * @private
   * @param {any} scene
   * @param {any[]} rawNodes
   * @param {GLTFNodeData[]} nodeDataList
   * @return {GLTFNodeData[]}
   */
  static #parseSceneNode = (scene, rawNodes, nodeDataList) => {
    const sceneNodes = [];
    const length = scene.length;
    for (let i = 0; i < length; i++) {
      const nodeIndex = scene[i];
      const sceneNode = GLTFLoader.#parseNode(rawNodes[nodeIndex], rawNodes, nodeDataList);
      nodeDataList[nodeIndex] = sceneNode;
      sceneNodes[i] = sceneNode;
    }
    return sceneNodes;
  }

  /**
   * @private
   * @param {any} node
   * @param {any[]} rawNodes
   * @param {GLTFNodeData[]} nodeDataList
   * @return {GLTFNodeData}
   */
  static #parseNode = (node, rawNodes, nodeDataList) => {
    let children = null;
    if (node.hasOwnProperty("children")) {
      children = [];
      const length = node.children.length;
      for (let i = 0; i < length; i++) {
        const childIndex = node.children[i];
        const childData = GLTFLoader.#parseNode(rawNodes[childIndex], rawNodes, nodeDataList);
        children[i] = childData;
        nodeDataList[childIndex] = childData;
      }
    }

    return {
      name: node.name,
      rotation: node.rotation,
      scale: node.scale,
      translation: node.translation,
      matrix: node.matrix,
      children: children
    };
  }

  /**
   * @private
   * @param {any[]} buffers
   * @param {GLTFBinaryChunk} binaryChunk
   * @param {string} relativePath
   * @return {Promise<ArrayBuffer[]>}
   */
  static #loadBuffers = async (buffers, binaryChunk, relativePath) => {
    const bufferDataList = [];

    const length = buffers.length;
    for (let i = 0; i < length; i++) {
      const buffer = buffers[i];
      if (!buffer.hasOwnProperty("uri")) {
        if (i === 0) {
          bufferDataList.push(binaryChunk.buffer);
        }
      } else {
        const bufferData = await fetch(relativePath + "/" + buffer.uri).then((response) => response.arrayBuffer());
        if (bufferData.byteLength === buffer.byteLength) {
          bufferDataList.push(bufferData);
        }
      }
    }
    return bufferDataList;
  }

  /**
   * @private
   * @param {any[]} bufferViews
   * @param {ArrayBuffer[]} bufferDataList
   * @param {number} firstBufferByteOffset
   * @return {DataView[]}
   */
  static #loadBufferViews = (bufferViews, bufferDataList, firstBufferByteOffset) => {
    const bufferViewsDataList = [];

    const length = bufferViews.length;
    for (let i = 0; i < length; i++) {
      const bufferView = bufferViews[i];
      if (!bufferView.hasOwnProperty("byteOffset")) {
        bufferView.byteOffset = 0;
      }
      const firstByteOffset = bufferView.buffer === 0 ? firstBufferByteOffset : 0
      const bufferData = bufferDataList[bufferView.buffer];

      bufferViewsDataList[i] = new DataView(bufferData, firstByteOffset + bufferView.byteOffset, bufferView.byteLength);
    }
    return bufferViewsDataList;
  }

  /**
   * @private
   * @param {any[]} accessors
   * @param {DataView[]} bufferViewsDataList
   * @return {ArrayBufferView[]}
   */
  static #loadAccessors = (accessors, bufferViewsDataList) => {
    const accessorsDataList = [];

    const length = accessors.length;
    for (let i = 0; i < length; i++) {
      const accessor = accessors[i];
      if (!accessor.hasOwnProperty("byteOffset")) {
        accessor.byteOffset = 0;
      }
      const bufferView = bufferViewsDataList[accessor.bufferView];
      let typedArrayConstructor;
      switch (accessor.componentType) {
        case GLenumDataType.BYTE:
          typedArrayConstructor = Int8Array;
          break;
        case GLenumDataType.UNSIGNED_BYTE:
          typedArrayConstructor = Uint8Array;
          break;
        case GLenumDataType.SHORT:
          typedArrayConstructor = Int16Array;
          break;
        case GLenumDataType.UNSIGNED_SHORT:
          typedArrayConstructor = Uint16Array;
          break;
        case GLenumDataType.UNSIGNED_INT:
          typedArrayConstructor = Uint32Array;
          break;
        case GLenumDataType.FLOAT:
          typedArrayConstructor = Float32Array;
          break;
        default:
          break;
      }
      accessorsDataList.push(new typedArrayConstructor(bufferView.buffer, bufferView.byteOffset + accessor.byteOffset, accessor.count * GLTFLoader.#getAccessorTypeSize(accessor.type)));
    }
    return accessorsDataList;
  }

  /**
   * @private
   * @param {string} accessorType
   * @return {number}
   */
  static #getAccessorTypeSize = (accessorType) => {
    let size = 0;
    switch (accessorType) {
      case "SCALAR":
        size = AccessorTypeSize.SCALAR;
        break;
      case "VEC2":
        size = AccessorTypeSize.VEC2;
        break;
      case "VEC3":
        size = AccessorTypeSize.VEC3;
        break;
      case "VEC4":
        size = AccessorTypeSize.VEC4;
        break;
      case "MAT2":
        size = AccessorTypeSize.MAT2;
        break;
      case "MAT3":
        size = AccessorTypeSize.MAT3;
        break;
      case "MAT4":
        size = AccessorTypeSize.MAT4;
        break;
    }
    return size;
  }

  constructor() {
  }
}

/**
 * @enum {string}
 */
export const GLTFFileType = {
  BIN: "bin",
  JSON: "json",
  UNKNOWN: "unknown"
};

/**
 * @enum {GLenum}
 */
export const GLenumDataType = {
  BYTE: 0x1400,
  UNSIGNED_BYTE: 0x1401,
  SHORT: 0x1402,
  UNSIGNED_SHORT: 0x1403,
  UNSIGNED_INT: 0x1405,
  FLOAT: 0x1406
};

/**
 * @enum {GLenum}
 */
export const GLenumRenderingPrimitive = {
  POINTS: 0x0000,
  LINES: 0x0001,
  LINE_LOOP: 0x0002,
  LINE_STRIP: 0x0003,
  TRIANGLES: 0x0004,
  TRIANGLE_STRIP: 0x0005,
  TRIANGLE_FAN: 0x0006
};

/**
 * @enum {GLenum}
 */
export const GLenumSamplerDefaultType = {
  FILTER_LINEAR: 0x2601,
  FILTER_NEAREST_MIPMAP_LINEAR: 0x2702,
  WRAP_REPEAT: 0x2901
};

/**
 * @enum {number}
 */
export const AccessorTypeSize = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT2: 4,
  MAT3: 9,
  MAT4: 16
};

/*
type AccessorTypedArrayConstructor =
  Int8ArrayConstructor
  | Uint8ArrayConstructor
  | Int16ArrayConstructor
  | Uint16ArrayConstructor
  | Uint32ArrayConstructor
  | Float32ArrayConstructor;
 */

/**
 * @enum {string}
 */
export const PrimitiveType = {
  POINTS: "POINTS",
  LINES: "LINES",
  TRIANGLES: "TRIANGLES"
};

/**
 * @enum {string}
 */
export const AttributeType = {
  POSITION: "POSITION",
  TEXCOORD_0: "TEXCOORD_0",
  NORMAL: "NORMAL",
  JOINTS_0: "JOINTS_0",
  WEIGHTS_0: "WEIGHTS_0"
};

/**
 * @enum {string}
 */
export const ChannelPathType = {
  translation: "translation",
  scale: "scale",
  rotation: "rotation",
};

/**
 * @typedef {Object} GLTFBinaryChunk
 *
 * @property {ArrayBuffer} buffer
 * @property {number} offset
 * @property {number} byteLength
 */

/**
 * @typedef {Object} GLTFImageData
 *
 * @property {ImageBitmap} data
 * @property {!string} name
 * @property {!string} mimeType
 */

/**
 * @typedef {Object} GLTFTextureData
 *
 * @property {number} textureIndex
 * @property {number} texCoord
 * @property {number} samplerIndex
 */

/**
 * @typedef {Object} GLTFPBRMetallicRoughnessData
 *
 * @property {Float32Array} baseColorFactor
 * @property {!GLTFTextureData} baseColorTexture
 * @property {number} metallicFactor
 * @property {number} roughnessFactor
 * @property {!number} metallicRoughnessTexture
 */

/**
 * @typedef {Object} GLTFMaterialData
 *
 * @property {!string} name
 * @property {GLTFPBRMetallicRoughnessData} pbrMetallicRoughness
 * @property {!(GLTFTextureData & {scale:number})} normalTexture
 */

/**
 * @typedef {Object} GLTFTextureSamplerData
 *
 * @property {GLenum} magFilter
 * @property {GLenum} minFilter
 * @property {GLenum} wrapS
 * @property {GLenum} wrapT
 */

/**
 * @typedef {Object} GLTFAttributeData
 *
 * @property {ArrayBufferLike} data
 * @property {number} num
 * @property {?number[]} min
 * @property {?number[]} max
 */

/**
 * @typedef {(Uint32Array | Uint16Array | Uint8Array)} GLTFIndexDataArrayType
 */

/**
 * @typedef {Object} GLTFIndexData
 *
 * @property {GLenum} componentType
 * @property {GLTFIndexDataArrayType} data
 */

/**
 * @typedef {Object} GLTFPrimitiveData
 *
 * @property {PrimitiveType} primitiveType
 * @property {number} numVertices
 * @property {GLTFAttributeData} position
 * @property {?GLTFAttributeData} uv
 * @property {?GLTFAttributeData} normal
 * @property {?GLTFAttributeData} boneIndices
 * @property {?GLTFAttributeData} weights
 * @property {?GLTFIndexData} indices
 * @property {?number} material
 */

/**
 * @typedef {Object} GLTFMeshData
 *
 * @property {GLTFPrimitiveData[]} primitives
 */

/**
 * @typedef {Object} GLTFNodeData
 *
 * @property {string} name
 * @property {?number[]} rotation
 * @property {?number[]} scale
 * @property {?number[]} translation
 * @property {?number[]} matrix
 * @property {?GLTFNodeData[]} children
 */

/**
 * @typedef {Object} GLTFJointData
 *
 * @property {Float32Array} inverseBindMatrix
 * @property {GLTFNodeData} node
 * @property {number[]} jointChildren
 */


/**
 * @typedef {Object} GLTFAnimationChannelData
 *
 * @property {number} target
 * @property {ChannelPathType} path
 * @property {string} interpolation
 * @property {number} length
 * @property {ArrayBufferView} input
 * @property {ArrayBufferView} output
 */

/**
 * @typedef {Object} GLTFAnimationData
 *
 * @property {string} name
 * @property {GLTFAnimationChannelData[]} channels
 * @property {number} maxInput
 */

/**
 * @typedef {Object} GLTFData
 *
 * @property {GLTFMeshData[]} meshes
 * @property {GLTFJointData[]} joints
 * @property {GLTFAnimationData[]} animations
 * @property {GLTFNodeData[]} hierarchy
 * @property {GLTFImageData[]} images
 * @property {GLTFMaterialData[]} materials
 * @property {GLTFTextureSamplerData[]} textureSamplers
 * @property {any} rawData
 */
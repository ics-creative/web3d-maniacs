const WebGLConstants = {
  // Rendering primitives
  POINTS: 0x0000,
  LINES: 0x0001,
  TRIANGLES: 0x0004,
  // Data types
  BYTE: 0x1400,
  UNSIGNED_BYTE: 0x1401,
  SHORT: 0x1402,
  UNSIGNED_SHORT: 0x1403,
  INT: 0x1404,
  UNSIGNED_INT: 0x1405,
  FLOAT: 0x1406
};

export const AccessorType = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT2: 4,
  MAT3: 9,
  MAT4: 16
};

export const PrimitiveType = {
  POINTS: 'POINTS',
  LINES: 'LINES',
  TRIANGLES: 'TRIANGLES'
};

export class GLTFLoader {
  static async load(url) {
    const json = await fetch(url).then((response) => response.json());
    const pathArr = url.split('/');
    pathArr.pop();
    const relativePath = pathArr.join('/');

    // console.log(json);

    const mesh = json.meshes[0];
    const primitive = mesh.primitives[0];

    const data = {
      primitiveType: PrimitiveType.POINTS,
      numVertices: 0,
      position: null,
      normal: null,
      indices: null
    };

    switch (primitive.mode) {
      case WebGLConstants.POINTS:
        data.primitiveType = PrimitiveType.POINTS;
        break;
      case WebGLConstants.LINES:
        data.primitiveType = PrimitiveType.LINES;
        break;
      case WebGLConstants.TRIANGLES:
        data.primitiveType = PrimitiveType.TRIANGLES;
        break;
      default:
        return data;
    }

    const bufferDataList = await GLTFLoader.loadBuffers(json.buffers, relativePath);
    const accessorsDataList = GLTFLoader.loadAccessors(json.accessors, json.bufferViews, bufferDataList);

    const attributes = primitive.attributes;

    const positionAccessorIndex = attributes.POSITION;
    const positionAccessor = json.accessors[positionAccessorIndex];

    data.numVertices = positionAccessor.count;

    data.position = {
      data: accessorsDataList[positionAccessorIndex],
      num: GLTFLoader.getAccessorTypeSize(positionAccessor.type),
      min: positionAccessor.min,
      max: positionAccessor.max
    };
    // console.log(data);

    if (attributes.hasOwnProperty('NORMAL')) {
      const normalAccessorIndex = attributes.NORMAL;
      data.normal = {
        data: accessorsDataList[normalAccessorIndex],
        num: GLTFLoader.getAccessorTypeSize(json.accessors[normalAccessorIndex].type)
      };
    }

    if (primitive.hasOwnProperty('indices')) {
      const indicesAccessorIndex = primitive.indices;
      data.indices = {
        data: accessorsDataList[indicesAccessorIndex],
        length: accessorsDataList[indicesAccessorIndex].length
      };
    }

    return data;
  }

  static async loadBuffers(buffers, relativePath) {
    const bufferDataList = [];

    const length = buffers.length;
    for (let i = 0; i < length; i++) {
      const buffer = buffers[i];
      const bufferData = await fetch(relativePath + '/' + buffer.uri).then((response) => response.arrayBuffer());
      if (bufferData.byteLength === buffer.byteLength) {
        bufferDataList.push(bufferData);
      }
    }
    return bufferDataList;
  }

  static loadAccessors(accessors, bufferViews, bufferDataList) {
    const accessorsDataList = [];

    const length = accessors.length;
    for (let i = 0; i < length; i++) {
      const accessor = accessors[i];
      const bufferView = bufferViews[accessor.bufferView];
      const bufferData = bufferDataList[bufferView.buffer];
      switch (accessor.componentType) {
        case WebGLConstants.BYTE:
          break;
        case WebGLConstants.UNSIGNED_BYTE:
          break;
        case WebGLConstants.SHORT:
          break;
        case WebGLConstants.UNSIGNED_SHORT:
          const uint16Array = new Uint16Array(bufferData, bufferView.byteOffset + accessor.byteOffset, accessor.count * GLTFLoader.getAccessorTypeSize(accessor.type));
          accessorsDataList.push(uint16Array);
          break;
        case WebGLConstants.INT:
          break;
        case WebGLConstants.UNSIGNED_INT:
          break;
        case WebGLConstants.FLOAT:
          const float32Array = new Float32Array(bufferData, bufferView.byteOffset + accessor.byteOffset, accessor.count * GLTFLoader.getAccessorTypeSize(accessor.type));
          accessorsDataList.push(float32Array);
          break;
        default:
          break;
      }
    }
    return accessorsDataList;
  }

  static getAccessorTypeSize(accessorType) {
    let size = 0;
    switch (accessorType) {
      case 'SCALAR':
        size = AccessorType.SCALAR;
        break;
      case 'VEC2':
        size = AccessorType.VEC2;
        break;
      case 'VEC3':
        size = AccessorType.VEC3;
        break;
      case 'VEC4':
        size = AccessorType.VEC4;
        break;
      case 'MAT2':
        size = AccessorType.MAT2;
        break;
      case 'MAT3':
        size = AccessorType.MAT3;
        break;
      case 'MAT4':
        size = AccessorType.MAT4;
        break;
    }
    return size;
  }

  constructor() {
  }
}


/*
export declare interface GLTFData
{
  primitiveType:PrimitiveType;
  numVertices:number;
  position:GLTFAttributeData;
  normal:GLTFAttributeData;
  indices:GLTFIndexData;
}

export declare interface GLTFAttributeData
{
  data:ArrayBufferView;
  num:number;
  min?:number[];
  max?:number[];
}

export declare interface GLTFIndexData
{
  data:ArrayBufferView;
}
 */
/**
 * WebGLProgramを作成します。
 *
 * @public
 * @param {WebGL2RenderingContext} gl2
 * @param {string} vertexShaderSource
 * @param {string} fragmentShaderSource
 * @return {WebGLProgram | null}
 */
export const createProgram = (gl2, vertexShaderSource, fragmentShaderSource) => {
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

/**
 * WebGLBufferを作成します。
 *
 * @public
 * @param {WebGL2RenderingContext} gl2
 * @param {GeometrySet} geometrySet
 */
export const createBuffers = (gl2, geometrySet) => {
  geometrySet.attributeSetList.forEach(({bufferSet}) => {
    const vertexBuffer = gl2.createBuffer();
    gl2.bindBuffer(gl2.ARRAY_BUFFER, vertexBuffer);
    gl2.bufferData(gl2.ARRAY_BUFFER, bufferSet.data, bufferSet.usage);
    gl2.bindBuffer(gl2.ARRAY_BUFFER, null);
    bufferSet.buffer = vertexBuffer;
  });

  if (geometrySet.indices) {
    const bufferSet = geometrySet.indices;
    const indexBuffer = gl2.createBuffer();
    gl2.bindBuffer(gl2.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl2.bufferData(gl2.ELEMENT_ARRAY_BUFFER, bufferSet.data, bufferSet.usage);
    gl2.bindBuffer(gl2.ELEMENT_ARRAY_BUFFER, null);
    bufferSet.buffer = indexBuffer;
  }
};

/**
 * locationIndexを取得します。
 *
 * @public
 * @param {WebGL2RenderingContext} gl2
 * @param {GeometrySet} geometrySet
 * @param {WebGLProgram} program
 * @return {LocationIndexSetList}
 */
export const getAttribLocations = (gl2, geometrySet, program) => {
  return geometrySet.attributeSetList.map((attributeSet) => attributeSet.attributeList.map((attribute) => gl2.getAttribLocation(program, attribute.name)));
};

/**
 * VertexArrayを作成します。
 *
 * @public
 * @param {WebGL2RenderingContext} gl2
 * @param {GeometrySet} geometrySet
 * @param {LocationIndexSetList} locationIndexList
 * @return {WebGLVertexArrayObject}
 */
export const createVertexArray = (gl2, geometrySet, locationIndexList) => {
  const vertexArray = gl2.createVertexArray();
  gl2.bindVertexArray(vertexArray);

  geometrySet.attributeSetList.forEach((attributeSet, i) => {
    gl2.bindBuffer(gl2.ARRAY_BUFFER, attributeSet.bufferSet.buffer);

    const stride =
      attributeSet.attributeList.reduce(
        (accumulator, currentValue) => accumulator + currentValue.size * TypeSizeDictionary[currentValue.type],
        0
      );

    let offset = 0;
    attributeSet.attributeList.forEach((attribute, j) => {
      const locationIndex = locationIndexList[i][j];

      if (locationIndex !== -1) {
        gl2.enableVertexAttribArray(locationIndex);
        if (attribute.type === gl2.FLOAT) {
          gl2.vertexAttribPointer(
            locationIndex,
            attribute.size,
            attribute.type,
            false,
            stride,
            offset
          );
        } else {
          gl2.vertexAttribIPointer(
            locationIndex,
            attribute.size,
            attribute.type,
            stride,
            offset
          );
        }
        if (attribute.divisor > 0) {
          gl2.vertexAttribDivisor(locationIndex, attribute.divisor);
        }
      }
      offset += attribute.size * TypeSizeDictionary[attribute.type];
    });
  });

  if (geometrySet.indices) {
    gl2.bindBuffer(gl2.ELEMENT_ARRAY_BUFFER, geometrySet.indices.buffer);
  }

  gl2.bindVertexArray(null);
  gl2.bindBuffer(gl2.ARRAY_BUFFER, null);
  gl2.bindBuffer(gl2.ELEMENT_ARRAY_BUFFER, null);

  return vertexArray;
};

/**
 * @enum {GLenum}
 */
const GLenumDataType = {
  BYTE: 0x1400,
  UNSIGNED_BYTE: 0x1401,
  SHORT: 0x1402,
  UNSIGNED_SHORT: 0x1403,
  UNSIGNED_INT: 0x1405,
  FLOAT: 0x1406
};

/**
 * @enum {number}
 */
const TypeSizeDictionary = {};
TypeSizeDictionary[GLenumDataType.BYTE] = 1;
TypeSizeDictionary[GLenumDataType.UNSIGNED_BYTE] = 1;
TypeSizeDictionary[GLenumDataType.SHORT] = 2;
TypeSizeDictionary[GLenumDataType.UNSIGNED_SHORT] = 2;
TypeSizeDictionary[GLenumDataType.UNSIGNED_INT] = 4;
TypeSizeDictionary[GLenumDataType.FLOAT] = 4;

/**
 * @typedef {Object} Attribute
 *
 * @property {string} name
 * @property {number} size
 * @property {GLenum} type
 * @property {number} divisor
 */

/**
 * @typedef {Object} BufferSet
 *
 * @property {GLenum} usage
 * @property {ArrayBufferLike} data
 * @property {?WebGLBuffer} buffer
 */

/**
 * @typedef {Object} AttributeSet
 *
 * @property {Attribute[]} attributeList
 * @property {BufferSet} bufferSet
 */

/**
 * @typedef {Object} GeometrySet
 *
 * @property {AttributeSet[]} attributeSetList
 * @property {!IndexBufferSet} indices
 */

/**
 * @typedef {GLint[][]} LocationIndexSetList
 */

/**
 * @typedef {Object} IndexBufferSetType
 *
 * @property {GLenum} componentType
 * @property {number} length
 *
 * @typedef {BufferSet & IndexBufferSetType} IndexBufferSet
 */


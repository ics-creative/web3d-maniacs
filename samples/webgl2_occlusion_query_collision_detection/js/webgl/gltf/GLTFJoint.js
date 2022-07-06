const {vec3, quat, mat4} = glMatrix;

export class GLTFJoint {
  /**
   * @public
   * @type {boolean}
   */
  localTransformMatrixDirty = false;

  /**
   * @public
   * @type {boolean}
   */
  globalTransformMatrixDirty = false;

  /**
   * @public
   * @type {Float32Array}
   */
  localTransformMatrix = undefined;

  /**
   * @public
   * @type {Float32Array}
   */
  globalTransformMatrix = undefined;

  /**
   * @public
   * @type {Float32Array}
   */
  skinningTransformMatrix = undefined;

  /**
   * @public
   * @type {Float32Array}
   */
  translate = undefined;

  /**
   * @public
   * @type {Float32Array}
   */
  rotate = undefined;

  /**
   * @public
   * @type {Float32Array}
   */
  scale = undefined;

  /**
   * @private
   * @type {Float32Array}
   */
  #inverseBindMatrix = undefined;

  /**
   * @private
   * @type {GLTFJoint}
   */
  #parent = undefined;

  /**
   * @private
   * @type {GLTFJoint[]}
   */
  #children = undefined;

  /**
   * @public
   * @param {Float32Array} inverseBindMatrix
   * @param {Float32Array} skinningTransformMatrix
   */
  constructor(inverseBindMatrix, skinningTransformMatrix) {
    this.translate = vec3.fromValues(0.0, 0.0, 0.0);
    this.rotate = quat.create();
    this.scale = vec3.fromValues(1.0, 1.0, 1.0);
    this.localTransformMatrixDirty = true;
    this.globalTransformMatrixDirty = true;
    this.localTransformMatrix = mat4.create();
    this.globalTransformMatrix = mat4.create();
    if (inverseBindMatrix) {
      this.#inverseBindMatrix = inverseBindMatrix;
    } else {
      this.#inverseBindMatrix = mat4.create();
      mat4.identity(this.#inverseBindMatrix);
    }
    if (skinningTransformMatrix) {
      this.skinningTransformMatrix = skinningTransformMatrix;
    } else {
      this.skinningTransformMatrix = mat4.create();
    }

    this.#children = [];
  }

  /**
   * @public
   * @param {GLTFJoint} child
   */
  addChild = (child) => {
    if (child.#parent) {
      child.#parent.removeChild(child);
    }
    this.#children.push(child);
    child.#parent = this;
  }

  /**
   * @public
   * @param {GLTFJoint} child
   */
  removeChild = (child) => {
    const index = this.#children.indexOf(child);
    if (index !== -1) {
      this.#children.splice(index, 1);
      child.#parent = null;
    }
  }

  /**
   * @public
   * @param {Float32Array} translate
   */
  setTranslate = (translate) => {
    this.translate = translate;
    this.localTransformMatrixDirty = true;
  }

  /**
   * @public
   * @param {Float32Array} rotate
   */
  setRotate = (rotate) => {
    this.rotate = rotate;
    this.localTransformMatrixDirty = true;
  }

  /**
   * @public
   * @param {Float32Array} scale
   */
  setScale = (scale) => {
    this.scale = scale;
    this.localTransformMatrixDirty = true;
  }

  /**
   * @public
   * @return {Float32Array}
   */
  getLocalTransformMatrix = () => {
    if (this.localTransformMatrixDirty) {
      mat4.fromRotationTranslationScale(this.localTransformMatrix, this.rotate, this.translate, this.scale);
      this.localTransformMatrixDirty = false;
    }

    return this.localTransformMatrix;
  }

  /**
   * @public
   * @return {Float32Array}
   */
  getGlobalTransformMatrix = () => {
    if (this.globalTransformMatrixDirty) {
      if (this.#parent) {
        mat4.multiply(this.globalTransformMatrix, this.#parent.getGlobalTransformMatrix(), this.getLocalTransformMatrix());
      } else {
        mat4.copy(this.globalTransformMatrix, this.getLocalTransformMatrix());
      }
      this.globalTransformMatrixDirty = false;
    }

    return this.globalTransformMatrix;
  }

  /**
   * @public
   * @return {Float32Array}
   */
  getSkinningTransformMatrix = () => {
    mat4.multiply(this.skinningTransformMatrix, this.getGlobalTransformMatrix(), this.#inverseBindMatrix);
    return this.skinningTransformMatrix;
  }
}
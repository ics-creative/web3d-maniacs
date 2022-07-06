const {vec3, quat, mat4} = glMatrix;

const INV_RAD = 180 / Math.PI;

export class SceneObject {
  /**
   * @private
   * @type {mat4}
   */
  #mGlobalMatrix = undefined;

  /**
   * @private
   * @type {mat4}
   */
  #mLocalMatrix = undefined;

  /**
   * @private
   * @type {vec3}
   */
  #translateVec = undefined;

  /**
   * @private
   * @type {vec3}
   */
  #scaleVec = undefined;

  /**
   * @private
   * @type {quat}
   */
  #quat = undefined;

  /**
   * @private
   * @type {boolean}
   */
  #isDirty = true;

  /**
   * @private
   * @type {boolean}
   */
  #isRotationDirty = true;

  /**
   * @private
   * @type {number}
   */
  #rotationX = 0.0;

  /**
   * @private
   * @type {number}
   */
  #rotationY = 0.0;

  /**
   * @private
   * @type {number}
   */
  #rotationZ = 0.0;

  /**
   * @private
   * @type {SceneObject | null}
   */
  #parent = undefined;

  /**
   * @private
   * @type {SceneObject[]}
   */
  #children = undefined;

  /**
   * @public
   * @param {boolean} value
   */
  set isDirty(value) {
    this.#isDirty = value;
  }

  /**
   * @public
   * @param {boolean} value
   */
  set isRotationDirty(value) {
    this.#isRotationDirty = value;
    if (value) {
      this.#isDirty = true;
    }
  }

  /**
   * @public
   * @return {number}
   */
  get x() {
    return this.#translateVec[0];
  }

  /**
   * @public
   * @param {number} value
   */
  set x(value) {
    if (this.#translateVec[0] !== value) {
      this.#translateVec[0] = value;
      this.#isDirty = true;
    }
  }

  /**
   * @public
   * @return {number}
   */
  get y() {
    return this.#translateVec[1];
  }

  /**
   * @public
   * @param {number} value
   */
  set y(value) {
    if (this.#translateVec[1] !== value) {
      this.#translateVec[1] = value;
      this.#isDirty = true;
    }
  }

  /**
   * @public
   * @return {number}
   */
  get z() {
    return this.#translateVec[2];
  }

  /**
   * @public
   * @param {number} value
   */
  set z(value) {
    if (this.#translateVec[2] !== value) {
      this.#translateVec[2] = value;
      this.#isDirty = true;
    }
  }

  /**
   * @public
   * @return {vec3}
   */
  get translate() {
    return this.#translateVec;
  }

  /**
   * @public
   * @return {number}
   */
  get scaleX() {
    return this.#scaleVec[0];
  }

  /**
   * @public
   * @param {number} value
   */
  set scaleX(value) {
    if (this.#scaleVec[0] !== value) {
      this.#scaleVec[0] = value;
      this.#isDirty = true;
    }
  }

  /**
   * @public
   * @return {number}
   */
  get scaleY() {
    return this.#scaleVec[1];
  }

  /**
   * @public
   * @param {number} value
   */
  set scaleY(value) {
    if (this.#scaleVec[1] !== value) {
      this.#scaleVec[1] = value;
      this.#isDirty = true;
    }
  }

  /**
   * @public
   * @return {number}
   */
  get scaleZ() {
    return this.#scaleVec[2];
  }

  /**
   * @public
   * @param {number} value
   */
  set scaleZ(value) {
    if (this.#scaleVec[2] !== value) {
      this.#scaleVec[2] = value;
      this.#isDirty = true;
    }
  }

  /**
   * @public
   * @return {vec3}
   */
  get scale() {
    return this.#scaleVec;
  }

  /**
   * @public
   * @param {number} value
   */
  set scaleAll(value) {
    this.scaleX = this.scaleY = this.scaleZ = value;
  }

  /**
   * @public
   * @return {number}
   */
  get rotationX() {
    return this.#rotationX;
  }

  /**
   * @public
   * @param {number} value
   */
  set rotationX(value) {
    if (this.#rotationX !== value) {
      this.#rotationX = value;
      this.#isRotationDirty = true;
      this.#isDirty = true;
    }
  }

  /**
   * @public
   * @return {number}
   */
  get rotationY() {
    return this.#rotationY;
  }

  /**
   * @public
   * @param {number} value
   */
  set rotationY(value) {
    if (this.#rotationY !== value) {
      this.#rotationY = value;
      this.#isRotationDirty = true;
      this.#isDirty = true;
    }
  }

  /**
   * @public
   * @return {number}
   */
  get rotationZ() {
    return this.#rotationZ;
  }

  /**
   * @public
   * @param {number} value
   */
  set rotationZ(value) {
    if (this.#rotationZ !== value) {
      this.#rotationZ = value;
      this.#isRotationDirty = true;
      this.#isDirty = true;
    }
  }

  /**
   * @public
   * @return {quat}
   */
  get quaternion() {
    return this.#quat;
  }

  /**
   * @public
   */
  constructor() {
    this.#mLocalMatrix = mat4.identity(mat4.create());
    this.#mGlobalMatrix = mat4.identity(mat4.create());
    this.#translateVec = vec3.create();
    this.#scaleVec = vec3.create();
    this.#quat = quat.create();

    this.#isDirty = true;
    this.#isRotationDirty = true;
    vec3.set(this.#translateVec, 0.0, 0.0, 0.0);
    vec3.set(this.#scaleVec, 1.0, 1.0, 1.0);
    this.#rotationX = 0.0;
    this.#rotationY = 0.0;
    this.#rotationZ = 0.0;

    this.#parent = null;
    this.#children = [];
  }

  /**
   * @public
   * @param {SceneObject} child
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
   * @param {SceneObject} child
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
   * @param {mat4} mat
   */
  setMatrix = (mat) => {
    this.#isDirty = false;
    this.#isRotationDirty = false;
    mat4.getTranslation(this.#translateVec, mat);
    mat4.getTranslation(this.#scaleVec, mat);
    mat4.getTranslation(this.#quat, mat);
    mat4.copy(this.#mLocalMatrix, mat);
  }

  /**
   * @public
   * @return {mat4}
   */
  getModelMatrix = () => {
    if (this.#isDirty) {
      this.#isDirty = false;

      if (this.#isRotationDirty) {
        this.#isRotationDirty = false;
        quat.fromEuler(this.#quat, this.#rotationX * INV_RAD, this.#rotationY * INV_RAD, this.#rotationZ * INV_RAD);
      }
      mat4.fromRotationTranslationScale(this.#mLocalMatrix, this.#quat, this.#translateVec, this.#scaleVec);
    }

    if (this.#parent) {
      mat4.multiply(this.#mGlobalMatrix, this.#parent.getModelMatrix(), this.#mLocalMatrix);
    } else {
      mat4.copy(this.#mGlobalMatrix, this.#mLocalMatrix);
    }

    return this.#mGlobalMatrix;
  }
}

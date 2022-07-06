const {vec3, mat4} = glMatrix;

export class Camera {
  /**
   * @public
   * @type {number}
   */
  x = 0.0;

  /**
   * @public
   * @type {number}
   */
  y = 0.0;

  /**
   * @public
   * @type {number}
   */
  z = 0.0;

  /**
   * @private
   * @type {vec3}
   */
  #cameraUP = undefined;

  /**
   * @private
   * @type {vec3}
   */
  #cameraPos = undefined;

  /**
   * @private
   * @type {mat4}
   */
  #projectionMatrix = undefined;

  /**
   * @private
   * @type {mat4}
   */
  #cameraMatrix = undefined;

  /**
   * @private
   * @type {mat4}
   */
  #lookMatrix = undefined;

  /**
   * @public
   * @param {number} fov
   * @param {number} aspect
   * @param {number} zNear
   * @param {number} zFar
   */
  constructor(fov, aspect, zNear, zFar) {
    this.#cameraUP = vec3.fromValues(0.0, 1.0, 0.0);
    //
    this.#cameraPos = vec3.fromValues(0.0, 0.0, 0.0);
    this.#projectionMatrix = mat4.identity(mat4.create());
    this.#cameraMatrix = mat4.identity(mat4.create());
    this.#lookMatrix = mat4.identity(mat4.create());
    //
    this.x = this.#cameraPos[0];
    this.y = this.#cameraPos[1];
    this.z = this.#cameraPos[2];

    mat4.perspective(this.#projectionMatrix, fov, aspect, zNear, zFar);
  }

  /**
   * @public
   * @return {mat4}
   */
  getCameraMatrix = () => {
    return this.#cameraMatrix;
  }

  /**
   * @public
   * @return {mat4}
   */
  getProjectionMatrix = () => {
    return this.#projectionMatrix;
  }

  /**
   * @public
   * @return {mat4}
   */
  getLookMtx = () => {
    return this.#lookMatrix;
  }

  /**
   * @public
   * @param {vec3} point
   */
  lookAt = (point) => {
    vec3.set(this.#cameraPos, this.x, this.y, this.z);
    mat4.lookAt(this.#lookMatrix, this.#cameraPos, point, this.#cameraUP);
    mat4.multiply(this.#cameraMatrix, this.#projectionMatrix, this.#lookMatrix);
  }
}
export class ProgramObject {
  /**
   * @public
   * @type {WebGLProgram}
   */
  program = undefined;

  /**
   * @public
   * @type {UniformLocation}
   */
  uniformLocation = undefined;

  /**
   * @public
   */
  constructor() {
  }

  /**
   * @public
   * @param {WebGL2RenderingContext} gl2
   */
  createProgram = (gl2) => {
  }
}

/**
 * @typedef {Object.<string, WebGLUniformLocation | null>} UniformLocation
 */
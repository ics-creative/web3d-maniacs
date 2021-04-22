export class Camera {
  constructor(fov, aspect, zNear, zFar) {
    this._cameraUP = vec3.fromValues(0.0, 1.0, 0.0);
    //
    this._cameraPos = vec3.fromValues(0.0, 0.0, 0.0);
    this._projectionMtx = mat4.identity(mat4.create());
    this._cameraMtx = mat4.identity(mat4.create());
    this._lookMtx = mat4.identity(mat4.create());
    //
    this.x = this._cameraPos[0];
    this.y = this._cameraPos[1];
    this.z = this._cameraPos[2];

    mat4.perspective(this._projectionMtx, fov, aspect, zNear, zFar);
  }

  getCameraMtx() {
    return this._cameraMtx;
  }

  getProjectionMtx() {
    return this._projectionMtx;
  }

  getLookMtx() {
    return this._lookMtx;
  }

  lookAt(point) {
    vec3.set(this._cameraPos, this.x, this.y, this.z);
    mat4.lookAt(this._lookMtx, this._cameraPos, point, this._cameraUP);
    mat4.multiply(this._cameraMtx, this._projectionMtx, this._lookMtx);
  }
}
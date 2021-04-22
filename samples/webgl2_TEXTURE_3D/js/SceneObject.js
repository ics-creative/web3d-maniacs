const INV_RAD = 180 / Math.PI;

export class SceneObject {
  set dirty(value) {
    this._dirty = value;
  }

  set rotationDirty(value) {
    this._rotationDirty = value;
    if (value) {
      this._dirty = true;
    }
  }

  get x() {
    return this._translateVec[0];
  }

  set x(value) {
    if (this._translateVec[0] !== value) {
      this._translateVec[0] = value;
      this._dirty = true;
    }
  }

  get y() {
    return this._translateVec[1];
  }

  set y(value) {
    if (this._translateVec[1] !== value) {
      this._translateVec[1] = value;
      this._dirty = true;
    }
  }

  get z() {
    return this._translateVec[2];
  }

  set z(value) {
    if (this._translateVec[2] !== value) {
      this._translateVec[2] = value;
      this._dirty = true;
    }
  }

  get translate() {
    return this._translateVec;
  }

  get scaleX() {
    return this._scaleVec[0];
  }

  set scaleX(value) {
    if (this._scaleVec[0] !== value) {
      this._scaleVec[0] = value;
      this._dirty = true;
    }
  }

  get scaleY() {
    return this._scaleVec[1];
  }

  set scaleY(value) {
    if (this._scaleVec[1] !== value) {
      this._scaleVec[1] = value;
      this._dirty = true;
    }
  }

  get scaleZ() {
    return this._scaleVec[2];
  }

  set scaleZ(value) {
    if (this._scaleVec[2] !== value) {
      this._scaleVec[2] = value;
      this._dirty = true;
    }
  }

  get scale() {
    return this._scaleVec;
  }

  get rotationX() {
    return this._rotationX;
  }

  set rotationX(value) {
    if (this._rotationX !== value) {
      this._rotationX = value;
      this._rotationDirty = true;
      this._dirty = true;
    }
  }

  get rotationY() {
    return this._rotationY;
  }

  set rotationY(value) {
    if (this._rotationY !== value) {
      this._rotationY = value;
      this._rotationDirty = true;
      this._dirty = true;
    }
  }

  get rotationZ() {
    return this._rotationZ;
  }

  set rotationZ(value) {
    if (this._rotationZ !== value) {
      this._rotationZ = value;
      this._rotationDirty = true;
      this._dirty = true;
    }
  }

  get quaternion() {
    return this._quat;
  }

  constructor() {
    this._mMatrix = mat4.identity(mat4.create());
    this._translateVec = vec3.create();
    this._scaleVec = vec3.create();
    this._quat = quat.create();

    this._dirty = true;
    this._rotationDirty = true;
    vec3.set(this._translateVec, 0.0, 0.0, 0.0);
    vec3.set(this._scaleVec, 1.0, 1.0, 1.0);
    this._rotationX = 0.0;
    this._rotationY = 0.0;
    this._rotationZ = 0.0;
  }

  getModelMatrix() {
    if (this._dirty) {
      this._dirty = false;

      if (this._rotationDirty) {
        this._rotationDirty = false;
        quat.fromEuler(this._quat, this._rotationX * INV_RAD, this._rotationY * INV_RAD, this._rotationZ * INV_RAD);
      }
      mat4.fromRotationTranslationScale(this._mMatrix, this._quat, this._translateVec, this._scaleVec);
    }

    return this._mMatrix;
  }
}

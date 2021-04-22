const RAD = Math.PI / 180.0;

export class RoundCameraController {
  constructor(camera, stage) {
    // parameter
    this.radiusMin = 1.0;
    this.radiusOffset = 0.1;
    this.gestureRadiusFactor = 20.0;

    // camera
    this.radius = 2.0;
    this._theta = 0.0;
    this._oldX = 0.0;
    this._phi = 90.0;
    this._oldY = 0.0;
    this._currentTheta = 0.0;
    this._currentPhi = 90.0;

    // for mouse
    this.isMouseDown = false;

    // for touch
    this._identifier = -1;
    this._oldRadius = this.radius;
    this._isGestureChange = false;

    this._camera = camera;
    this._stage = stage;
    this._target = vec3.fromValues(0.0, 0.0, 0.0);
    this.enable();
    this._updateCamera();
  }

  enable() {
    document.addEventListener('keydown', (event) => {
      this._keyHandler(event);
    });
    document.addEventListener('mouseup', (event) => {
      this._upHandler(event);
    });
    this._stage.addEventListener('mousedown', (event) => {
      this._downHandler(event);
    });
    this._stage.addEventListener('mousemove', (event) => {
      this._moveHandler(event);
    });
    this._stage.addEventListener('mousewheel', (event) => {
      this._wheelHandler(event);
    }, {passive: false});
    this._stage.addEventListener('DOMMouseScroll', (event) => {
      this._domMouseScrollHandler(event);
    });

    // touch
    if ('ontouchstart' in window) {
      this._stage.addEventListener('touchstart', (event) => {
        this._touchStartHandler(event);
      });
      this._stage.addEventListener('touchmove', (event) => {
        this._touchMoveHandler(event);
      });
      document.addEventListener('touchend', (event) => {
        this._touchEndHandler(event);
      });
    }
    if ('ongesturestart' in window || 'GestureEvent' in window) {
      this._stage.addEventListener('gesturestart', (event) => {
        this._gestureStartHandler(event);
      });
      this._stage.addEventListener('gesturechange', (event) => {
        this._gestureChangeHandler(event);
      });
      document.addEventListener('gestureend', (event) => {
        this._gestureEndHandler(event);
      });
    }
  }

  _keyHandler(event) {
    switch (event.code) {
      case 'ArrowUp':
        this.radius -= this.radiusOffset;
        if (this.radius < this.radiusMin) {
          this.radius = this.radiusMin;
        }
        break;
      case 'ArrowDown':
        this.radius += this.radiusOffset;
        break;
      default:
        break;
    }
  }

  _upHandler(event) {
    this.isMouseDown = false;
  }

  _downHandler(event) {
    this.isMouseDown = true;
    const rect = event.target.getBoundingClientRect();
    this._oldX = event.clientX - rect.left;
    this._oldY = event.clientY - rect.top;
  }

  _wheelHandler(event) {
    event.preventDefault();
    if (event.deltaY < 0) {
      this.radius -= this.radiusOffset;
      if (this.radius < this.radiusMin) {
        this.radius = this.radiusMin;
      }
    } else {
      this.radius += this.radiusOffset;
    }
  }

  _domMouseScrollHandler(event) {
    event.preventDefault();
    if (event.detail < 0) {
      this.radius -= this.radiusOffset;
      if (this.radius < this.radiusMin) {
        this.radius = this.radiusMin;
      }
    } else {
      this.radius += this.radiusOffset;
    }
  }

  _moveHandler(event) {
    if (this.isMouseDown) {
      const rect = event.target.getBoundingClientRect();
      const stageX = event.clientX - rect.left;
      const stageY = event.clientY - rect.top;

      this.inputXY(stageX, stageY);
    }
  }

  _touchStartHandler(event) {
    event.preventDefault();
    if (!this.isMouseDown) {
      const touches = event.changedTouches;
      const touch = touches[0];
      this.isMouseDown = true;
      this._identifier = touch.identifier;
      const target = touch.target;
      this._oldX = touch.pageX - target.offsetLeft;
      this._oldY = touch.pageY - target.offsetTop;
    }
  }

  _touchMoveHandler(event) {
    event.preventDefault();
    if (this._isGestureChange) {
      return;
    }
    const touches = event.changedTouches;
    const touchLength = touches.length;
    for (let i = 0; i < touchLength; i++) {
      const touch = touches[i];
      if (touch.identifier === this._identifier) {
        const target = touch.target;
        const stageX = touch.pageX - target.offsetLeft;
        const stageY = touch.pageY - target.offsetTop;
        this.inputXY(stageX, stageY);
        break;
      }
    }
  }

  _touchEndHandler(event) {
    if (this.isMouseDown) {
      event.preventDefault();
    }
    this.isMouseDown = false;
  }

  _gestureStartHandler(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    this._isGestureChange = true;
    this.isMouseDown = true;
    this._oldRadius = this.radius;
  }

  _gestureChangeHandler(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    this.radius = this._oldRadius + this.gestureRadiusFactor * this.radiusOffset * (1 - event.scale);
    if (this.radius < this.radiusMin) {
      this.radius = this.radiusMin;
    }
  }

  _gestureEndHandler(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    this._isGestureChange = false;
    this.isMouseDown = false;
    this._identifier = -1;
  }

  inputXY(newX, newY) {
    this._theta -= (newX - this._oldX) * 0.3;
    this._oldX = newX;
    this._phi -= (newY - this._oldY) * 0.3;
    this._oldY = newY;
    //
    if (this._phi < 20) {
      this._phi = 20;
    } else if (this._phi > 160) {
      this._phi = 160;
    }
  }

  _updateCamera() {
    const t = this._currentTheta * RAD;
    const p = this._currentPhi * RAD;

    const rsin = this.radius * Math.sin(p);
    this._camera.x = rsin * Math.sin(t) + this._target[0];
    this._camera.z = rsin * Math.cos(t) + this._target[2];
    this._camera.y = this.radius * Math.cos(p) + this._target[1];

    this._camera.lookAt(this._target);
  }

  update(factor = 0.1) {
    this._currentTheta += (this._theta - this._currentTheta) * factor;
    this._currentPhi += (this._phi - this._currentPhi) * factor;

    this._updateCamera();
  }

  rotate(dTheta, dPhi) {
    this._theta += dTheta;
    this._phi += dPhi;
  }

  set(theta, phi) {
    this._theta = theta;
    this._phi = phi;
  }
}

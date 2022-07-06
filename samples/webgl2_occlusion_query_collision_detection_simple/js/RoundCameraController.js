const {vec3} = glMatrix;
const RAD = Math.PI / 180.0;

export class RoundCameraController {
  /**
   * @public
   * @type {number}
   */
  radiusMin = 1.0;

  /**
   * @public
   * @type {number}
   */
  radiusMax = 200;

  /**
   * @public
   * @type {number}
   */
  radiusOffset = 0.1;

  /**
   * @public
   * @type {number}
   */
  gestureRadiusFactor = 20.0;

  /**
   * @public
   * @type {boolean}
   */
  isMouseDown = false;

  /**
   * @private
   * @type {number}
   */
  #oldX = 0.0;

  /**
   * @private
   * @type {number}
   */
  #oldY = 0.0;

  /**
   * @private
   * @type {number}
   */
  #currentTheta = 0.0;

  /**
   * @private
   * @type {number}
   */
  #currentPhi = 90.0;

  /**
   * @private
   * @type {number}
   */
  #identifier = -1;

  /**
   * @private
   * @type {number}
   */
  #oldRadius = 0.0;

  /**
   * @private
   * @type {boolean}
   */
  #isGestureChange = false;

  /**
   * @private
   * @type {boolean}
   */
  #hasNativeGestureEvent = false;

  /**
   * @private
   * @type {number}
   */
  #pinchDistanceSquare = 0.0;

  /**
   * @private
   * @type {Camera}
   */
  #camera = undefined;

  /**
   * @private
   * @type {HTMLCanvasElement}
   */
  #stage = undefined;

  /**
   * @private
   * @type {vec3}
   */
  #target = undefined;

  /**
   * @private
   * @type {number}
   */
  #radius = 2.0;

  /**
   * @private
   * @type {number}
   */
  #theta = 0.0;

  /**
   * @private
   * @type {number}
   */
  #phi = 90.0;

  /**
   * @public
   * @return {number}
   */
  get radius() {
    return this.#radius;
  }

  /**
   * @public
   * @param {number} value
   */
  set radius(value) {
    this.#radius = value;
  }

  /**
   * @public
   * @return {number}
   */
  get theta() {
    return this.#theta;
  }

  /**
   * @public
   * @param {number} value
   */
  set theta(value) {
    this.#theta = value;
  }

  /**
   * @public
   * @return {number}
   */
  get phi() {
    return this.#phi;
  }

  /**
   * @public
   * @param {number} value
   */
  set phi(value) {
    this.#phi = value;
  }

  /**
   * @public
   * @param {Camera} camera
   * @param {HTMLCanvasElement} stage
   */
  constructor(camera, stage) {
    // parameter
    this.radiusMin = 1.0;
    this.radiusMax = 200;
    this.radiusOffset = 0.1;
    this.gestureRadiusFactor = 20.0;

    // camera
    this.#radius = 2.0;
    this.#theta = 0.0;
    this.#oldX = 0.0;
    this.#phi = 90.0;
    this.#oldY = 0.0;
    this.#currentTheta = 0.0;
    this.#currentPhi = 90.0;

    // for mouse
    this.isMouseDown = false;

    // for touch
    this.#identifier = -1;
    this.#oldRadius = this.#radius;
    this.#isGestureChange = false;
    this.#hasNativeGestureEvent = false;

    this.#camera = camera;
    this.#stage = stage;
    this.#target = vec3.fromValues(0.0, 0.0, 0.0);
    this.enable();
    this.#updateCamera();
  }

  /**
   * @public
   */
  enable() {
    document.addEventListener("keydown", (event) => {
      this.#keyHandler(event);
    });
    document.addEventListener("mouseup", (event) => {
      this.#upHandler(event);
    });
    this.#stage.addEventListener("mousedown", (event) => {
      this.#downHandler(event);
    });
    this.#stage.addEventListener("mousemove", (event) => {
      this.#moveHandler(event);
    });
    this.#stage.addEventListener("mousewheel", (event) => {
      this.#wheelHandler(event);
    }, {passive: false});
    this.#stage.addEventListener("DOMMouseScroll", (event) => {
      this.#domMouseScrollHandler(event);
    });

    // touch
    if ("ontouchstart" in window) {
      this.#stage.addEventListener("touchstart", (event) => {
        this.#touchStartHandler(event);
      });
      this.#stage.addEventListener("touchmove", (event) => {
        this.#touchMoveHandler(event);
      });
      document.addEventListener("touchend", (event) => {
        this.#touchEndHandler(event);
      });
    }
    if ("ongesturestart" in window || "GestureEvent" in window) {
      this.#hasNativeGestureEvent = true;
      this.#stage.addEventListener("gesturestart", (event) => {
        this.#gestureStartHandler(event);
      });
      this.#stage.addEventListener("gesturechange", (event) => {
        this.#gestureChangeHandler(event);
      });
      document.addEventListener("gestureend", (event) => {
        this.#gestureEndHandler(event);
      });
    } else {
      this.#hasNativeGestureEvent = false;
    }
  }

  /**
   * @private
   * @param {KeyboardEvent} event
   */
  #keyHandler = (event) => {
    switch (event.code) {
      case "ArrowUp":
        this.#radius -= this.radiusOffset;
        if (this.#radius < this.radiusMin) {
          this.#radius = this.radiusMin;
        }
        break;
      case "ArrowDown":
        this.#radius += this.radiusOffset;
        if (this.#radius > this.radiusMax) {
          this.#radius = this.radiusMax;
        }
        break;
      default:
        break;
    }
  }

  /**
   * @private
   * @param {MouseEvent} event
   */
  #upHandler = (event) => {
    this.isMouseDown = false;
  }

  /**
   * @private
   * @param {MouseEvent} event
   */
  #downHandler = (event) => {
    this.isMouseDown = true;
    const rect = event.target.getBoundingClientRect();
    this.#oldX = event.clientX - rect.left;
    this.#oldY = event.clientY - rect.top;
  }

  /**
   * @private
   * @param {MouseEvent} event
   */
  #wheelHandler = (event) => {
    event.preventDefault();
    if (event.deltaY < 0) {
      this.#radius -= this.radiusOffset;
      if (this.#radius < this.radiusMin) {
        this.#radius = this.radiusMin;
      }
    } else {
      this.#radius += this.radiusOffset;
      if (this.#radius > this.radiusMax) {
        this.#radius = this.radiusMax;
      }
    }
  }

  /**
   * @private
   * @param {MouseEvent} event
   */
  #domMouseScrollHandler = (event) => {
    event.preventDefault();
    if (event.detail < 0) {
      this.#radius -= this.radiusOffset;
      if (this.#radius < this.radiusMin) {
        this.#radius = this.radiusMin;
      }
    } else {
      this.#radius += this.radiusOffset;
      if (this.#radius > this.radiusMax) {
        this.#radius = this.radiusMax;
      }
    }
  }

  /**
   * @private
   * @param {MouseEvent} event
   */
  #moveHandler = (event) => {
    if (this.isMouseDown) {
      const rect = event.target.getBoundingClientRect();
      const stageX = event.clientX - rect.left;
      const stageY = event.clientY - rect.top;

      this.inputXY(stageX, stageY);
    }
  }


  /**
   * @private
   * @param {TouchEvent} event
   */
  #touchStartHandler = (event) => {
    if (!this.#hasNativeGestureEvent) {
      if (event.touches.length > 1) {
        this.#pinchDistanceSquare = this.#calcPinchDistanceSquare(event.touches);
        this.#gestureStartHandler(event);
        return;
      } else {
        this.#pinchDistanceSquare = 0.0;
      }
    }

    event.preventDefault();

    if (!this.isMouseDown) {
      const touches = event.changedTouches;
      const touch = touches[0];
      this.isMouseDown = true;
      this.#identifier = touch.identifier;
      const target = touch.target;
      this.#oldX = touch.pageX - target.offsetLeft;
      this.#oldY = touch.pageY - target.offsetTop;
    }
  }

  /**
   * @private
   * @param {TouchEvent} event
   */
  #touchMoveHandler = (event) => {
    if (!this.#hasNativeGestureEvent) {
      if (event.touches.length > 1) {
        if (this.#pinchDistanceSquare > 0) {
          const newPinchDistanceSquare = this.#calcPinchDistanceSquare(event.touches);
          event.scale = Math.sqrt(newPinchDistanceSquare / this.#pinchDistanceSquare);
          this.#gestureChangeHandler(event);
          return;
        }
      }
    }

    event.preventDefault();

    if (this.#isGestureChange) {
      return;
    }
    const touches = event.changedTouches;
    const touchLength = touches.length;
    for (let i = 0; i < touchLength; i++) {
      const touch = touches[i];
      if (touch.identifier === this.#identifier) {
        const target = touch.target;
        const stageX = touch.pageX - target.offsetLeft;
        const stageY = touch.pageY - target.offsetTop;
        this.inputXY(stageX, stageY);
        break;
      }
    }
  }

  /**
   * @private
   * @param {TouchEvent} event
   */
  #touchEndHandler = (event) => {
    if (!this.#hasNativeGestureEvent) {
      if (this.#pinchDistanceSquare > 0) {
        this.#gestureEndHandler(event);
        return;
      }
    }

    if (this.isMouseDown) {
      event.preventDefault();
    }
    this.isMouseDown = false;
  }

  /**
   * @private
   * @param {GestureEvent} event
   */
  #gestureStartHandler = (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    this.#isGestureChange = true;
    this.isMouseDown = true;
    this.#oldRadius = this.#radius;
  }

  /**
   * @private
   * @param {GestureEvent} event
   */
  #gestureChangeHandler = (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    this.#radius = this.#oldRadius + this.gestureRadiusFactor * this.radiusOffset * (1 - event.scale);
    if (this.#radius < this.radiusMin) {
      this.#radius = this.radiusMin;
    } else if (this.#radius > this.radiusMax) {
      this.#radius = this.radiusMax;
    }
  }

  /**
   * @private
   * @param {GestureEvent} event
   */
  #gestureEndHandler = (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    this.#isGestureChange = false;
    this.isMouseDown = false;
    this.#identifier = -1;
  }

  /**
   * @private
   * @param {TouchList} touches
   * @return {number}
   */
  #calcPinchDistanceSquare = (touches) => {
    const t0 = touches[0];
    const t1 = touches[1];
    const dx = t1.pageX - t0.pageX;
    const dy = t1.pageY - t0.pageY;
    return dx * dx + dy * dy;
  }

  /**
   * @private
   */
  #updateCamera = () => {
    const t = this.#currentTheta * RAD;
    const p = this.#currentPhi * RAD;

    const rsin = this.#radius * Math.sin(p);
    this.#camera.x = rsin * Math.sin(t) + this.#target[0];
    this.#camera.z = rsin * Math.cos(t) + this.#target[2];
    this.#camera.y = this.#radius * Math.cos(p) + this.#target[1];

    this.#camera.lookAt(this.#target);
  }

  /**
   * @public
   * @param {number} newX
   * @param {number} newY
   */
  inputXY = (newX, newY) => {
    this.#theta -= (newX - this.#oldX) * 0.3;
    this.#oldX = newX;
    this.#phi -= (newY - this.#oldY) * 0.3;
    this.#oldY = newY;
    //
    if (this.#phi < 20) {
      this.#phi = 20;
    } else if (this.#phi > 160) {
      this.#phi = 160;
    }
  }

  /**
   * @public
   * @param {number} factor
   */
  update = (factor = 0.1) => {
    this.#currentTheta += (this.#theta - this.#currentTheta) * factor;
    this.#currentPhi += (this.#phi - this.#currentPhi) * factor;

    this.#updateCamera();
  }

  /**
   * @public
   * @param {number} dTheta
   * @param {number} dPhi
   */
  rotate = (dTheta, dPhi) => {
    this.#theta += dTheta;
    this.#phi += dPhi;
  }

  /**
   * @public
   * @param {number} theta
   * @param {number} phi
   */
  set = (theta, phi) => {
    this.#theta = theta;
    this.#phi = phi;
  }
}

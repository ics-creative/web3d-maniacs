import {ChannelPathType} from './GLTFLoader.js';
import {GLTFJoint} from './GLTFJoint.js';

const {vec3, vec4, quat, mat4} = glMatrix;

export class GLTFAnimator {
  /**
   * @public
   * @type {Float32Array}
   */
  skinningTransformMatrixArrayBuffer = undefined;

  /**
   * @public
   * @return {number}
   */
  get numJoints() {
    return this.#jointList.length;
  }

  /**
   * @public
   * @return {boolean}
   */
  get isPlaying() {
    return this.#isPlaying;
  }

  /**
   * @public
   * @return {string}
   */
  get playingAnimationName() {
    return this.#playingAnimation?.name || "";
  }

  /**
   * @public
   * @return {number}
   */
  get playingAnimationDurationSecond() {
    return this.#playingAnimation?.maxInput || 0.0;
  }

  /**
   * @public
   * @return {number}
   */
  get elapsedTimeSecond() {
    return this.#elapsedTimeSecond;
  }

  /**
   * @private
   * @type {GLTFAnimationData | null}
   */
  #playingAnimation = undefined;

  /**
   * @private
   * @type {boolean}
   */
  #isPlaying = false;

  /**
   * @private
   * @type {boolean}
   */
  #isLoop = false;

  /**
   * @private
   * @type {number}
   */
  #startTimeMS = 0.0;

  /**
   * @private
   * @type {number}
   */
  #pauseTimeMS = 0.0;

  /**
   * @private
   * @type {number}
   */
  #elapsedTimeSecond = 0.0;

  /**
   * @private
   * @type {GLTFAnimationData[]}
   */
  #animationList = null;

  /**
   * @private
   * @type {GLTFJoint[]}
   */
  #jointList = null;

  /**
   * @public
   * @param {GLTFData} data
   */
  constructor(data) {
    this.#animationList = data.animations;
    const animationLength = data.animations.length;
    for (let i = 0; i < animationLength; i++) {
      const channels = data.animations[i].channels;
      const channelLength = channels.length;
      for (let j = 0; j < channelLength; j++) {
        const channel = channels[j];
        switch (channel.path) {
          case ChannelPathType.translation:
          case ChannelPathType.scale:
            channel.outputComponents = [];
            for (let k = 0; k < channel.length; k++) {
              channel.outputComponents[k] = new Float32Array(channel.output.buffer, channel.output.byteOffset + 3 * Float32Array.BYTES_PER_ELEMENT * k, 3);
            }
            break;
          case ChannelPathType.rotation:
            channel.outputComponents = [];
            for (let k = 0; k < channel.length; k++) {
              channel.outputComponents[k] = new Float32Array(channel.output.buffer, channel.output.byteOffset + 4 * Float32Array.BYTES_PER_ELEMENT * k, 4);
            }
            break;
          default:
            break;
        }
      }
    }

    const jointLength = data.joints.length;
    this.#jointList = [];
    this.skinningTransformMatrixArrayBuffer = new Float32Array(16 * jointLength);
    const mat = mat4.create();
    const transformationDefault = vec3.fromValues(0, 0, 0);
    const rotationDefault = vec4.fromValues(0, 0, 0, 1);
    const scaleDefault = vec3.fromValues(1, 1, 1);
    for (let i = 0; i < jointLength; i++) {
      // const node = data.joints[i].node;
      // if (node.matrix) {
      //   mat.set(node.matrix, 0);
      // } else {
      //   mat4.fromRotationTranslationScale(mat, node.rotation || rotationDefault, node.translation || transformationDefault, node.scale || scaleDefault);
      // }
      this.skinningTransformMatrixArrayBuffer.set(mat, 16 * i);
      this.#jointList[i] = new GLTFJoint(data.joints[i].inverseBindMatrix, new Float32Array(this.skinningTransformMatrixArrayBuffer.buffer, this.skinningTransformMatrixArrayBuffer.byteOffset + 16 * Float32Array.BYTES_PER_ELEMENT * i, 16));
    }

    for (let i = 0; i < jointLength; i++) {
      const childLength = data.joints[i].jointChildren.length;
      for (let j = 0; j < childLength; j++) {
        this.#jointList[i].addChild(this.#jointList[data.joints[i].jointChildren[j]]);
      }
    }
  }

  /**
   * @public
   * @param {number} animationIndex
   * @param {boolean} isLoop
   */
  playByIndex = (animationIndex, isLoop = false) => {
    if (this.#animationList.length > animationIndex) {
      this.#playAnimation(this.#animationList[animationIndex], isLoop);
    }
  }

  /**
   * @public
   * @param {string} animationName
   * @param {boolean} isLoop
   */
  playByName = (animationName, isLoop = false) => {
    const animation = this.#animationList.find((data) => data.name === animationName);
    this.#playAnimation(animation, isLoop);
  }

  /**
   * @public
   */
  pause = () => {
    if (!this.#playingAnimation || !this.#isPlaying) {
      return;
    }

    this.#isPlaying = false;
    this.#pauseTimeMS = Date.now();
  }

  /**
   * @public
   */
  resume = () => {
    if (!this.#playingAnimation || this.#isPlaying) {
      return;
    }

    this.#isPlaying = true;
    this.#startTimeMS += (Date.now() - this.#pauseTimeMS);
  }

  /**
   * @public
   * @param {number} timeSecond
   * @param {boolean} isUpdateSkinning
   */
  setTimeSecond = (timeSecond, isUpdateSkinning = true) => {
    if (!this.#playingAnimation) {
      return;
    }

    const durationSecond = this.#playingAnimation.maxInput;
    if (timeSecond < 0) {
      timeSecond = 0;
    } else if (timeSecond > durationSecond) {
      timeSecond = durationSecond;
    }

    this.#startTimeMS -= (timeSecond - this.#elapsedTimeSecond) * 1000;
    this.#elapsedTimeSecond = timeSecond;

    if (isUpdateSkinning) {
      this.#updateSkinning();
    }
  }

  /**
   * @public
   */
  update = () => {
    if (!this.#playingAnimation || !this.#isPlaying) {
      return;
    }

    this.#elapsedTimeSecond = (Date.now() - this.#startTimeMS) / 1000

    this.#updateSkinning();

    if (this.#elapsedTimeSecond >= this.#playingAnimation.maxInput) {
      // console.log(`completed:${this.#playingAnimation.name}`);
      if (this.#isLoop) {
        this.#startTimeMS = Date.now();
      } else {
        this.#isPlaying = false;
        this.#playingAnimation = null;
      }
    }
  }

  /**
   * @private
   */
  #updateSkinning = () => {
    if (!this.#playingAnimation) {
      return;
    }

    const channels = this.#playingAnimation.channels;
    const length = channels.length;

    for (let i = 0; i < length; i++) {
      const channel = channels[i];
      const inputLength = channel.length;
      let timeIndex = -1;
      for (let j = 0; j < inputLength; j++) {
        const inputTime = channel.input[j];
        if (inputTime >= this.#elapsedTimeSecond) {
          timeIndex = j;
          break;
        }
      }

      if (timeIndex < 0) {
        break;
      }

      let timePercent = 0.0;
      if (timeIndex === 0) {
        timeIndex = 1;
      } else {
        timePercent = (this.#elapsedTimeSecond - channel.input[timeIndex - 1]) / (channel.input[timeIndex] - channel.input[timeIndex - 1]);
      }

      const joint = this.#jointList[channel.target];
      if (!joint) {
        continue;
      }
      switch (channel.path) {
        case ChannelPathType.translation: {
          const outputComponents = channel.outputComponents;
          vec3.lerp(joint.translate, outputComponents[timeIndex - 1], outputComponents[timeIndex], timePercent);
          joint.localTransformMatrixDirty = true;
          break;
        }
        case ChannelPathType.rotation: {
          const outputComponents = channel.outputComponents;
          quat.slerp(joint.rotate, outputComponents[timeIndex - 1], outputComponents[timeIndex], timePercent);
          joint.localTransformMatrixDirty = true;
          break;
        }
        case ChannelPathType.scale: {
          const outputComponents = channel.outputComponents;
          vec3.lerp(joint.scale, outputComponents[timeIndex - 1], outputComponents[timeIndex], timePercent);
          joint.localTransformMatrixDirty = true;
          break;
        }
        default:
          break;
      }
    }

    const jointLength = this.#jointList.length;
    for (let i = 0; i < jointLength; i++) {
      this.#jointList[i].globalTransformMatrixDirty = true;
    }
    for (let i = 0; i < jointLength; i++) {
      this.#jointList[i].getSkinningTransformMatrix();
    }
  }

  /**
   * @private
   * @param {GLTFAnimationData | null} animation
   * @param {boolean} isLoop
   */
  #playAnimation = (animation, isLoop = false) => {
    if (animation) {
      this.#playingAnimation = animation;
      this.#isLoop = isLoop;
      this.#startTimeMS = Date.now();
      this.#elapsedTimeSecond = 0.0;
      this.#isPlaying = true;
    }
  }
}

/**
 * @typedef {GLTFAnimationChannelData & Vec3ChannelData} GLTFAnimationChannelVec3Data
 *
 * @typedef {Object} Vec3ChannelData
 * @property {Float32Array[]} outputComponents
 */

/**
 * @typedef {GLTFAnimationChannelData & QuatChannelData} GLTFAnimationChannelQuatData
 *
 * @typedef {Object} QuatChannelData
 * @property {Float32Array[]} outputComponents
 */

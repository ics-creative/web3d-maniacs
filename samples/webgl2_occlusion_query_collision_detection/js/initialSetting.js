import {decode, encode} from "./util/arrayBufferTobase64.js";

/**
 * @public
 * @param {InitialSetting} setting
 * @return {string}
 */
export const save = (setting) => {
  const data = new ArrayBuffer(5 * Float64Array.BYTES_PER_ELEMENT + 8 * Int8Array.BYTES_PER_ELEMENT);
  const f64 = new Float64Array(data, 0, 5);
  const i8 = new Int8Array(data, 5 * Float64Array.BYTES_PER_ELEMENT, 8);
  f64[0] = setting.radius;
  f64[1] = setting.theta;
  f64[2] = setting.phi;
  f64[3] = setting.modelSetList[0].time;
  f64[4] = setting.modelSetList[1].time;
  i8.set(setting.modelSetList.map((model) => [model.isPlaying, model.x, model.y, model.z]).flat());

  return "#" + encode(data);
}

/**
 * @public
 * @param {string} hashString
 * @return {InitialSetting || null}
 */
export const load = (hashString) => {
  if (hashString) {
    try {
      const data = decode(hashString.substring(1));
      const f64 = new Float64Array(data, 0, 5);
      const i8 = new Int8Array(data, 5 * Float64Array.BYTES_PER_ELEMENT, 8);
      return {
        radius: f64[0],
        theta: f64[1],
        phi: f64[2],
        modelSetList: [0, 1].map((id) => {
          const offset = id * 4;
          return {
            time: f64[3 + id],
            isPlaying: i8[offset] === 1,
            x: i8[offset + 1],
            y: i8[offset + 2],
            z: i8[offset + 3]
          }
        })
      };
    } catch (error) {
      console.log(error);
    }
  }
  return null;
}

/**
 * @typedef {Object} InitialModelSetting
 *
 * @property {number} time
 * @property {boolean} isPlaying
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */

/**
 * @typedef {Object} InitialSetting
 *
 * @property {number} radius
 * @property {number} theta
 * @property {number} phi
 * @property {InitialModelSetting[]} modelSetList
 */
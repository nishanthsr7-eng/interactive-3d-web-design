/**
 * Full-screen pass whose distortion is driven by scroll velocity.
 *
 * At rest it is a straight pass-through. As the page moves it adds chromatic
 * separation along the scroll axis, a barrel pinch toward the centre, and a
 * short directional smear — so fast scrolling feels physical rather than free.
 */

export const VelocityWarpShader = {
  name: 'VelocityWarpShader',

  uniforms: {
    tDiffuse: { value: null },
    uVelocity: { value: 0 },
    uIntensity: { value: 0 },
    uTime: { value: 0 },
  },

  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uVelocity;
    uniform float uIntensity;
    uniform float uTime;
    varying vec2 vUv;

    void main() {
      float amt = clamp(uIntensity, 0.0, 1.0);

      // Nothing to do when the page is still.
      if (amt < 0.001) {
        gl_FragColor = texture2D(tDiffuse, vUv);
        return;
      }

      vec2 centred = vUv - 0.5;
      float r2 = dot(centred, centred);

      // Barrel pinch grows with speed.
      vec2 warped = centred * (1.0 + r2 * amt * 0.30);

      // Chromatic separation along the vertical (scroll) axis.
      float shift = uVelocity * 0.016;
      vec2 uvR = warped + vec2(0.0,  shift) + 0.5;
      vec2 uvG = warped + 0.5;
      vec2 uvB = warped - vec2(0.0,  shift) + 0.5;

      // Short directional smear, cheap 5-tap.
      vec3 sum = vec3(0.0);
      float smear = uVelocity * 0.010;
      for (int i = 0; i < 5; i++) {
        float f = (float(i) - 2.0) / 2.0;
        vec2 off = vec2(0.0, smear * f);
        sum.r += texture2D(tDiffuse, uvR + off).r;
        sum.g += texture2D(tDiffuse, uvG + off).g;
        sum.b += texture2D(tDiffuse, uvB + off).b;
      }
      vec3 col = sum / 5.0;

      // A touch of vignette while moving keeps the edges from tearing visually.
      col *= 1.0 - r2 * amt * 0.35;

      gl_FragColor = vec4(col, texture2D(tDiffuse, vUv).a);
    }
  `,
};

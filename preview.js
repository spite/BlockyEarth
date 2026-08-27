import {
  Box3,
  Group,
  Mesh,
  RawShaderMaterial,
  TubeGeometry,
  IcosahedronBufferGeometry,
  Color,
  GLSL3,
} from "three";

const vertexShader = `precision highp float;

in vec3 position;
in vec3 normal;

uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 modelMatrix;
uniform mat3 normalMatrix;
uniform vec3 lightPos;
uniform mat4 shadowViewMatrix;
uniform mat4 shadowProjectionMatrix;
uniform float shadowNormalBias;

out vec3 vPosition;
out vec3 vNormal;
out vec3 lDir;
out vec4 vShadowCoord;

const mat4 biasMatrix = mat4(
  0.5, 0.0, 0.0, 0.0,
  0.0, 0.5, 0.0, 0.0,
  0.0, 0.0, 0.5, 0.0,
  0.5, 0.5, 0.5, 1.0
);

void main() {
  lDir = normalMatrix * normalize(lightPos);
  vec4 mv = modelViewMatrix * vec4(position, 1.);
  vPosition = mv.xyz;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mv;

  vec4 world = modelMatrix * vec4(position, 1.);
  vec3 worldNormal = normalize(mat3(modelMatrix) * normal);
  vec4 shadowPos = world + vec4(worldNormal * shadowNormalBias, 0.);
  vShadowCoord = biasMatrix * shadowProjectionMatrix * shadowViewMatrix * shadowPos;
}`;

const fragmentShader = `precision highp float;

uniform vec3 color;
uniform float near;
uniform float far;
uniform sampler2D shadowMap;
uniform float sampleIndex;

in vec3 vPosition;
in vec3 vNormal;
in vec3 lDir;
in vec4 vShadowCoord;

layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outPosition;
layout(location = 2) out vec4 outNormal;

const float bias = 0.0002;

float linearizeDepth(float z) {
  return (2.0 * near) / (far + near - z * (far - near));
}

float random(vec2 n) {
  return fract(sin(dot(n.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

float unpackDepth(const in vec4 rgba_depth) {
  const vec4 bit_shift = vec4(1.0/(256.0*256.0*256.0), 1.0/(256.0*256.0), 1.0/256.0, 1.0);
  return dot(rgba_depth, bit_shift);
}

float sampleVisibility(vec3 coord) {
  float depth = unpackDepth(texture(shadowMap, coord.xy));
  return step(coord.z, depth + bias);
}

void main() {
  vec3 n = normalize(vNormal);
  vec3 ld = normalize(lDir);
  float diffuse = max(0., dot(n, ld));

  vec2 shadowResolution = vec2(textureSize(shadowMap, 0));
  vec3 shadowCoord = vShadowCoord.xyz / vShadowCoord.w;
  float shadow = 1.;
  if (diffuse > 0. && shadowCoord.x >= 0. && shadowCoord.x <= 1. &&
      shadowCoord.y >= 0. && shadowCoord.y <= 1. && shadowCoord.z <= 1.) {
    vec2 jitterTable[8];
    jitterTable[0] = vec2(0.5625, 0.4375);
    jitterTable[1] = vec2(0.0625, 0.9375);
    jitterTable[2] = vec2(0.3125, 0.6875);
    jitterTable[3] = vec2(0.6875, 0.8124);
    jitterTable[4] = vec2(0.8125, 0.1875);
    jitterTable[5] = vec2(0.9375, 0.5625);
    jitterTable[6] = vec2(0.4375, 0.0625);
    jitterTable[7] = vec2(0.1875, 0.3125);

    float ang = random(gl_FragCoord.xy + vec2(sampleIndex * 17.13)) * 6.2831853;
    float cs = cos(ang);
    float sn = sin(ang);
    mat2 rot = mat2(cs, -sn, sn, cs);
    shadow = 0.;
    for (int i = 0; i < 8; i++) {
      vec2 tap = rot * (jitterTable[i] - 0.5) * 4.0 / shadowResolution;
      shadow += sampleVisibility(shadowCoord + vec3(tap, 0.));
    }
    shadow /= 8.;
  }

  float lit = .55 + .45 * diffuse * shadow;
  outColor = vec4(color * lit, 1.);
  outPosition = vec4(vPosition, linearizeDepth(length(vPosition)));
  outNormal = vec4(n, 1.);
}`;

const depthVertexShader = `precision highp float;

in vec3 position;
uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;

void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
}`;

const depthFragmentShader = `precision highp float;

out vec4 depth;

vec4 packDepth(const in float depth) {
  const vec4 bit_shift = vec4(256.0*256.0*256.0, 256.0*256.0, 256.0, 1.0);
  const vec4 bit_mask  = vec4(0.0, 1.0/256.0, 1.0/256.0, 1.0/256.0);
  vec4 res = mod(depth*bit_shift*vec4(255), vec4(256))/vec4(255);
  res -= res.xxyz * bit_mask;
  return res;
}

void main() {
  depth = packDepth(gl_FragCoord.z);
}`;

class PathPreview {
  constructor(ssao, { radius = 0.042, spotRadius = 0.15, segments = 400 } = {}) {
    this.group = new Group();
    this.group.visible = false;
    this.radius = radius;
    this.spotRadius = spotRadius;
    this.segments = segments;
    this.box = new Box3();

    const shared = ssao.shadowUniforms;
    this.material = new RawShaderMaterial({
      uniforms: {
        color: { value: new Color(0x0f5ea2) },
        near: shared.near,
        far: shared.far,
        lightPos: shared.lightPos,
        shadowMap: shared.shadowMap,
        shadowViewMatrix: shared.shadowViewMatrix,
        shadowProjectionMatrix: shared.shadowProjectionMatrix,
        shadowNormalBias: shared.shadowNormalBias,
        sampleIndex: shared.sampleIndex,
      },
      vertexShader,
      fragmentShader,
      glslVersion: GLSL3,
    });

    this.depthMaterial = new RawShaderMaterial({
      vertexShader: depthVertexShader,
      fragmentShader: depthFragmentShader,
      glslVersion: GLSL3,
    });

    this.tube = null;
    this.spotGeometry = new IcosahedronBufferGeometry(spotRadius, 2);
    this.spots = [];
  }

  get visible() {
    return this.group.visible;
  }

  add(mesh) {
    mesh.userData.depthMaterial = this.depthMaterial;
    this.group.add(mesh);
    return mesh;
  }

  bounds() {
    this.box.makeEmpty();
    if (this.group.visible && this.tube) this.box.setFromObject(this.group);
    return this.box;
  }

  clear() {
    if (this.tube) {
      this.group.remove(this.tube);
      this.tube.geometry.dispose();
      this.tube = null;
    }
    for (const spot of this.spots) this.group.remove(spot);
    this.spots.length = 0;
  }

  show(path, spots = []) {
    this.clear();
    if (!path) {
      this.group.visible = false;
      return false;
    }

    this.tube = this.add(
      new Mesh(
        new TubeGeometry(path, this.segments, this.radius, 8, true),
        this.material
      )
    );

    for (const p of spots) {
      const marker = this.add(new Mesh(this.spotGeometry, this.material));
      marker.position.copy(p);
      this.spots.push(marker);
    }

    this.group.visible = true;
    return true;
  }

  hide() {
    this.clear();
    this.group.visible = false;
  }

  dispose() {
    this.clear();
    this.spotGeometry.dispose();
    this.material.dispose();
    this.depthMaterial.dispose();
  }
}

export { PathPreview };

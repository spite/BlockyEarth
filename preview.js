import {
  Group,
  Mesh,
  RawShaderMaterial,
  TubeGeometry,
  IcosahedronBufferGeometry,
  Vector3,
  Color,
  GLSL3,
} from "three";

const vertexShader = `precision highp float;

in vec3 position;
in vec3 normal;

uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
uniform mat3 normalMatrix;

out vec3 vPosition;
out vec3 vNormal;

void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.);
  vPosition = mv.xyz;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mv;
}`;

const fragmentShader = `precision highp float;

uniform vec3 color;
uniform float near;
uniform float far;

in vec3 vPosition;
in vec3 vNormal;

layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outPosition;
layout(location = 2) out vec4 outNormal;

float linearizeDepth(float z) {
  return (2.0 * near) / (far + near - z * (far - near));
}

void main() {
  vec3 n = normalize(vNormal);
  float shade = .6 + .4 * max(dot(n, normalize(vec3(.4, 1., .3))), 0.);
  outColor = vec4(color * shade, 1.);
  outPosition = vec4(vPosition, linearizeDepth(length(vPosition)));
  outNormal = vec4(n, 1.);
}`;

class PathPreview {
  constructor({ radius = 0.042, spotRadius = 0.15, segments = 400 } = {}) {
    this.group = new Group();
    this.group.visible = false;
    this.group.userData.noShadow = true;
    this.radius = radius;
    this.spotRadius = spotRadius;
    this.segments = segments;

    this.material = new RawShaderMaterial({
      uniforms: {
        color: { value: new Color(0x0f5ea2) },
        near: { value: 0.01 },
        far: { value: 1000 },
      },
      vertexShader,
      fragmentShader,
      glslVersion: GLSL3,
    });

    this.tube = null;
    this.spotGeometry = new IcosahedronBufferGeometry(spotRadius, 2);
    this.spots = [];
  }

  get visible() {
    return this.group.visible;
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

  show(path, spots = [], camera) {
    this.clear();
    if (!path) {
      this.group.visible = false;
      return false;
    }
    if (camera) {
      this.material.uniforms.near.value = camera.near;
      this.material.uniforms.far.value = camera.far;
    }

    this.tube = new Mesh(
      new TubeGeometry(path, this.segments, this.radius, 8, true),
      this.material
    );
    this.group.add(this.tube);

    for (const p of spots) {
      const marker = new Mesh(this.spotGeometry, this.material);
      marker.position.copy(p);
      this.group.add(marker);
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
  }
}

export { PathPreview };

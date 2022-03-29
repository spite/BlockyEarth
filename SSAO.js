import { ShaderPass } from "./modules/ShaderPass.js";
import {
  GLSL3,
  RawShaderMaterial,
  WebGLMultipleRenderTargets,
  NearestFilter,
  FloatType,
  Scene,
  Mesh,
  Vector2,
  PlaneBufferGeometry,
  OrthographicCamera,
  TextureLoader,
} from "./third_party/three.module.js";
import { shader as orthoVs } from "./shaders/ortho.js";
import { shader as hsl } from "./shaders/hsl.js";
import { shader as screen } from "./shaders/screen.js";

const vertexShader = `precision highp float;

in vec3 position;
in vec3 normal;
in mat4 instanceMatrix;
in vec3 instanceColor;
in float height;

uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
uniform mat3 normalMatrix;
uniform mat4 modelMatrix;

uniform float time;
uniform float factor;
uniform float blockiness;

out vec4 vEyePosition;
out vec3 vPosition;
out vec3 vColor;
out vec3 lDir;
out vec4 vMPosition;
out vec3 vNormal;

void main() {
  lDir = normalize(vec3(1.));
  vec4 p = instanceMatrix * vec4(0., 0., 0., 1.);
  vec2 vuv = p.xz;
  float h = height;
  vColor =  instanceColor;
  // h = round(h*blockiness)/blockiness;
  // h /= 5.;
  vec3 pp = position ;
  if(position.y < 0.) {
    pp.y = position.y;
  } else {
    pp.y = position.y + h;
  }
  vNormal = normal;
  vec4 fPos = instanceMatrix * vec4(pp, 1.0);
  vMPosition = modelMatrix * fPos;
  vec4 mvPosition = modelViewMatrix * fPos;
  vEyePosition = mvPosition;
  vPosition = mvPosition.xyz / mvPosition.w;
  gl_Position = projectionMatrix * mvPosition;
}`;

const fragmentShader = `precision highp float;

layout(location = 0) out vec4 color;
layout(location = 1) out vec4 position;
layout(location = 2) out vec4 normal;

uniform float near;
uniform float far;
uniform sampler2D matcap;
uniform samplerCube envMap;
uniform mat3 normalMatrix;
uniform vec3 cameraPosition;

in vec4 vEyePosition;
in vec3 vPosition;
in vec3 lDir;
in vec3 vColor;
in vec4 vMPosition;
in vec3 vNormal;

float linearizeDepth(float z) {
  return (2.0 * near) / (far + near - z * (far - near));	
}

${hsl}

vec2 matCapUV(in vec3 eye, in vec3 normal) {
  vec3 r = reflect(eye, normal);
  float m = 2.82842712474619 * sqrt(r.z + 1.0);
  vec2 vN = r.xy / m + .5;
  return vN;
}

void main() {
  vec3 X = dFdx(vPosition);
  vec3 Y = dFdy(vPosition);
  vec3 n = normalize(cross(X,Y));

  float diffuse = max(0., dot(n, lDir));
  float level = vColor.x;

  vec3 e = normalize(-vPosition.xyz);
  vec3 h = normalize(lDir + e);
  float specular = pow(max(dot(n, h), 0.), 20.);

  // vec3 t = normalize(vMPosition.xyz - cameraPosition);
  // vec3 refl = normalize(reflect(t, n));
  // vec4 c1 = texture(envMap, refl, 5.);
  // vec4 c2 = texture(envMap, vNormal, 10.);
  // specular = c1.r;
  // diffuse = c2.r;

  vec3 c = vColor;
  vec3 modColor = rgb2hsv(c);
  modColor.z += .2 * diffuse;
  modColor.z += .2 * specular;
  modColor.z = clamp(modColor.z, 0., 1.);
  modColor = hsv2rgb(modColor);

  // modColor = vec3(diffuse + specular);
  // modColor = mix(modColor, vec3(1.,1.,1.), specular);

  // modColor *= texture(matcap, matCapUV(normalize(vEyePosition.xyz), normalize( n))).rrr;

  // modColor.rgb *= c1.r;
  color = vec4(modColor , 1.);//vec4(diffuse);//vec4(vec3(.75 + diffuse), 1.);
  // color = vec4(vec3(diffuse + specular), 1.);
  // color = vec4(vNormal, 1.);
  // color = vec4(vec3(max(diffuse, specular)), 1.);
  float d = linearizeDepth(length( vPosition ));
  position = vec4(vPosition, d);
  normal = vec4(n, 1.);
}
`;

const ssaoFs = `precision highp float;

uniform sampler2D colorMap; 
uniform sampler2D positionMap;
uniform sampler2D normalMap;
uniform float bias;
uniform float radius;
uniform vec2 attenuation;
uniform float time;

in vec2 vUv;

out vec4 fragColor;

float sampleBuffer( vec3 position, vec3 normal, vec2 uv) {

  vec3 samplePosition = texture(positionMap, uv ).xyz;

  vec3 dir = samplePosition - position;
  float intensity = max( dot( normalize( dir ), normal ) - bias, 0.0 );

  float dist = length( dir );
  float factor = 1.0 / ( attenuation.x + ( attenuation.y * dist ) );

  return intensity * factor;
}

float random(vec2 n, float offset ){
	return .5 - fract(sin(dot(n.xy + vec2( offset, 0. ), vec2(12.9898, 78.233)))* 43758.5453);
}

#define M_PI 3.1415926535897932384626433832795

${hsl}

${screen}

vec3 czm_saturation(vec3 rgb, float adjustment)
{
    // Algorithm from Chapter 16 of OpenGL Shading Language
    const vec3 W = vec3(0.2125, 0.7154, 0.0721);
    vec3 intensity = vec3(dot(rgb, W));
    return mix(intensity, rgb, adjustment);
}

void main() {
  vec2 size = vec2(textureSize(colorMap, 0));
  vec2 inc = 1. / size;

  vec4 posDepth = texture(positionMap, vUv );
  vec3 position = posDepth.xyz;
  vec3 normal = normalize(texture(normalMap, vUv ).xyz);
  vec2 randVec = normalize( vec2( random( vUv, 1. ), random( vUv.yx, 1. ) ) );

  float depth = posDepth.w;

  float kRadius = radius * ( 1.0 - depth );

  vec4 acCol = vec4(0.);

  vec2 k[ 4 ];
  k[ 0 ] = vec2(  0.0,  1.0 );
  k[ 1 ] = vec2(  1.0,  0.0 );
  k[ 2 ] = vec2(  0.0, -1.0 );
  k[ 3 ] = vec2( -1.0,  0.0 );

  const float v = M_PI / 4.;

  float occlusion = 0.0;
  for( int i = 0; i < 4; ++i ){
    vec2 k1 = reflect( k[ i ], randVec );
    vec2 k2 = vec2( k1.x * v - k1.y * v, k1.x * v + k1.y * v );
    k1 *= inc;
    k2 *= inc;

    occlusion += sampleBuffer( position, normal, vUv + k1 * kRadius );
    occlusion += sampleBuffer( position, normal, vUv + k2 * kRadius * 0.75 );
    occlusion += sampleBuffer( position, normal, vUv + k1 * kRadius * 0.5 );
    occlusion += sampleBuffer( position, normal, vUv + k2 * kRadius * 0.25 );

    float s = 1.;
    acCol += texture(colorMap, vUv + s * k1 * kRadius );
    acCol += texture(colorMap, vUv + s * k2 * kRadius * 0.75 );
    acCol += texture(colorMap, vUv + s * k1 * kRadius * 0.5 );
    acCol += texture(colorMap, vUv + s * k2 * kRadius * 0.25 );
  }

  occlusion /= 16.0;
  occlusion = clamp( occlusion, 0.0, 1.0 );

  acCol /= 16.;

  vec4 color = texture(colorMap, vUv);
  color.rgb = screen(color.rgb, acCol.rgb, .1);
	vec3 hsl = rgb2hsv(color.rgb);
	hsl.z *=  (1.-occlusion);
	hsl.y *= .5 + .5 * (1.-occlusion);
  hsl.z = clamp(hsl.z, 0., 1.);
  hsl.y = clamp(hsl.t, 0., 1.);
	vec3 finalColor = czm_saturation(hsv2rgb(hsl), 1.5 + occlusion);
  // vec4 finalColor = color;

	fragColor = vec4(finalColor.rgb, color.a);
  
}`;

const loader = new TextureLoader();
// const matcap = loader.load("./assets/matcap-sky.png");
const matcap = loader.load("./assets/plastic-red.jpg");

class SSAO {
  constructor() {
    this.renderTarget = new WebGLMultipleRenderTargets(1, 1, 3);
    for (const texture of this.renderTarget.texture) {
      texture.minFilter = NearestFilter;
      texture.magFilter = NearestFilter;
      texture.type = FloatType;
    }

    this.shader = new RawShaderMaterial({
      uniforms: {
        far: { value: 0 },
        near: { value: 0 },
        envMap: { value: null },
        matcap: { value: matcap },
        factor: { value: 0 },
        time: { value: 0 },
        blockiness: { value: 100 },
      },
      vertexShader,
      fragmentShader,
      glslVersion: GLSL3,
    });
    this.scene = new Scene();
    this.camera = new OrthographicCamera(
      1 / -2,
      1 / 2,
      1 / 2,
      1 / -2,
      0.00001,
      1000
    );
    this.quad = new Mesh(new PlaneBufferGeometry(1, 1), this.shader);
    this.quad.scale.set(1, 1, 1);
    this.scene.add(this.quad);

    this.color = this.renderTarget.texture[0];
    this.positions = this.renderTarget.texture[1];
    this.normals = this.renderTarget.texture[2];

    const s = 2;

    this.ssaoShader = new RawShaderMaterial({
      uniforms: {
        colorMap: { value: this.color },
        positionMap: { value: this.positions },
        normalMap: { value: this.normals },
        bias: { value: 0.05 },
        radius: { value: 20 },
        attenuation: { value: new Vector2(0.5, 5).multiplyScalar(s) },
        time: { value: 0 },
      },
      vertexShader: orthoVs,
      fragmentShader: ssaoFs,
      glslVersion: GLSL3,
    });
    this.pass = new ShaderPass(this.ssaoShader, {});
  }

  setSize(width, height, dpr) {
    const w = width * dpr;
    const h = height * dpr;
    this.renderTarget.setSize(w, h);
    this.quad.scale.set(w, h, 1);
    this.camera.left = -w / 2;
    this.camera.right = w / 2;
    this.camera.top = h / 2;
    this.camera.bottom = -h / 2;
    this.camera.updateProjectionMatrix();
    this.pass.setSize(w, h);
  }

  get output() {
    return this.pass.texture;
  }

  render(renderer, scene, camera) {
    this.shader.uniforms.near.value = 0; //camera.near;
    this.shader.uniforms.far.value = camera.far;

    renderer.setRenderTarget(this.renderTarget);
    scene.overrideMaterial = this.shader;
    renderer.render(scene, camera);
    scene.overrideMaterial = null;
    renderer.setRenderTarget(null);

    this.pass.render(renderer, true);
  }
}

export { SSAO };

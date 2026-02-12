import { Preprocessor, Lexer } from '@/index';

const code = `@group(0) @binding(0) var<uniform> u_projectionMatrix: mat4x4<f32>;
@group(0) @binding(1) var<uniform> u_modelViewMatrix: mat4x4<f32>;

struct VertexInput {
  @location(0) a_position: vec4<f32>,
#ifdef USE_TEXTURE
  @location(1) a_uv: vec2<f32>,
#endif
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
#ifdef USE_TEXTURE
  @location(0) v_uv: vec2<f32>,
#endif
};

@vertex
fn main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
#ifdef USE_TEXTURE
  output.v_uv = vec2<f32>(input.a_uv.x, 1 - input.a_uv.y);
#endif

  output.position = u_projectionMatrix * u_modelViewMatrix * input.a_position;
  return output;
}
`;

const preprocessor = new Preprocessor(code, {
  alias: {
    define: '#define',
    ifdef: '#ifdef',
    ifndef: '#ifndef',
    if: '#if',
    else: '#else',
    endif: '#endif',
    elifdef: '#elifdef',
    elifndef: '#elifndef',
    elif: '#elif',
  },
});

const { code: processedCode } = preprocessor.process();
console.log(processedCode);

const { tokens, errors } = new Lexer(processedCode).tokenize();
for (let i = 0; i < errors.length; i += 1) {
  console.log(errors[i].message);
}
for (let i = 0; i < tokens.length; i += 1) {
  console.log(tokens[i].type, tokens[i].value);
}
console.log('tokens length:', tokens.length);

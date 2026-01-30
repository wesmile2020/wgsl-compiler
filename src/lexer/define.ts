/** @type { TokenType.SYNTAX_KEYWORD } */
export const SYNTAX_KEYWORDS: string[] = [
  'fn', 'let', 'var', 'const', 'override',
  'if', 'else', 'loop', 'for', 'while', 'break', 'continue', 'return',
  'switch', 'case', 'default', 'continuing', 'discard',
  'private', 'workgroup', 'uniform', 'storage', 'function',
  'read', 'write', 'read_write',
  'struct', 'true', 'false',
];

/** @type { TokenType.TYPE_KEYWORD } */
export const TYPE_KEYWORDS: string[] = [
  'i32', 'u32', 'f32', 'f16', 'bool',
  'vec2', 'vec3', 'vec4',
  'mat2x2', 'mat2x3', 'mat2x4', 'mat3x2', 'mat3x3', 'mat3x4',
  'mat4x2', 'mat4x3', 'mat4x4',
  'atomic',
  'ptr',
  'array',
  'sampler', 'sampler_comparison',
  'texture_1d', 'texture_2d', 'texture_2d_array', 'texture_3d',
  'texture_cube', 'texture_cube_array', 'texture_multisampled_2d',
  'texture_storage_1d', 'texture_storage_2d', 'texture_storage_2d_array',
  'texture_storage_3d', 'texture_depth_2d', 'texture_depth_2d_array',
  'texture_depth_cube', 'texture_depth_cube_array'
];

/** @type { TokenType.BUILTIN_FUNCTION } */
export const BUILTIN_FUNCTIONS: string[] = [
  'radians', 'degrees', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
  'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh',
  'exp', 'exp2', 'log', 'log2', 'pow',
  'dot', 'cross', 'length', 'distance', 'normalize', 'faceForward',
  'reflect', 'refract',
  'transpose', 'determinant', 'inverse',
  'abs', 'sign', 'floor', 'ceil', 'round', 'trunc', 'fract', 'mod',
  'min', 'max', 'clamp', 'mix', 'step', 'smoothstep',
  'frexp', 'ldexp', 'modf',
  'countLeadingZeros', 'countTrailingZeros', 'populationCount',
  'reverseBits',
  'pack4x8snorm', 'pack4x8unorm', 'pack2x16snorm', 'pack2x16unorm',
  'pack2x16float', 'unpack4x8snorm', 'unpack4x8unorm',
  'unpack2x16snorm', 'unpack2x16unorm', 'unpack2x16float',
  'textureDimensions', 'textureNumLayers', 'textureNumLevels',
  'textureLoad', 'textureStore', 'textureSample',
  'textureSampleBias', 'textureSampleLevel', 'textureSampleGrad',
  'textureSampleCompare', 'textureSampleCompareLevel',
  'textureGather', 'textureGatherCompare',
  'atomicLoad', 'atomicStore', 'atomicAdd', 'atomicSub',
  'atomicMax', 'atomicMin', 'atomicAnd', 'atomicOr', 'atomicXor',
  'dpdx', 'dpdy', 'fwidth', 'dpdxCoarse', 'dpdyCoarse', 'fwidthCoarse',
  'dpdxFine', 'dpdyFine', 'fwidthFine',
  'select', 'all', 'any',
];

/** @type { TokenType.BUILTIN_VALUE } */
export const BUILTIN_VALUES: string[] = [
  'vertex_index', 'instance_index', 'position', 'front_facing',
  'frag_depth', 'local_invocation_id', 'local_invocation_index',
  'global_invocation_id', 'workgroup_id', 'num_workgroups',
  'sample_index', 'sample_mask', 'subgroup_invocation_id',
  'subgroup_size'
];

/** @type { TokenType.ATTRIBUTE } */
export const ATTRIBUTES: string[] = [
  'vertex', 'fragment', 'compute',
  'group', 'binding', 'location',
  'builtin', 'interpolate', 'invariant',
  'size', 'align', 'stride',
  'must_use', 'binding_array', 'blend_src', 'color',
  'compute_grid_size', 'id', 'input_attachment_index',
  'inner', 'outer', 'position', 'sample',
  'storage_class', 'type', 'workgroup_size'
];

/** @type { TokenType.OPERATOR } */
export const THREE_CHAR_OPERATORS: string[] = [
  '<<=', '>>=', '...',
];

/** @type { TokenType.OPERATOR } */
export const TWO_CHAR_OPERATORS: string[] = [
  '==', '!=', '<=', '>=', '&&', '||', '->', '::', '<<', '>>',
  '+=', '-=', '*=', '/=', '%=', '&=', '^=', '|=',
];

/** @type { TokenType.OPERATOR } */
export const OPERATOR_CHARS: string[] = [
  '=', '+', '-', '*', '/', '%', '!', '&', '|', '^', '~', '.', '?',
];

/** @type { TokenType.PUNCTUATION } */
export const PUNCTUATION_CHARS: string[] = [
  ',', ';', ':',
];

/** @type { TokenType.BRACKET } */
export const BRACKET_CHARS: string[] = [
  '(', ')', '[', ']', '{', '}', '<', '>',
];

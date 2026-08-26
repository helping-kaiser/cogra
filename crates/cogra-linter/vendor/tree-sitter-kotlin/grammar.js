/**
 * Kotlin grammar for tree-sitter.
 *
 * A first-party grammar for the CoGra corpus linter
 * (ARCH dec:linter:kotlin-tree-sitter), translated from the Kotlin
 * specification's own ANTLR grammar — KotlinParser.g4 and
 * KotlinLexer.g4 — and from no community grammar.
 *
 * Two structural departures from the ANTLR source, both forced by
 * tree-sitter's model and both language-preserving. They are argued in
 * PROGRESS.md:
 *
 *   1. The ANTLR grammar threads `NL*` through nearly every production
 *      and hides newlines inside `(...)`/`[...]` with a lexer mode.
 *      Here newlines are `extras` and statement ends arrive as the
 *      external `_automatic_semicolon`, which the parser only ever asks
 *      for where a statement may actually end.
 *
 *   2. Kotlin's block comments nest, which no regex token can express,
 *      so comments are external-scanner tokens.
 *
 * @see https://kotlinlang.org/spec/
 */

/// <reference types="tree-sitter-cli/dsl" />

const PREC = {
  ASSIGNMENT: 1,
  DISJUNCTION: 2,
  CONJUNCTION: 3,
  EQUALITY: 4,
  COMPARISON: 5,
  INFIX_OPERATION: 6,
  ELVIS: 7,
  INFIX_FUNCTION: 8,
  RANGE: 9,
  ADDITIVE: 10,
  MULTIPLICATIVE: 11,
  AS: 12,
  PREFIX: 13,
  POSTFIX: 14,
  TYPE_ARGUMENTS: 15,
};

/** Soft keywords: reserved in some positions, plain identifiers elsewhere.
 *  KotlinParser.g4 `simpleIdentifier` is exactly this set plus Identifier. */
const SOFT_KEYWORDS = [
  'abstract', 'annotation', 'by', 'catch', 'companion', 'constructor',
  'crossinline', 'data', 'dynamic', 'enum', 'external', 'final', 'finally',
  'get', 'import', 'infix', 'init', 'inline', 'inner', 'internal',
  'lateinit', 'noinline', 'open', 'operator', 'out', 'override', 'private',
  'protected', 'public', 'reified', 'sealed', 'tailrec', 'set', 'vararg',
  'where', 'field', 'property', 'receiver', 'param', 'setparam', 'delegate',
  'file', 'expect', 'actual', 'const', 'suspend', 'value',
];

/** Conflicts discovered while authoring, kept in a side file during
 *  iteration and folded into the list below once reviewed. Absent from a
 *  finished tree. */
let DISCOVERED = [];
try {
  DISCOVERED = require('./conflicts.json');
} catch (_) {
  DISCOVERED = [];
}

/** One or more `rule`, separated by `sep`. */
function sepBy1(sep, rule) {
  return seq(rule, repeat(seq(sep, rule)));
}

/** Zero or more `rule`, separated by `sep`. */
function sepBy(sep, rule) {
  return optional(sepBy1(sep, rule));
}

/** A comma-separated list permitting the trailing comma Kotlin allows
 *  in every one of these positions (KotlinParser.g4 `(NL* COMMA)?`). */
function commaSep1Trailing(rule) {
  return seq(sepBy1(',', rule), optional(','));
}

module.exports = grammar({
  name: 'kotlin',

  externals: $ => [
    $._automatic_semicolon,
    $.line_comment,
    $.block_comment,
    $.kdoc,
    $._raw_string_content,
    $._raw_string_end,
    // Never valid; its presence lets the scanner detect tree-sitter's
    // error-recovery mode, where every external token is marked valid.
    $._error_sentinel,
  ],

  extras: $ => [
    /[ \t\r\n\u000C\u000B\uFEFF]/,
    $.line_comment,
    $.block_comment,
    $.kdoc,
  ],

  word: $ => $._alpha_identifier,

  supertypes: $ => [
    $._declaration,
    $._expression,
    $._type_body,
    $._literal_constant,
  ],

  inline: $ => [
    $._top_level_object,
    $._semi,
  ],

  // Kotlin's modifiers are soft keywords: every one of them is also a
  // legal identifier (KotlinParser.g4 `simpleIdentifier` lists them all).
  // That makes `simple_identifier` genuinely ambiguous with each
  // modifier rule under LR(1), and the ambiguity is intended — it is
  // resolved by what follows, which is exactly what tree-sitter's GLR
  // conflict handling is for.
  conflicts: $ => [
    [$.simple_identifier, $.type_modifier],
    [$.simple_identifier, $.class_modifier],
    [$.simple_identifier, $.member_modifier],
    [$.simple_identifier, $.visibility_modifier],
    [$.simple_identifier, $.function_modifier],
    [$.simple_identifier, $.property_modifier],
    [$.simple_identifier, $.inheritance_modifier],
    [$.simple_identifier, $.parameter_modifier],
    [$.simple_identifier, $.platform_modifier],
    [$.simple_identifier, $.variance_modifier],
    [$.simple_identifier, $.reification_modifier],
    [$.simple_identifier, $.modifier],
    [$.simple_identifier, $.getter],
    [$.simple_identifier, $.setter],
    [$.simple_identifier, $.user_type],
    [$.simple_identifier, $.annotation_use_site_target],

    [$._type, $._expression],
    [$.nullable_type, $.type_reference],
    [$.receiver_type, $.type_reference],
    [$.receiver_type, $._type],
    [$.function_type_parameters, $.parenthesized_type],
    [$.function_type_parameters, $.value_arguments],
    [$.parenthesized_type, $.parenthesized_expression],
    [$.parenthesized_type, $.parenthesized_user_type],

    [$.class_parameter, $.simple_identifier],
    [$.variable_declaration, $.simple_identifier],
    [$.parameter, $.simple_identifier],
    [$.modifiers, $.annotated_lambda],
    [$.lambda_parameters, $.statements],

    ...DISCOVERED.map(names => names.map(n => $[n])),
  ],

  rules: {
    // ---- SECTION: general (KotlinParser.g4 `kotlinFile`) ----

    source_file: $ => seq(
      optional($.shebang_line),
      repeat($.file_annotation),
      optional($.package_header),
      repeat($.import_header),
      repeat(seq($._top_level_object, optional($._semi))),
    ),

    shebang_line: _ => token(seq('#!', /[^\r\n]*/)),

    file_annotation: $ => seq(
      '@',
      token.immediate('file'),
      ':',
      choice(
        seq('[', repeat1($.unescaped_annotation), ']'),
        $.unescaped_annotation,
      ),
    ),

    package_header: $ => seq('package', $.qualified_identifier, optional($._semi)),

    import_header: $ => seq(
      'import',
      $.qualified_identifier,
      optional(choice($.import_wildcard, $.import_alias)),
      optional($._semi),
    ),

    // One token, so that the lexer — not the parser — decides whether a
    // dot continues the qualified name or opens the wildcard.
    import_wildcard: _ => token(seq('.', '*')),

    import_alias: $ => seq('as', $.simple_identifier),

    _top_level_object: $ => $._declaration,

    type_alias: $ => seq(
      optional($.modifiers),
      'typealias',
      field('name', $.simple_identifier),
      optional($.type_parameters),
      '=',
      field('value', $._type),
    ),

    _declaration: $ => choice(
      $.class_declaration,
      $.object_declaration,
      $.function_declaration,
      $.property_declaration,
      $.type_alias,
    ),

    // ---- SECTION: classes ----

    class_declaration: $ => prec.right(seq(
      optional($.modifiers),
      choice('class', seq(optional('fun'), 'interface')),
      field('name', $.simple_identifier),
      optional($.type_parameters),
      optional($.primary_constructor),
      optional(seq(':', $.delegation_specifiers)),
      optional($.type_constraints),
      optional(choice($.class_body, $.enum_class_body)),
    )),

    primary_constructor: $ => seq(
      optional(seq(optional($.modifiers), 'constructor')),
      $.class_parameters,
    ),

    class_body: $ => seq('{', optional($.class_member_declarations), '}'),

    class_parameters: $ => seq('(', optional(commaSep1Trailing($.class_parameter)), ')'),

    class_parameter: $ => seq(
      optional($.modifiers),
      optional(choice('val', 'var')),
      field('name', $.simple_identifier),
      ':',
      field('type', $._type),
      optional(seq('=', field('default', $._expression))),
    ),

    delegation_specifiers: $ => sepBy1(',', $.annotated_delegation_specifier),

    _delegation_specifier: $ => choice(
      $.constructor_invocation,
      $.explicit_delegation,
      $.user_type,
      $.function_type,
      seq('suspend', $.function_type),
    ),

    constructor_invocation: $ => seq($.user_type, $.value_arguments),

    annotated_delegation_specifier: $ => seq(
      repeat($.annotation),
      $._delegation_specifier,
    ),

    explicit_delegation: $ => seq(
      choice($.user_type, $.function_type),
      'by',
      $._expression,
    ),

    type_parameters: $ => seq('<', commaSep1Trailing($.type_parameter), '>'),

    type_parameter: $ => seq(
      optional($.type_parameter_modifiers),
      field('name', $.simple_identifier),
      optional(seq(':', field('bound', $._type))),
    ),

    type_constraints: $ => seq('where', sepBy1(',', $.type_constraint)),

    type_constraint: $ => seq(
      repeat($.annotation),
      $.simple_identifier,
      ':',
      $._type,
    ),

    // ---- SECTION: classMembers ----

    class_member_declarations: $ => repeat1(seq(
      $._class_member_declaration,
      optional($._semi),
    )),

    _class_member_declaration: $ => choice(
      $._declaration,
      $.companion_object,
      $.anonymous_initializer,
      $.secondary_constructor,
    ),

    anonymous_initializer: $ => seq('init', $.block),

    companion_object: $ => seq(
      optional($.modifiers),
      'companion',
      optional('data'),
      'object',
      optional(field('name', $.simple_identifier)),
      optional(seq(':', $.delegation_specifiers)),
      optional($.class_body),
    ),

    function_value_parameters: $ => seq(
      '(',
      optional(commaSep1Trailing($.function_value_parameter)),
      ')',
    ),

    function_value_parameter: $ => seq(
      optional($.parameter_modifiers),
      $.parameter,
      optional(seq('=', field('default', $._expression))),
    ),

    function_declaration: $ => prec.right(seq(
      optional($.modifiers),
      'fun',
      optional($.type_parameters),
      optional(seq(field('receiver', $.receiver_type), '.')),
      field('name', $.simple_identifier),
      $.function_value_parameters,
      optional(seq(':', field('return_type', $._type))),
      optional($.type_constraints),
      optional($.function_body),
    )),

    function_body: $ => choice(
      $.block,
      seq('=', field('value', $._expression)),
    ),

    variable_declaration: $ => seq(
      repeat($.annotation),
      field('name', $.simple_identifier),
      optional(seq(':', field('type', $._type))),
    ),

    multi_variable_declaration: $ => seq(
      '(',
      commaSep1Trailing($.variable_declaration),
      ')',
    ),

    property_declaration: $ => prec.right(seq(
      optional($.modifiers),
      choice('val', 'var'),
      optional($.type_parameters),
      optional(seq(field('receiver', $.receiver_type), '.')),
      choice($.multi_variable_declaration, $.variable_declaration),
      optional($.type_constraints),
      optional(choice(
        seq('=', field('value', $._expression)),
        $.property_delegate,
      )),
      optional(';'),
      optional(choice(
        seq($.getter, optional(seq(optional($._semi), $.setter))),
        seq($.setter, optional(seq(optional($._semi), $.getter))),
      )),
    )),

    property_delegate: $ => seq('by', $._expression),

    getter: $ => prec.right(seq(
      optional($.modifiers),
      'get',
      optional(seq(
        '(', ')',
        optional(seq(':', $._type)),
        $.function_body,
      )),
    )),

    setter: $ => prec.right(seq(
      optional($.modifiers),
      'set',
      optional(seq(
        '(',
        $.function_value_parameter_with_optional_type,
        optional(','),
        ')',
        optional(seq(':', $._type)),
        $.function_body,
      )),
    )),

    parameters_with_optional_type: $ => seq(
      '(',
      optional(commaSep1Trailing($.function_value_parameter_with_optional_type)),
      ')',
    ),

    function_value_parameter_with_optional_type: $ => seq(
      optional($.parameter_modifiers),
      $.parameter_with_optional_type,
      optional(seq('=', $._expression)),
    ),

    parameter_with_optional_type: $ => seq(
      field('name', $.simple_identifier),
      optional(seq(':', field('type', $._type))),
    ),

    parameter: $ => seq(
      field('name', $.simple_identifier),
      ':',
      field('type', $._type),
    ),

    object_declaration: $ => seq(
      optional($.modifiers),
      'object',
      field('name', $.simple_identifier),
      optional(seq(':', $.delegation_specifiers)),
      optional($.class_body),
    ),

    secondary_constructor: $ => prec.right(seq(
      optional($.modifiers),
      'constructor',
      $.function_value_parameters,
      optional(seq(':', $.constructor_delegation_call)),
      optional($.block),
    )),

    constructor_delegation_call: $ => seq(
      choice('this', 'super'),
      $.value_arguments,
    ),

    // ---- SECTION: enumClasses ----

    enum_class_body: $ => seq(
      '{',
      optional($.enum_entries),
      optional(seq(';', optional($.class_member_declarations))),
      '}',
    ),

    enum_entries: $ => seq(sepBy1(',', $.enum_entry), optional(',')),

    enum_entry: $ => seq(
      optional($.modifiers),
      field('name', $.simple_identifier),
      optional($.value_arguments),
      optional($.class_body),
    ),

    // ---- SECTION: types ----

    // KotlinParser.g4 `type`: the modifiers are hoisted here rather than
    // repeated per alternative, which is both what the specification
    // writes and far cheaper in parse states.
    _type: $ => seq(optional($.type_modifiers), $._type_body),

    _type_body: $ => choice(
      $.function_type,
      $.parenthesized_type,
      $.nullable_type,
      $.type_reference,
      $.definitely_non_nullable_type,
    ),

    type_reference: $ => choice($.user_type, 'dynamic'),

    nullable_type: $ => seq(
      choice($.type_reference, $.parenthesized_type),
      repeat1('?'),
    ),

    user_type: $ => sepBy1('.', $.simple_user_type),

    simple_user_type: $ => seq(
      field('name', $.simple_identifier),
      optional($.type_arguments),
    ),

    type_projection: $ => choice(
      seq(optional($.type_projection_modifiers), $._type),
      '*',
    ),

    type_projection_modifiers: $ => repeat1($.type_projection_modifier),

    type_projection_modifier: $ => choice(
      $.variance_modifier,
      $.annotation,
    ),

    function_type: $ => prec.right(seq(
      optional(seq(field('receiver', $.receiver_type), '.')),
      $.function_type_parameters,
      '->',
      field('return_type', $._type),
    )),

    function_type_parameters: $ => seq(
      '(',
      optional(commaSep1Trailing(choice($.parameter, $._type))),
      ')',
    ),

    parenthesized_type: $ => seq('(', $._type, ')'),

    receiver_type: $ => prec(1, seq(
      optional($.type_modifiers),
      choice($.parenthesized_type, $.nullable_type, $.type_reference),
    )),

    parenthesized_user_type: $ => seq(
      '(',
      choice($.user_type, $.parenthesized_user_type),
      ')',
    ),

    definitely_non_nullable_type: $ => seq(
      optional($.type_modifiers),
      choice($.user_type, $.parenthesized_user_type),
      '&',
      optional($.type_modifiers),
      choice($.user_type, $.parenthesized_user_type),
    ),

    // ---- SECTION: statements ----

    statements: $ => seq(
      $._statement,
      repeat(seq($._semi, $._statement)),
      optional($._semi),
    ),

    _statement: $ => seq(
      repeat(choice($.label, $.annotation)),
      choice(
        $._declaration,
        $.assignment,
        $._loop_statement,
        $._expression,
      ),
    ),

    label: $ => seq($.simple_identifier, token.immediate('@')),

    _control_structure_body: $ => choice($.block, $._statement),

    block: $ => seq('{', optional($.statements), '}'),

    _loop_statement: $ => choice(
      $.for_statement,
      $.while_statement,
      $.do_while_statement,
    ),

    for_statement: $ => prec.right(seq(
      'for',
      '(',
      repeat($.annotation),
      choice($.variable_declaration, $.multi_variable_declaration),
      'in',
      field('range', $._expression),
      ')',
      optional(field('body', $._control_structure_body)),
    )),

    while_statement: $ => seq(
      'while',
      '(',
      field('condition', $._expression),
      ')',
      choice(field('body', $._control_structure_body), ';'),
    ),

    do_while_statement: $ => seq(
      'do',
      optional(field('body', $._control_structure_body)),
      'while',
      '(',
      field('condition', $._expression),
      ')',
    ),

    // KotlinParser.g4 restricts the left-hand side to the shapes that
    // can actually be assigned to (`directlyAssignableExpression`,
    // `assignableExpression`). Those rules re-derive most of the
    // expression grammar, and duplicating it here costs an enormous
    // number of parse states for a distinction the linter never uses:
    // an unassignable target is a type error, which this grammar is not
    // in the business of catching. The left side is an expression.
    assignment: $ => prec.left(PREC.ASSIGNMENT, seq(
      field('target', $._expression),
      choice('=', $.assignment_and_operator),
      field('value', $._expression),
    )),

    _semi: $ => choice($._automatic_semicolon, ';'),

    // ---- SECTION: expressions ----
    //
    // KotlinParser.g4 states operator precedence as a cascade of rules,
    // each level naming the next. That cascade is reproduced literally
    // here rather than collapsed into one rule carrying `prec.left`
    // levels.
    //
    // The collapsed form is the usual tree-sitter shorthand and it
    // accepts the same language, but it reaches that language through an
    // ambiguous grammar that the GLR conflict machinery then has to take
    // apart at every level. Measured on this grammar, that cost 25,684
    // parse states and an 85 MB parser.c. The cascade is unambiguous by
    // construction, which is the whole reason the specification is
    // written this way.
    //
    // Each level is a hidden rule choosing between "pass through" and
    // "apply this operator", so a level that does no work leaves no node
    // in the tree.

    _expression: $ => $._disjunction,

    _disjunction: $ => choice($._conjunction, $.disjunction_expression),
    disjunction_expression: $ => prec.left(seq(
      field('left', $._disjunction), '||', field('right', $._conjunction),
    )),

    _conjunction: $ => choice($._equality, $.conjunction_expression),
    conjunction_expression: $ => prec.left(seq(
      field('left', $._conjunction), '&&', field('right', $._equality),
    )),

    _equality: $ => choice($._comparison, $.equality_expression),
    equality_expression: $ => prec.left(seq(
      field('left', $._equality),
      field('operator', $.equality_operator),
      field('right', $._comparison),
    )),

    _comparison: $ => choice($._infix_operation, $.comparison_expression),
    comparison_expression: $ => prec.left(seq(
      field('left', $._comparison),
      field('operator', $.comparison_operator),
      field('right', $._infix_operation),
    )),

    // KotlinParser.g4 `infixOperation`. The right operand is an
    // expression after `in`/`!in` and a type after `is`/`!is`.
    _infix_operation: $ => choice($._elvis_expression, $.infix_operation),
    infix_operation: $ => prec.left(seq(
      field('left', $._infix_operation),
      choice(
        seq(field('operator', $.in_operator), field('right', $._elvis_expression)),
        seq(field('operator', $.is_operator), field('right', $._type)),
      ),
    )),

    _elvis_expression: $ => choice($._infix_function_call, $.elvis_expression),
    elvis_expression: $ => prec.left(seq(
      field('left', $._elvis_expression), '?:', field('right', $._infix_function_call),
    )),

    // `a to b`, `x shl 2`: any identifier may be an infix operator.
    _infix_function_call: $ => choice($._range_expression, $.infix_function_call),
    infix_function_call: $ => prec.left(seq(
      field('left', $._infix_function_call),
      field('operator', $.simple_identifier),
      field('right', $._range_expression),
    )),

    _range_expression: $ => choice($._additive_expression, $.range_expression),
    range_expression: $ => prec.left(seq(
      field('left', $._range_expression),
      choice('..', '..<'),
      field('right', $._additive_expression),
    )),

    _additive_expression: $ => choice($._multiplicative_expression, $.additive_expression),
    additive_expression: $ => prec.left(seq(
      field('left', $._additive_expression),
      field('operator', $.additive_operator),
      field('right', $._multiplicative_expression),
    )),

    _multiplicative_expression: $ => choice($._as_expression, $.multiplicative_expression),
    multiplicative_expression: $ => prec.left(seq(
      field('left', $._multiplicative_expression),
      field('operator', $.multiplicative_operator),
      field('right', $._as_expression),
    )),

    _as_expression: $ => choice($._prefix_unary_expression, $.as_expression),
    as_expression: $ => prec.left(seq(
      field('left', $._as_expression),
      field('operator', $.as_operator),
      field('right', $._type),
    )),

    // KotlinParser.g4 `prefixUnaryExpression : unaryPrefix* postfixUnaryExpression`
    _prefix_unary_expression: $ => choice($._postfix_unary_expression, $.prefix_expression),
    prefix_expression: $ => prec.right(seq(
      field('operator', $.unary_prefix),
      field('operand', $._prefix_unary_expression),
    )),

    unary_prefix: $ => choice($.annotation, $.label, $.prefix_unary_operator),

    // KotlinParser.g4 `postfixUnaryExpression : primaryExpression postfixUnarySuffix*`
    _postfix_unary_expression: $ => choice($._primary_expression, $.postfix_expression),
    postfix_expression: $ => prec.left(seq(
      field('operand', $._postfix_unary_expression),
      field('suffix', $.postfix_unary_suffix),
    )),

    postfix_unary_suffix: $ => choice(
      $.postfix_unary_operator,
      $.type_arguments,
      $.call_suffix,
      $.indexing_suffix,
      $.navigation_suffix,
    ),

    _primary_expression: $ => choice(
      $.parenthesized_expression,
      $.simple_identifier,
      $._literal_constant,
      $.string_literal,
      $.callable_reference,
      $.lambda_literal,
      $.anonymous_function,
      $.object_literal,
      $.collection_literal,
      $.this_expression,
      $.super_expression,
      $.if_expression,
      $.when_expression,
      $.try_expression,
      $.jump_expression,
    ),

    indexing_suffix: $ => seq(
      '[',
      commaSep1Trailing($._expression),
      ']',
    ),

    navigation_suffix: $ => seq(
      $.member_access_operator,
      choice($.simple_identifier, $.parenthesized_expression, 'class'),
    ),

    call_suffix: $ => prec.left(seq(
      optional($.type_arguments),
      choice(
        seq(optional($.value_arguments), $.annotated_lambda),
        $.value_arguments,
      ),
    )),

    annotated_lambda: $ => seq(
      repeat($.annotation),
      optional($.label),
      $.lambda_literal,
    ),

    type_arguments: $ => prec(PREC.TYPE_ARGUMENTS, seq(
      '<',
      commaSep1Trailing($.type_projection),
      '>',
    )),

    value_arguments: $ => seq(
      '(',
      optional(commaSep1Trailing($.value_argument)),
      ')',
    ),

    value_argument: $ => seq(
      optional($.annotation),
      optional(seq(field('name', $.simple_identifier), '=')),
      optional('*'),
      $._expression,
    ),

    parenthesized_expression: $ => seq('(', $._expression, ')'),

    collection_literal: $ => seq(
      '[',
      optional(commaSep1Trailing($._expression)),
      ']',
    ),

    _literal_constant: $ => choice(
      $.boolean_literal,
      $.integer_literal,
      $.hex_literal,
      $.bin_literal,
      $.character_literal,
      $.real_literal,
      $.null_literal,
      $.long_literal,
      $.unsigned_literal,
    ),

    lambda_literal: $ => seq(
      '{',
      optional(seq(optional($.lambda_parameters), '->')),
      optional($.statements),
      '}',
    ),

    lambda_parameters: $ => commaSep1Trailing($.lambda_parameter),

    lambda_parameter: $ => choice(
      $.variable_declaration,
      seq($.multi_variable_declaration, optional(seq(':', $._type))),
    ),

    anonymous_function: $ => prec.right(seq(
      optional('suspend'),
      'fun',
      optional(seq($._type, '.')),
      $.parameters_with_optional_type,
      optional(seq(':', $._type)),
      optional($.type_constraints),
      optional($.function_body),
    )),

    object_literal: $ => prec.right(seq(
      optional('data'),
      'object',
      optional(seq(':', $.delegation_specifiers)),
      optional($.class_body),
    )),

    this_expression: $ => choice(
      'this',
      seq('this', token.immediate('@'), $._immediate_identifier),
    ),

    super_expression: $ => choice(
      seq(
        'super',
        optional(seq('<', $._type, '>')),
        optional(seq(token.immediate('@'), $._immediate_identifier)),
      ),
    ),

    if_expression: $ => prec.right(seq(
      'if',
      '(',
      field('condition', $._expression),
      ')',
      choice(
        field('consequence', $._control_structure_body),
        seq(
          optional(field('consequence', $._control_structure_body)),
          optional($._semi),
          'else',
          choice(field('alternative', $._control_structure_body), ';'),
        ),
        ';',
      ),
    )),

    when_subject: $ => seq(
      '(',
      optional(seq(
        repeat($.annotation),
        'val',
        $.variable_declaration,
        '=',
      )),
      $._expression,
      ')',
    ),

    when_expression: $ => seq(
      'when',
      optional($.when_subject),
      '{',
      repeat($.when_entry),
      '}',
    ),

    when_entry: $ => seq(
      choice(
        seq(commaSep1Trailing($.when_condition)),
        'else',
      ),
      '->',
      field('body', $._control_structure_body),
      optional($._semi),
    ),

    when_condition: $ => choice(
      $._expression,
      $.range_test,
      $.type_test,
    ),

    range_test: $ => seq($.in_operator, $._expression),

    type_test: $ => seq($.is_operator, $._type),

    try_expression: $ => prec.right(seq(
      'try',
      $.block,
      choice(
        seq(repeat1($.catch_block), optional($.finally_block)),
        $.finally_block,
      ),
    )),

    catch_block: $ => seq(
      'catch',
      '(',
      repeat($.annotation),
      field('name', $.simple_identifier),
      ':',
      field('type', $._type),
      optional(','),
      ')',
      $.block,
    ),

    finally_block: $ => seq('finally', $.block),

    jump_expression: $ => choice(
      prec.right(seq('throw', $._expression)),
      prec.right(seq(
        'return',
        optional(seq(token.immediate('@'), $._immediate_identifier)),
        optional($._expression),
      )),
      seq('continue', optional(seq(token.immediate('@'), $._immediate_identifier))),
      seq('break', optional(seq(token.immediate('@'), $._immediate_identifier))),
    ),

    callable_reference: $ => seq(
      optional($.receiver_type),
      '::',
      choice($.simple_identifier, 'class'),
    ),

    assignment_and_operator: _ => choice('+=', '-=', '*=', '/=', '%='),

    equality_operator: _ => choice('!=', '!==', '==', '==='),

    comparison_operator: _ => choice('<', '>', '<=', '>='),

    in_operator: _ => choice('in', '!in'),

    is_operator: _ => choice('is', '!is'),

    additive_operator: _ => choice('+', '-'),

    multiplicative_operator: _ => choice('*', '/', '%'),

    as_operator: _ => choice('as', 'as?'),

    prefix_unary_operator: _ => choice('++', '--', '-', '+', '!'),

    postfix_unary_operator: _ => choice('++', '--', '!!'),

    member_access_operator: _ => choice('.', '?.', '::'),

    // ---- SECTION: modifiers ----

    modifiers: $ => repeat1(choice($.annotation, $.modifier)),

    parameter_modifiers: $ => repeat1(choice($.annotation, $.parameter_modifier)),

    modifier: $ => choice(
      $.class_modifier,
      $.member_modifier,
      $.visibility_modifier,
      $.function_modifier,
      $.property_modifier,
      $.inheritance_modifier,
      $.parameter_modifier,
      $.platform_modifier,
    ),

    type_modifiers: $ => repeat1($.type_modifier),

    type_modifier: $ => choice($.annotation, 'suspend'),

    class_modifier: _ => choice('enum', 'sealed', 'annotation', 'data', 'inner', 'value'),

    member_modifier: _ => choice('override', 'lateinit'),

    visibility_modifier: _ => choice('public', 'private', 'internal', 'protected'),

    variance_modifier: _ => choice('in', 'out'),

    type_parameter_modifiers: $ => repeat1($.type_parameter_modifier),

    type_parameter_modifier: $ => choice(
      $.reification_modifier,
      $.variance_modifier,
      $.annotation,
    ),

    function_modifier: _ => choice('tailrec', 'operator', 'infix', 'inline', 'external', 'suspend'),

    property_modifier: _ => 'const',

    inheritance_modifier: _ => choice('abstract', 'final', 'open'),

    parameter_modifier: _ => choice('vararg', 'noinline', 'crossinline'),

    reification_modifier: _ => 'reified',

    platform_modifier: _ => choice('expect', 'actual'),

    // ---- SECTION: annotations ----

    annotation: $ => choice($.single_annotation, $.multi_annotation),

    single_annotation: $ => seq(
      choice($.annotation_use_site_target, '@'),
      $.unescaped_annotation,
    ),

    multi_annotation: $ => seq(
      choice($.annotation_use_site_target, '@'),
      '[',
      repeat1($.unescaped_annotation),
      ']',
    ),

    annotation_use_site_target: $ => seq(
      '@',
      token.immediate(choice(
        'field', 'property', 'get', 'set', 'receiver', 'param', 'setparam', 'delegate',
      )),
      ':',
    ),

    unescaped_annotation: $ => choice(
      $.constructor_invocation,
      $.user_type,
    ),

    // ---- SECTION: strings ----
    //
    // Every token inside a string is `immediate`, so that `extras` —
    // whitespace and comments — are not skipped between them. Without
    // that, the space in `"a b"` would be discarded as whitespace and
    // `//` inside a URL would begin a comment.

    string_literal: $ => choice($.line_string_literal, $.multiline_string_literal),

    line_string_literal: $ => seq(
      '"',
      repeat(choice(
        $._line_string_text,
        $.escape_sequence,
        $.string_reference,
        $.string_interpolation,
      )),
      token.immediate('"'),
    ),

    _line_string_text: _ => token.immediate(prec(1, /[^\\"$\n\r]+/)),

    multiline_string_literal: $ => seq(
      '"""',
      repeat(choice(
        $._raw_string_content,
        $.string_reference,
        $.string_interpolation,
      )),
      $._raw_string_end,
    ),

    string_reference: $ => seq(
      token.immediate('$'),
      alias($._immediate_identifier, $.simple_identifier),
    ),

    string_interpolation: $ => seq(
      token.immediate('${'),
      $._expression,
      '}',
    ),

    escape_sequence: _ => token.immediate(seq(
      '\\',
      choice(
        /u[0-9a-fA-F]{4}/,
        /[tbrn'"\\$]/,
      ),
    )),

    // ---- SECTION: literals ----

    boolean_literal: _ => choice('true', 'false'),

    null_literal: _ => 'null',

    // KotlinLexer.g4 permits `_` as a digit separator, but never as the
    // first or last digit.
    integer_literal: _ => token(choice(
      /[1-9][0-9_]*[0-9]/,
      /[0-9]/,
    )),

    hex_literal: _ => token(/0[xX][0-9a-fA-F][0-9a-fA-F_]*[0-9a-fA-F]|0[xX][0-9a-fA-F]/),

    bin_literal: _ => token(/0[bB][01][01_]*[01]|0[bB][01]/),

    real_literal: _ => token(choice(
      // DoubleLiteral, optionally with the float suffix
      /([0-9][0-9_]*[0-9]|[0-9])?\.([0-9][0-9_]*[0-9]|[0-9])([eE][+-]?([0-9][0-9_]*[0-9]|[0-9]))?[fF]?/,
      /([0-9][0-9_]*[0-9]|[0-9])[eE][+-]?([0-9][0-9_]*[0-9]|[0-9])[fF]?/,
      // FloatLiteral built straight on decimal digits
      /([0-9][0-9_]*[0-9]|[0-9])[fF]/,
    )),

    unsigned_literal: _ => token(seq(
      choice(
        /[1-9][0-9_]*[0-9]|[0-9]/,
        /0[xX][0-9a-fA-F][0-9a-fA-F_]*[0-9a-fA-F]|0[xX][0-9a-fA-F]/,
        /0[bB][01][01_]*[01]|0[bB][01]/,
      ),
      /[uU]/,
      optional(/[lL]/),
    )),

    long_literal: _ => token(seq(
      choice(
        /[1-9][0-9_]*[0-9]|[0-9]/,
        /0[xX][0-9a-fA-F][0-9a-fA-F_]*[0-9a-fA-F]|0[xX][0-9a-fA-F]/,
        /0[bB][01][01_]*[01]|0[bB][01]/,
      ),
      /[lL]/,
    )),

    character_literal: $ => seq(
      "'",
      choice($.escape_sequence, token.immediate(/[^\n\r'\\]/)),
      token.immediate("'"),
    ),

    // ---- SECTION: identifiers ----

    simple_identifier: $ => choice(
      $._alpha_identifier,
      $._backtick_identifier,
      ...SOFT_KEYWORDS,
    ),

    qualified_identifier: $ => sepBy1('.', $.simple_identifier),

    // The `word` token: plain Kotlin identifiers, which drives
    // tree-sitter's keyword-extraction optimisation.
    _alpha_identifier: _ => token(/[\p{L}_][\p{L}\p{Nd}_]*/u),

    _backtick_identifier: _ => token(seq('`', /[^\r\n`]+/, '`')),

    _immediate_identifier: _ => token.immediate(/[\p{L}_][\p{L}\p{Nd}_]*/u),
  },
});

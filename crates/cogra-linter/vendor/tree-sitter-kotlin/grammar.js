/// <reference types="tree-sitter-cli/dsl" />

const SOFT_KEYWORDS = [
  'abstract', 'annotation', 'by', 'catch', 'companion', 'constructor',
  'crossinline', 'data', 'dynamic', 'enum', 'external', 'final', 'finally',
  'get', 'import', 'infix', 'init', 'inline', 'inner', 'internal',
  'lateinit', 'noinline', 'open', 'operator', 'out', 'override', 'private',
  'protected', 'public', 'reified', 'sealed', 'tailrec', 'set', 'vararg',
  'where', 'field', 'property', 'receiver', 'param', 'setparam', 'delegate',
  'file', 'expect', 'actual', 'const', 'suspend', 'value',
];

function sepBy1(sep, rule) {
  return seq(rule, repeat(seq(sep, rule)));
}

/** The jump forms, over a given operand. Used twice: once at the top of
 *  the expression cascade with the full expression, and once on elvis's
 *  right with an operand tight enough not to compete with the operators
 *  that outrank elvis. */
function jumpForms($, operand) {
  const at = optional(seq(token.immediate('@'), $._immediate_identifier));
  return choice(
    prec.right(seq('throw', operand)),
    prec.right(seq('return', at, optional(operand))),
    seq('continue', at),
    seq('break', at),
  );
}

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
    $._error_sentinel,
  ],

  extras: $ => [
    /[ \t\r\n\u000C\u000B\uFEFF]/,
    $.line_comment,
    $.block_comment,
    $.kdoc,
  ],

  word: $ => $._alpha_identifier,

  conflicts: $ => [
    // `a < b` against `foo<Bar>()`: on `<` the parser cannot yet know
    // whether it is reading a comparison or a generic call's type
    // arguments. Genuinely ambiguous until the closing `>`, and so a
    // declared conflict rather than something to restructure away.
    [$._prefix_unary_expression, $.postfix_expression],

    // Every Kotlin modifier is also a legal identifier, so at the start
    // of a statement `data` may open a local declaration's modifiers or
    // simply be a variable. Nothing short of the following token
    // decides it. Precedence cannot resolve this — preferring the
    // modifier would break `data.foo()` — so the parse splits and
    // reconverges immediately.
    [$.modifier, $.simple_identifier],

    // Same cause, one level up: in `(private data: String)` the run of
    // modifiers cannot know it has ended until the name is past.
    [$.modifiers],

    // `{ (k, v) -> ... }` destructures its parameter; `{ (x) }` is a
    // lambda whose body is a parenthesised expression. Which one is
    // being read is not known until the `->` is or is not there.
    [$.variable_declaration, $._primary_expression],
  ],

  rules: {
    source_file: $ => seq(
      optional($.shebang_line),
      optional($.package_header),
      repeat($.import_header),
      // The separator is required, not optional. Kotlin always has one
      // — the scanner infers it from the newline — and making it
      // optional would let a declaration abut the expression before it,
      // which is what makes `val x = a` followed by `enum class F`
      // ambiguous with an infix call named `enum`.
      repeat(seq($._declaration, $._semi)),
    ),

    shebang_line: _ => token(seq('#!', /[^\r\n]*/)),

    package_header: $ => seq('package', $.qualified_identifier, $._semi),

    import_header: $ => seq(
      'import',
      $.qualified_identifier,
      optional(choice($.import_wildcard, $.import_alias)),
      $._semi,
    ),

    import_wildcard: _ => token(seq('.', '*')),
    import_alias: $ => seq('as', $.simple_identifier),

    _declaration: $ => choice(
      $.class_declaration,
      $.object_declaration,
      $.function_declaration,
      $.property_declaration,
      $.type_alias,
    ),

    type_alias: $ => seq(
      optional($.modifiers),
      'typealias',
      field('name', $.simple_identifier),
      optional($.type_parameters),
      '=',
      field('value', $._type),
    ),

    // Ends in a run of optional parts; keep reading them.
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

    object_declaration: $ => prec.right(seq(
      optional($.modifiers),
      'object',
      field('name', $.simple_identifier),
      optional(seq(':', $.delegation_specifiers)),
      optional($.class_body),
    )),

    primary_constructor: $ => seq(
      optional(seq(optional($.modifiers), 'constructor')),
      $.class_parameters,
    ),

    class_parameters: $ => seq(
      '(',
      optional(commaSep1Trailing($.class_parameter)),
      ')',
    ),

    class_parameter: $ => seq(
      optional($.modifiers),
      optional(choice('val', 'var')),
      field('name', $.simple_identifier),
      ':',
      field('type', $._type),
      optional(seq('=', field('default', $._expression))),
    ),

    // Comma lists that can sit inside another comma list keep reading
    // their own elements rather than yielding the comma to the outer one.
    delegation_specifiers: $ => prec.right(sepBy1(',', $._delegation_specifier)),

    _delegation_specifier: $ => choice(
      $.constructor_invocation,
      $.explicit_delegation,
      $.user_type,
      $.function_type,
    ),

    // In `object : Foo(...)` the argument list belongs to the supertype.
    constructor_invocation: $ => prec(1, seq($.user_type, $.value_arguments)),

    // The delegate names the cascade directly rather than `_expression`.
    // Going through the pass-through would let the parser reduce a
    // complete expression early and then find an operator it cannot
    // attach anywhere.
    // The delegate is tight — below the comparison and logical
    // operators. An object literal is itself an expression, so a
    // full-cascade operand here would compete with every operator that
    // could follow the literal. Real delegates are `by lazy { }`,
    // `by viewModels()`, `by remember { ... }`, all well inside this.
    explicit_delegation: $ => prec.right(seq(
      choice($.user_type, $.function_type),
      'by',
      $._infix_function_call,
    )),

    // Supertypes of an object *literal*, which unlike a declaration is an
    // expression and so may be followed by an operator. Delegation is
    // omitted here on purpose: a `by` whose operand reaches into the
    // expression cascade would compete with every operator that could
    // follow the literal, at every level of the cascade. `class A : B by b`
    // — the form that actually occurs — is a declaration and keeps it.
    _literal_supertypes: $ => prec.right(sepBy1(',', choice(
      $.constructor_invocation,
      $.user_type,
      $.function_type,
    ))),

    type_parameters: $ => seq('<', commaSep1Trailing($.type_parameter), '>'),

    type_parameter: $ => seq(
      optional(choice('in', 'out', 'reified')),
      field('name', $.simple_identifier),
      optional(seq(':', field('bound', $._type))),
    ),

    type_constraints: $ => prec.right(seq('where', sepBy1(',', $.type_constraint))),

    type_constraint: $ => seq($.simple_identifier, ':', $._type),

    // An empty `{}` fits either body; read it as the ordinary one.
    class_body: $ => prec(1, seq(
      '{', repeat(seq($._class_member_declaration, $._semi)), '}',
    )),

    _class_member_declaration: $ => choice(
      $._declaration,
      $.companion_object,
      $.anonymous_initializer,
      $.secondary_constructor,
    ),

    companion_object: $ => prec(1, seq(
      optional($.modifiers),
      'companion',
      optional('data'),
      'object',
      optional(field('name', $.simple_identifier)),
      optional(seq(':', $.delegation_specifiers)),
      optional($.class_body),
    )),

    anonymous_initializer: $ => prec(1, seq('init', $.block)),

    // In a class body these soft keywords open the member they name;
    // reading them as a plain identifier would mean a call to a function
    // named `constructor`/`init`/`companion`, which is not a thing.
    secondary_constructor: $ => prec(1, seq(
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

    enum_class_body: $ => seq(
      '{',
      optional($.enum_entries),
      optional(seq(';', repeat(seq($._class_member_declaration, $._semi)))),
      '}',
    ),

    enum_entries: $ => seq(sepBy1(',', $.enum_entry), optional(',')),

    enum_entry: $ => prec.right(seq(
      optional($.modifiers),
      field('name', $.simple_identifier),
      optional($.value_arguments),
      optional($.class_body),
    )),

    modifiers: $ => repeat1(choice($.annotation, $.modifier)),

    modifier: _ => choice(
      'enum', 'sealed', 'annotation', 'data', 'inner', 'value',
      'override', 'lateinit',
      'public', 'private', 'internal', 'protected',
      'tailrec', 'operator', 'infix', 'inline', 'external', 'suspend',
      'const',
      'abstract', 'final', 'open',
      'vararg', 'noinline', 'crossinline',
      'expect', 'actual',
    ),

    annotation: $ => seq(
      '@',
      optional(seq(
        token.immediate(choice(
          'field', 'property', 'get', 'set', 'receiver', 'param', 'setparam', 'delegate',
        )),
        ':',
      )),
      $.user_type,
      optional($.value_arguments),
    ),

    function_declaration: $ => prec.right(seq(
      optional($.modifiers),
      'fun',
      field('name', $.simple_identifier),
      $.function_value_parameters,
      optional(seq(':', field('return_type', $._type))),
      optional($.function_body),
    )),

    function_value_parameters: $ => seq(
      '(',
      optional(commaSep1Trailing($.parameter)),
      ')',
    ),

    parameter: $ => seq(
      field('name', $.simple_identifier),
      ':',
      field('type', $._type),
      optional(seq('=', field('default', $._expression))),
    ),

    function_body: $ => choice(
      $.block,
      seq('=', field('value', $._expression)),
    ),

    // Right-associative so `val x = e` takes the initialiser rather than
    // closing after the name and leaving `=` to be read as an assignment.
    property_declaration: $ => prec.right(seq(
      optional($.modifiers),
      choice('val', 'var'),
      field('name', $.simple_identifier),
      optional(seq(':', field('type', $._type))),
      optional(seq('=', field('value', $._expression))),
    )),

    // ---- types ----

    _type: $ => choice(
      $.function_type,
      $.nullable_type,
      $.user_type,
    ),

    // A dotted type keeps extending: `a.b.C` is one name.
    user_type: $ => prec.right(sepBy1('.', $.simple_user_type)),

    // In type position a `<` always opens type arguments — a type is
    // never an operand of `<` — so prefer the longer match rather than
    // splitting the parse.
    simple_user_type: $ => prec.right(seq(
      field('name', $.simple_identifier),
      optional($.type_arguments),
    )),

    type_arguments: $ => seq('<', commaSep1Trailing($.type_projection), '>'),

    type_projection: $ => choice($._type, '*'),

    nullable_type: $ => seq($.user_type, repeat1('?')),

    function_type: $ => seq(
      $.function_type_parameters,
      '->',
      field('return_type', $._type),
    ),

    function_type_parameters: $ => seq(
      '(',
      optional(commaSep1Trailing($._type)),
      ')',
    ),

    // ---- statements ----

    // `if (c) { ... }` is a block, not a lambda that is never called.
    block: $ => prec(1, seq('{', optional($.statements), '}')),

    statements: $ => seq(
      $._statement,
      repeat(seq($._semi, $._statement)),
      optional($._semi),
    ),

    _statement: $ => seq(
      repeat($.label),
      choice(
        $._declaration,
        $.assignment,
        $._loop_statement,
        $._expression,
      ),
    ),

    label: $ => seq($._alpha_identifier, token.immediate('@')),

    // In `if (c) x = 1` the body must keep reading rather than stop at
    // `x`, so the assignment outranks closing the statement.
    assignment: $ => prec.left(1, seq(
      field('target', $._expression),
      choice('=', $.assignment_and_operator),
      field('value', $._expression),
    )),

    assignment_and_operator: _ => choice('+=', '-=', '*=', '/=', '%='),

    _control_structure_body: $ => choice($.block, $._statement),

    _loop_statement: $ => choice(
      $.for_statement,
      $.while_statement,
      $.do_while_statement,
    ),

    for_statement: $ => prec.right(seq(
      'for', '(',
      choice($.variable_declaration, $.multi_variable_declaration),
      'in', field('range', $._expression),
      ')',
      optional(field('body', $._control_structure_body)),
    )),

    variable_declaration: $ => seq(
      field('name', $.simple_identifier),
      optional(seq(':', field('type', $._type))),
    ),

    multi_variable_declaration: $ => seq(
      '(', commaSep1Trailing($.variable_declaration), ')',
    ),

    while_statement: $ => seq(
      'while', '(', field('condition', $._expression), ')',
      choice(field('body', $._control_structure_body), ';'),
    ),

    // With an omitted body, `do while (c)` could read as a `do` whose
    // body is a while-statement. Prefer the do-while.
    do_while_statement: $ => prec(1, seq(
      'do',
      optional(field('body', $._control_structure_body)),
      'while', '(', field('condition', $._expression), ')',
    )),

    _semi: $ => choice($._automatic_semicolon, ';'),

    // ---- expressions (KotlinParser.g4 cascade) ----

    // A jump swallows the whole expression after it, so it cannot be an
    // atom: as a `_primary_expression` it would be ambiguous with every
    // operator above it in the cascade. It sits at the top instead,
    // where nothing can extend it.
    // `if` joins the jump at the top rather than sitting among the
    // atoms: its branches are not bracketed, so as an atom `if (c) a || b`
    // would be ambiguous about whether the `||` is inside the branch.
    // Kotlin puts it inside. `when` and `try` need no such treatment —
    // they close with `}`, so they can be operands directly, which is
    // what makes `when (x) { ... }.also { }` work.
    _expression: $ => choice(
      $._disjunction,
      $.jump_expression,
      $.if_expression,
      // Same reason: its `= expr` body is unbracketed and runs greedily.
      $.anonymous_function,
    ),

    _disjunction: $ => choice($._conjunction, $.disjunction_expression),
    disjunction_expression: $ => prec.left(seq($._disjunction, '||', $._conjunction)),

    _conjunction: $ => choice($._equality, $.conjunction_expression),
    conjunction_expression: $ => prec.left(seq($._conjunction, '&&', $._equality)),

    _equality: $ => choice($._comparison, $.equality_expression),
    equality_expression: $ => prec.left(seq($._equality, $.equality_operator, $._comparison)),

    _comparison: $ => choice($._infix_operation, $.comparison_expression),
    comparison_expression: $ => prec.left(seq($._comparison, $.comparison_operator, $._infix_operation)),

    _infix_operation: $ => choice($._elvis_expression, $.infix_operation),
    infix_operation: $ => prec.left(seq(
      $._infix_operation,
      choice(
        seq($.in_operator, $._elvis_expression),
        seq($.is_operator, $._type),
      ),
    )),

    _elvis_expression: $ => choice($._infix_function_call, $.elvis_expression),
    // `?: throw ...` and `?: return ...` are the idiom the jump is
    // mostly used in, so it is admitted explicitly on the right.
    elvis_expression: $ => prec.left(seq(
      $._elvis_expression, '?:',
      choice($._infix_function_call, alias($._tight_jump, $.jump_expression)),
    )),

    // KotlinParser.g4 writes the infix operator as `simpleIdentifier`,
    // which admits every soft keyword. That makes `expr where`,
    // `expr enum`, `expr by` and so on ambiguous between an infix call
    // and whatever construct the keyword actually opens — a whole family
    // of conflicts spread across the grammar.
    //
    // The operator is a plain identifier here instead. Kotlin's infix
    // functions are named `to`, `until`, `shl`, `downTo`; declaring one
    // named `where` or `private` is possible but not a thing anyone
    // does, and the ambiguity it buys is not worth carrying.
    _infix_function_call: $ => choice($._range_expression, $.infix_function_call),
    infix_function_call: $ => prec.left(seq(
      $._infix_function_call,
      field('operator', alias($._alpha_identifier, $.simple_identifier)),
      $._range_expression,
    )),

    _range_expression: $ => choice($._additive_expression, $.range_expression),
    range_expression: $ => prec.left(seq(
      $._range_expression, choice('..', '..<'), $._additive_expression,
    )),

    _additive_expression: $ => choice($._multiplicative_expression, $.additive_expression),
    additive_expression: $ => prec.left(seq(
      $._additive_expression, $.additive_operator, $._multiplicative_expression,
    )),

    _multiplicative_expression: $ => choice($._as_expression, $.multiplicative_expression),
    multiplicative_expression: $ => prec.left(seq(
      $._multiplicative_expression, $.multiplicative_operator, $._as_expression,
    )),

    _as_expression: $ => choice($._prefix_unary_expression, $.as_expression),
    as_expression: $ => prec.left(seq($._as_expression, $.as_operator, $._type)),

    _prefix_unary_expression: $ => choice($._postfix_unary_expression, $.prefix_expression),
    prefix_expression: $ => prec.right(seq($.prefix_unary_operator, $._prefix_unary_expression)),

    _postfix_unary_expression: $ => choice($._primary_expression, $.postfix_expression),
    postfix_expression: $ => prec.left(seq($._postfix_unary_expression, $.postfix_unary_suffix)),

    postfix_unary_suffix: $ => choice(
      $.postfix_unary_operator,
      $.call_suffix,
      $.indexing_suffix,
      $.navigation_suffix,
    ),

    // `foo(a) { ... }` attaches the trailing lambda to the call rather
    // than closing the call and starting a block.
    call_suffix: $ => prec.right(choice(
      seq(optional($.type_arguments), $.value_arguments, optional($.annotated_lambda)),
      seq(optional($.type_arguments), $.annotated_lambda),
    )),

    annotated_lambda: $ => seq(optional($.label), $.lambda_literal),

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

    // Without `suspend`: as a leading modifier it belongs to a local
    // `suspend fun name()` declaration, which is the form that actually
    // occurs; `suspend fun(...) {}` as an expression does not.
    anonymous_function: $ => prec.right(seq(
      'fun',
      $.function_value_parameters,
      optional(seq(':', $._type)),
      optional($.function_body),
    )),

    // No `data` here: a data object is always a declaration, never an
    // anonymous literal, and admitting it makes `data object` ambiguous
    // with the modifier.
    object_literal: $ => prec.right(seq(
      'object',
      optional(seq(':', alias($._literal_supertypes, $.delegation_specifiers))),
      optional($.class_body),
    )),

    value_arguments: $ => seq('(', optional(commaSep1Trailing($.value_argument)), ')'),

    value_argument: $ => seq(
      optional(seq(field('name', $.simple_identifier), '=')),
      $._expression,
    ),

    indexing_suffix: $ => seq('[', commaSep1Trailing($._expression), ']'),

    navigation_suffix: $ => seq(
      $.member_access_operator,
      choice($.simple_identifier, 'class'),
    ),

    _primary_expression: $ => choice(
      $.parenthesized_expression,
      $.simple_identifier,
      $._literal_constant,
      $.string_literal,
      $.when_expression,
      $.try_expression,
      $.lambda_literal,
      $.object_literal,
      $.this_expression,
      $.super_expression,
      $.callable_reference,
      $.collection_literal,
    ),

    if_expression: $ => prec.right(seq(
      'if', '(', field('condition', $._expression), ')',
      optional(field('consequence', $._control_structure_body)),
      // The separator before `else` is what lets `else` start its own
      // line: the scanner has already inferred a terminator after the
      // consequence, and this absorbs it. KotlinParser.g4's bare
      // `SEMICOLON` branches for an empty body are dropped — an omitted
      // body plus the enclosing statement's own separator covers them,
      // and keeping them collides with that separator.
      optional(seq(
        optional($._semi),
        'else',
        optional(field('alternative', $._control_structure_body)),
      )),
    )),

    when_expression: $ => seq(
      'when',
      optional($.when_subject),
      '{', repeat($.when_entry), '}',
    ),

    when_subject: $ => seq(
      '(',
      optional(seq('val', $.variable_declaration, '=')),
      $._expression,
      ')',
    ),

    when_entry: $ => seq(
      choice(commaSep1Trailing($.when_condition), 'else'),
      '->',
      field('body', $._control_structure_body),
      // Required, like every other statement terminator here: an
      // optional one would let `else -> a` run into a following
      // `in b -> ...` entry.
      $._semi,
    ),

    when_condition: $ => choice(
      $._expression,
      seq($.in_operator, $._expression),
      seq($.is_operator, $._type),
    ),

    try_expression: $ => prec.right(seq(
      'try', $.block,
      choice(
        seq(repeat1($.catch_block), optional($.finally_block)),
        $.finally_block,
      ),
    )),

    catch_block: $ => seq(
      'catch', '(',
      field('name', $.simple_identifier), ':', field('type', $._type),
      optional(','),
      ')',
      $.block,
    ),

    finally_block: $ => seq('finally', $.block),

    // `throw`/`return` take the whole expression that follows, so in
    // `throw a || b` the operator binds inside the throw. A negative
    // precedence makes the parser keep reading rather than close the
    // jump at the first complete operand.
    jump_expression: $ => jumpForms($, $._expression),

    // `?: return null`, `?: throw Foo("m")`, `?: return a + b`. The
    // operand stops below the comparison and logical operators, which is
    // what keeps `a ?: throw b || c` from being ambiguous about whether
    // the `||` belongs to the throw or to the elvis.
    _tight_jump: $ => jumpForms($, $._infix_function_call),

    this_expression: $ => seq(
      'this',
      optional(seq(token.immediate('@'), $._immediate_identifier)),
    ),

    super_expression: $ => seq(
      'super',
      optional(seq(token.immediate('@'), $._immediate_identifier)),
    ),

    // Only the receiverless form. `String::class` and `foo::bar` arrive
    // as a navigation suffix on the expression, so admitting a type here
    // as well would make every leading identifier ambiguous between a
    // type and an expression.
    callable_reference: $ => seq('::', choice($.simple_identifier, 'class')),

    collection_literal: $ => seq(
      '[', optional(commaSep1Trailing($._expression)), ']',
    ),

    parenthesized_expression: $ => seq('(', $._expression, ')'),

    // ---- operators ----

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

    // ---- literals ----

    _literal_constant: $ => choice(
      $.boolean_literal,
      $.integer_literal,
      $.real_literal,
      $.null_literal,
      $.character_literal,
    ),

    boolean_literal: _ => choice('true', 'false'),
    null_literal: _ => 'null',
    integer_literal: _ => token(choice(/[1-9][0-9_]*[0-9]/, /[0-9]/)),
    real_literal: _ => token(/([0-9][0-9_]*[0-9]|[0-9])?\.([0-9][0-9_]*[0-9]|[0-9])([eE][+-]?[0-9]+)?[fF]?/),

    character_literal: $ => seq(
      "'",
      choice($.escape_sequence, token.immediate(/[^\n\r'\\]/)),
      token.immediate("'"),
    ),

    // ---- strings ----

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

    string_interpolation: $ => seq(token.immediate('${'), $._expression, '}'),

    escape_sequence: _ => token.immediate(seq(
      '\\', choice(/u[0-9a-fA-F]{4}/, /[tbrn'"\\$]/),
    )),

    // ---- identifiers ----

    simple_identifier: $ => choice(
      $._alpha_identifier,
      $._backtick_identifier,
      ...SOFT_KEYWORDS,
    ),

    qualified_identifier: $ => sepBy1('.', $.simple_identifier),

    _alpha_identifier: _ => token(/[\p{L}_][\p{L}\p{Nd}_]*/u),
    _backtick_identifier: _ => token(seq('`', /[^\r\n`]+/, '`')),
    _immediate_identifier: _ => token.immediate(/[\p{L}_][\p{L}\p{Nd}_]*/u),
  },
});

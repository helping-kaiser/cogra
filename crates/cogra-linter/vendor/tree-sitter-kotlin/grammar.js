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
    $._line_string_content,
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

    // Kotlin's modifiers are soft keywords: every one is also a legal
    // identifier. In `(private data: String)` the run of modifiers
    // cannot know it has ended until the name is past.
    [$.modifiers],

    // `{ (k, v) -> ... }` destructures its parameter; `{ (x) }` is a
    // lambda whose body is a parenthesised expression. Which one is
    // being read is not known until the `->` is or is not there.
    [$.variable_declaration, $._primary_expression],

    // `(A)` is a parenthesised type; `(A) -> B` is a function type whose
    // parameter list happens to look identical up to the arrow.
    [$.parenthesized_type, $.function_type_parameters],

    // Where a dotted name stops. In `fun A.B.c()` the receiver is
    // everything before the last dot, and which dot that is only becomes
    // clear at what follows the name — further than one token of
    // look-ahead reaches.
    [$.user_type],

    // Where an `if` branch ends against a postfix suffix: `if (c) a[0]`
    // may close the branch at `a` or read the indexing as part of it.
    // This is the bottom of the cascade, so unlike a bound drawn higher
    // up it does not repeat at further levels.
    [$._if_branch, $.postfix_expression],

  ],

  rules: {
    source_file: $ => seq(
      optional($.shebang_line),
      repeat($.file_annotation),
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

    // `@file:JvmName("X")`, and the bracketed form `@file:[A B]`.
    file_annotation: $ => seq(
      '@', token.immediate('file'), ':',
      choice(
        seq('[', repeat1($.unescaped_annotation), ']'),
        $.unescaped_annotation,
      ),
      $._semi,
    ),

    // The argument list must follow the name with no space between.
    // `@Preview(showBackground = true)` attaches its arguments;
    // `@Composable () -> Unit` does not — there the `()` opens the
    // function type being annotated. Nothing but the whitespace
    // distinguishes them, which is why the paren is `immediate`.
    unescaped_annotation: $ => prec.right(seq(
      $.user_type,
      optional(alias($._annotation_arguments, $.value_arguments)),
    )),

    _annotation_arguments: $ => seq(
      token.immediate('('),
      optional(commaSep1Trailing($.value_argument)),
      ')',
    ),

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
      choice(
        seq('[', repeat1($.unescaped_annotation), ']'),
        $.unescaped_annotation,
      ),
    ),

    function_declaration: $ => prec.right(seq(
      optional($.modifiers),
      'fun',
      optional($.type_parameters),
      // Extension receiver: `fun Modifier.padding(...)`. Decided by the
      // dot — the token after the name settles receiver against name.
      optional(seq(field('receiver', $.receiver_type), '.')),
      field('name', $.simple_identifier),
      $.function_value_parameters,
      optional(seq(':', field('return_type', $._type))),
      optional($.type_constraints),
      optional($.function_body),
    )),

    // A named type with an optional `?`, and nothing parenthesised: a
    // parenthesised receiver would make `val (a, b) = ...` ambiguous with
    // a destructuring declaration from the opening paren onwards.
    receiver_type: $ => prec(1, seq($.user_type, optional('?'))),

    function_value_parameters: $ => seq(
      '(',
      optional(commaSep1Trailing($.function_value_parameter)),
      ')',
    ),

    // Modifiers live here rather than on `parameter`, because `parameter`
    // is shared with function *type* parameter lists, where a leading
    // annotation belongs to the type (`(@Ann Foo) -> Unit`) and not to a
    // parameter. Carrying them on `parameter` makes the two readings of a
    // run of annotations ambiguous.
    function_value_parameter: $ => seq(
      optional($.modifiers),
      $.parameter,
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
      optional($.type_parameters),
      optional(seq(field('receiver', $.receiver_type), '.')),
      choice($.multi_variable_declaration, $.variable_declaration),
      optional($.type_constraints),
      optional(choice(
        seq('=', field('value', $._expression)),
        $.property_delegate,
      )),
      // No separator before an accessor. Either form of one — optional
      // or required — competes with the declaration's own terminator for
      // the same token. The scanner instead declines to infer a
      // terminator before `get`/`set`, so the accessor simply follows.
      repeat(choice($.getter, $.setter)),
    )),

    // `by lazy { }`, `by remember { }`, `by viewModels()`. Tight for the
    // same reason the supertype delegate is.
    property_delegate: $ => prec.right(seq('by', $._infix_function_call)),

    getter: $ => prec.right(1, seq(
      optional($.modifiers),
      'get',
      optional(seq(
        '(', ')',
        optional(seq(':', $._type)),
        $.function_body,
      )),
    )),

    setter: $ => prec.right(1, seq(
      optional($.modifiers),
      'set',
      optional(seq(
        '(',
        $.parameter_with_optional_type,
        optional(','),
        ')',
        optional(seq(':', $._type)),
        $.function_body,
      )),
    )),

    parameter_with_optional_type: $ => seq(
      optional($.modifiers),
      field('name', $.simple_identifier),
      optional(seq(':', field('type', $._type))),
    ),

    // ---- types ----

    _type: $ => choice($._unannotated_type, $.annotated_type),

    _unannotated_type: $ => choice(
      $.function_type,
      $.nullable_type,
      $.user_type,
      $.parenthesized_type,
      $.suspend_type,
    ),

    // KotlinParser.g4 `typeModifiers`. `@Composable () -> Unit` is the
    // form this corpus is built out of. The annotated form does not nest
    // in itself — one run of annotations, then the type.
    annotated_type: $ => prec.right(seq(repeat1($.annotation), $._unannotated_type)),

    // `suspend () -> Unit`
    // In type position `suspend` opens a suspending function type rather
    // than naming a type called `suspend`.
    suspend_type: $ => prec.right(1, seq('suspend', choice($.function_type, $.parenthesized_type))),

    parenthesized_type: $ => seq('(', $._type, ')'),

    user_type: $ => sepBy1('.', $.simple_user_type),

    // In type position a `<` always opens type arguments — a type is
    // never an operand of `<` — so prefer the longer match rather than
    // splitting the parse.
    simple_user_type: $ => prec.right(seq(
      field('name', $.simple_identifier),
      optional($.type_arguments),
    )),

    type_arguments: $ => seq('<', commaSep1Trailing($.type_projection), '>'),

    type_projection: $ => choice(seq(optional(choice('in', 'out')), $._type), '*'),

    nullable_type: $ => seq(choice($.user_type, $.parenthesized_type), repeat1('?')),

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

    // One token, including the `@`. Split into two, the parser has to
    // shift the identifier before it can see whether an `@` follows, so
    // any name after a call — the `xor` in `f() xor 1` — gets taken for
    // the start of a labelled trailing lambda.
    // Two tokens, not one. A single `name@` token would start like an
    // identifier, and tree-sitter's keyword extraction lexes such a word
    // through the `word` token before a longer token can claim it — so
    // neither `loop@` nor `break@loop` would ever match.
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

    // No label here. A labelled trailing lambda — `forEach loop@{ ... }`
    // — would have the parser shift any identifier after a call on the
    // chance an `@` follows, which is what breaks `f() xor 1`. Statement
    // labels are unaffected.
    annotated_lambda: $ => $.lambda_literal,

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
      // `a provides if (c) X else Y`: an `if` used as an operand. Its
      // branches are tight — below the comparison and logical operators
      // — which is what lets it sit among the atoms without being
      // ambiguous with the operators around it. The full form, with
      // `_control_structure_body` branches that may be blocks, is the one
      // at the top of the cascade and is what `val x = if (c) { } else { }`
      // reaches.
      $.if_expression,
      $.lambda_literal,
      $.object_literal,
      $.this_expression,
      $.super_expression,
      $.callable_reference,
      $.collection_literal,
    ),

    // `if` is an ordinary operand, so its branches are bounded rather
    // than running to the end of the enclosing expression. An unbounded
    // branch would make `if (c) a || b` ambiguous about whether the `||`
    // is inside the branch at every level of the cascade.
    //
    // The bound is drawn to admit what actually occurs: a block, an
    // else-if chain, a bare jump, and any expression below the
    // comparison and logical operators. `if (c) a || b` binds the `||`
    // outside the branch, where Kotlin binds it inside; write the parens
    // if that distinction matters.
    if_expression: $ => prec.right(seq(
      'if', '(', field('condition', $._expression), ')',
      optional(field('consequence', $._if_branch)),
      // No separator before `else`. Absorbing one here would take the
      // terminator that ends the whole `if` statement, so the statement
      // after `if (c) return x` could never start. The scanner declines
      // to infer a terminator before an `else` instead.
      optional(seq(
        'else',
        optional(field('alternative', $._if_branch)),
      )),
    )),

    _if_branch: $ => choice(
      $.block,
      // `if` itself is not listed: it is an atom, so an else-if chain
      // already arrives through the cascade below.
      alias($._branch_jump, $.jump_expression),
      // The bottom of the operator cascade. Bounding a branch anywhere
      // in the middle leaves the pass-through below it competing with
      // that level's operator, and the competition then repeats at every
      // level down — no precedence or conflict resolves it in one place.
      // Here there is nothing below to compete.
      //
      // The cost: an unparenthesised operator in a branch, as in
      // `if (c) a + 1 else a - 1`, is not read as part of the branch.
      // Blocks, else-if chains, jumps, calls, navigation and plain names
      // — which is what branches are in this corpus — all still fit.
      $._postfix_unary_expression,
    ),

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

    // The same forms again at the branch's own level, so that
    // `if (c) return x` does not bound its operand higher up the cascade
    // than the branch around it.
    _branch_jump: $ => jumpForms($, $._postfix_unary_expression),

    this_expression: $ => seq(
      'this',
      optional(seq(token.immediate('@'), $._immediate_identifier)),
    ),

    super_expression: $ => prec.right(seq(
      'super',
      optional(seq('<', $._type, '>')),
      optional(seq(token.immediate('@'), $._immediate_identifier)),
    )),

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
      $.hex_literal,
      $.bin_literal,
      $.long_literal,
      $.unsigned_literal,
      $.real_literal,
      $.null_literal,
      $.character_literal,
    ),

    boolean_literal: _ => choice('true', 'false'),
    null_literal: _ => 'null',
    // KotlinLexer.g4 permits `_` as a digit separator, but never as the
    // first or last digit.
    integer_literal: _ => token(choice(/[1-9][0-9_]*[0-9]/, /[0-9]/)),

    hex_literal: _ => token(/0[xX][0-9a-fA-F]([0-9a-fA-F_]*[0-9a-fA-F])?/),

    bin_literal: _ => token(/0[bB][01]([01_]*[01])?/),

    long_literal: _ => token(seq(
      choice(
        /[1-9][0-9_]*[0-9]|[0-9]/,
        /0[xX][0-9a-fA-F]([0-9a-fA-F_]*[0-9a-fA-F])?/,
        /0[bB][01]([01_]*[01])?/,
      ),
      /[lL]/,
    )),

    unsigned_literal: _ => token(seq(
      choice(
        /[1-9][0-9_]*[0-9]|[0-9]/,
        /0[xX][0-9a-fA-F]([0-9a-fA-F_]*[0-9a-fA-F])?/,
        /0[bB][01]([01_]*[01])?/,
      ),
      /[uU]/,
      optional(/[lL]/),
    )),
    // KotlinLexer.g4 RealLiteral = FloatLiteral | DoubleLiteral. All
    // three shapes are needed, and the last one — plain digits with the
    // float suffix, as in `-1f..1f` — is the one this corpus leans on.
    real_literal: _ => token(choice(
      /([0-9][0-9_]*[0-9]|[0-9])?\.([0-9][0-9_]*[0-9]|[0-9])([eE][+-]?[0-9]+)?[fF]?/,
      /([0-9][0-9_]*[0-9]|[0-9])[eE][+-]?([0-9][0-9_]*[0-9]|[0-9])[fF]?/,
      /([0-9][0-9_]*[0-9]|[0-9])[fF]/,
    )),

    character_literal: $ => seq(
      "'",
      choice($.escape_sequence, token.immediate(/[^\n\r'\\]/)),
      token.immediate("'"),
    ),

    // ---- strings ----

    string_literal: $ => choice($.line_string_literal, $.multiline_string_literal),

    // The content is the scanner's, not a token of its own — the same
    // arrangement the raw string already had, and for the same reason.
    //
    // `extras` are global in tree-sitter: a comment is a candidate
    // wherever the lexer may begin a token, and `token.immediate` only
    // stops the *internal* lexer from skipping trivia — the external
    // scanner is still consulted, and comments are external tokens
    // because Kotlin's nest. So a `//` at a position where a content
    // token began — right after the opening quote, or right after an
    // interpolation's `}` — was lexed as a comment. Mid-content it never
    // was, because one greedy token spanned it, which is why every URL in
    // the corpus stayed clean and the defect stayed hidden.
    //
    // With the content scanner-owned, the scanner knows it is inside a
    // string and refuses to produce anything else there, so a comment
    // node inside a string is not merely unlikely but unreachable. That
    // is what `[scanned-regions]` promises: string literals are never
    // scanned.
    line_string_literal: $ => seq(
      '"',
      repeat(choice(
        $._line_string_content,
        $.escape_sequence,
        $.string_reference,
        $.string_interpolation,
      )),
      token.immediate('"'),
    ),

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

/**
 * @typedef {{ offset: number, line: number, column: number }} SourcePosition
 * @typedef {{ start: SourcePosition, end: SourcePosition }} SourceRange
 * @typedef {{ type: string, value: string, range: SourceRange, sigil?: string, interpolate?: boolean, flags?: string, number?: number }} Token
 * @typedef {{ type:'literal', value:*, range:SourceRange }} LiteralExpression
 * @typedef {{ type:'string', value:string, interpolate:boolean, range:SourceRange }} StringExpression
 * @typedef {{ type:'regex', pattern:string, flags:string, range:SourceRange }} RegexExpression
 * @typedef {{ type:'variable', sigil:string, name:string, range:SourceRange }} VariableExpression
 * @typedef {{ type:'bare', name:string, range:SourceRange }} BareExpression
 * @typedef {{ type:'arrayLast', name:string, range:SourceRange }} ArrayLastExpression
 * @typedef {{ type:'list', items:Expression[], range:SourceRange }} ListExpression
 * @typedef {{ type:'index', target:Expression, index:Expression, range:SourceRange }} IndexExpression
 * @typedef {{ type:'hashIndex', target:Expression, key:Expression, range:SourceRange }} HashIndexExpression
 * @typedef {{ type:'read', handle:string, range:SourceRange }} ReadExpression
 * @typedef {{ type:'assign', left:Expression, right:Expression, range:SourceRange }} AssignExpression
 * @typedef {{ type:'update', op:string, argument:Expression, range:SourceRange }} UpdateExpression
 * @typedef {{ type:'unary', op:string, value:Expression, range:SourceRange }} UnaryExpression
 * @typedef {{ type:'binary', op:string, left:Expression, right:Expression, range:SourceRange }} BinaryExpression
 * @typedef {{ type:'call', name:string, args:Expression[], range:SourceRange }} CallExpression
 * @typedef {LiteralExpression|StringExpression|RegexExpression|VariableExpression|BareExpression|ArrayLastExpression|ListExpression|IndexExpression|HashIndexExpression|ReadExpression|AssignExpression|UpdateExpression|UnaryExpression|BinaryExpression|CallExpression} Expression
 * @typedef {{ type:'expressionStatement', expression:Expression, range:SourceRange }} ExpressionStatement
 * @typedef {{ type:'sub', name:string, body:Statement[], range:SourceRange }} SubStatement
 * @typedef {{ type:'open', handle:string, spec:Expression, range:SourceRange }} OpenStatement
 * @typedef {{ type:'select', handle:string, range:SourceRange }} SelectStatement
 * @typedef {{ type:'print', handle:string|null, values:Expression[], range:SourceRange }} PrintStatement
 * @typedef {{ type:'return', value:Expression|null, range:SourceRange }} ReturnStatement
 * @typedef {{ type:'modifier', negate:boolean, test:Expression, statement:Statement, range:SourceRange }} ModifierStatement
 * @typedef {{ type:'if', negate:boolean, test:Expression, consequent:Statement[], alternate:Statement[], range:SourceRange }} IfStatement
 * @typedef {{ type:'while', test:Expression, body:Statement[], range:SourceRange }} WhileStatement
 * @typedef {ExpressionStatement|SubStatement|OpenStatement|SelectStatement|PrintStatement|ReturnStatement|ModifierStatement|IfStatement|WhileStatement} Statement
 * @typedef {{ type:'program', body:Statement[], range:SourceRange }} Program
 * @typedef {{ type:'memory', value:string, spec?:* }} MemoryHandle
 * @typedef {{ type:'dom-in'|'dom-out', element:Element }} DomHandle
 * @typedef {{ type:'event', element:Element, event:string }} EventHandle
 * @typedef {MemoryHandle|DomHandle|EventHandle} FileHandle
 */

export {};

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
 * @typedef {{ type:'event', element:Element, event:string, cleanups:Set<()=>void> }} EventHandle
 * @typedef {{ type:'ui', element:Element, renderer:import('./ui.js').DOMUIRenderer }} UIHandle
 * @typedef {{ type:'stream', name:string, adapter:{write:(value:string)=>*,close?:()=>void}, queue:string[], watchers:Set<Function>, ended:boolean, closed:boolean }} StreamHandle
 * @typedef {{getItem:(key:string)=>string|null,setItem:(key:string,value:string)=>*,removeItem:(key:string)=>*}} StorageArea
 * @typedef {{ type:'storage', area:StorageArea, key:string, writable:boolean, value:string }} StorageHandle
 * @typedef {{ element:HTMLStyleElement, value:string }} CSSSheet
 * @typedef {{ type:'css', sheet:CSSSheet }} CSSHandle
 * @typedef {{ type:'route', mode:'hash'|'history', navigation:*, value:string, watchers:Set<Function>, removeListener:(()=>void)|null }} RouteHandle
 * @typedef {{ type:'clock', interval:number, clock:{now:()=>number,setInterval:(callback:Function,interval:number)=>*,clearInterval:(timer:*)=>void}, watchers:Set<Function>, timer:* }} ClockHandle
 * @typedef {MemoryHandle|DomHandle|EventHandle|UIHandle|StreamHandle|StorageHandle|CSSHandle|RouteHandle|ClockHandle} FileHandle
 */
export type SourcePosition = {
    offset: number;
    line: number;
    column: number;
};
export type SourceRange = {
    start: SourcePosition;
    end: SourcePosition;
};
export type Token = {
    type: string;
    value: string;
    range: SourceRange;
    sigil?: string;
    interpolate?: boolean;
    flags?: string;
    number?: number;
};
export type LiteralExpression = {
    type: 'literal';
    value: any;
    range: SourceRange;
};
export type StringExpression = {
    type: 'string';
    value: string;
    interpolate: boolean;
    range: SourceRange;
};
export type RegexExpression = {
    type: 'regex';
    pattern: string;
    flags: string;
    range: SourceRange;
};
export type VariableExpression = {
    type: 'variable';
    sigil: string;
    name: string;
    range: SourceRange;
};
export type BareExpression = {
    type: 'bare';
    name: string;
    range: SourceRange;
};
export type ArrayLastExpression = {
    type: 'arrayLast';
    name: string;
    range: SourceRange;
};
export type ListExpression = {
    type: 'list';
    items: Expression[];
    range: SourceRange;
};
export type IndexExpression = {
    type: 'index';
    target: Expression;
    index: Expression;
    range: SourceRange;
};
export type HashIndexExpression = {
    type: 'hashIndex';
    target: Expression;
    key: Expression;
    range: SourceRange;
};
export type ReadExpression = {
    type: 'read';
    handle: string;
    range: SourceRange;
};
export type AssignExpression = {
    type: 'assign';
    left: Expression;
    right: Expression;
    range: SourceRange;
};
export type UpdateExpression = {
    type: 'update';
    op: string;
    argument: Expression;
    range: SourceRange;
};
export type UnaryExpression = {
    type: 'unary';
    op: string;
    value: Expression;
    range: SourceRange;
};
export type BinaryExpression = {
    type: 'binary';
    op: string;
    left: Expression;
    right: Expression;
    range: SourceRange;
};
export type CallExpression = {
    type: 'call';
    name: string;
    args: Expression[];
    range: SourceRange;
};
export type Expression = LiteralExpression | StringExpression | RegexExpression | VariableExpression | BareExpression | ArrayLastExpression | ListExpression | IndexExpression | HashIndexExpression | ReadExpression | AssignExpression | UpdateExpression | UnaryExpression | BinaryExpression | CallExpression;
export type ExpressionStatement = {
    type: 'expressionStatement';
    expression: Expression;
    range: SourceRange;
};
export type SubStatement = {
    type: 'sub';
    name: string;
    body: Statement[];
    range: SourceRange;
};
export type OpenStatement = {
    type: 'open';
    handle: string;
    spec: Expression;
    range: SourceRange;
};
export type SelectStatement = {
    type: 'select';
    handle: string;
    range: SourceRange;
};
export type PrintStatement = {
    type: 'print';
    handle: string | null;
    values: Expression[];
    range: SourceRange;
};
export type ReturnStatement = {
    type: 'return';
    value: Expression | null;
    range: SourceRange;
};
export type ModifierStatement = {
    type: 'modifier';
    negate: boolean;
    test: Expression;
    statement: Statement;
    range: SourceRange;
};
export type IfStatement = {
    type: 'if';
    negate: boolean;
    test: Expression;
    consequent: Statement[];
    alternate: Statement[];
    range: SourceRange;
};
export type WhileStatement = {
    type: 'while';
    test: Expression;
    body: Statement[];
    range: SourceRange;
};
export type Statement = ExpressionStatement | SubStatement | OpenStatement | SelectStatement | PrintStatement | ReturnStatement | ModifierStatement | IfStatement | WhileStatement;
export type Program = {
    type: 'program';
    body: Statement[];
    range: SourceRange;
};
export type MemoryHandle = {
    type: 'memory';
    value: string;
    spec?: any;
};
export type DomHandle = {
    type: 'dom-in' | 'dom-out';
    element: Element;
};
export type EventHandle = {
    type: 'event';
    element: Element;
    event: string;
    cleanups: Set<() => void>;
};
export type UIHandle = {
    type: 'ui';
    element: Element;
    renderer: import('./ui.js').DOMUIRenderer;
};
export type StreamHandle = {
    type: 'stream';
    name: string;
    adapter: {
        write: (value: string) => any;
        close?: () => void;
    };
    queue: string[];
    watchers: Set<Function>;
    ended: boolean;
    closed: boolean;
};
export type StorageArea = {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => any;
    removeItem: (key: string) => any;
};
export type StorageHandle = {
    type: 'storage';
    area: StorageArea;
    key: string;
    writable: boolean;
    value: string;
};
export type CSSSheet = {
    element: HTMLStyleElement;
    value: string;
};
export type CSSHandle = {
    type: 'css';
    sheet: CSSSheet;
};
export type RouteHandle = {
    type: 'route';
    mode: 'hash' | 'history';
    navigation: any;
    value: string;
    watchers: Set<Function>;
    removeListener: (() => void) | null;
};
export type ClockHandle = {
    type: 'clock';
    interval: number;
    clock: {
        now: () => number;
        setInterval: (callback: Function, interval: number) => any;
        clearInterval: (timer: any) => void;
    };
    watchers: Set<Function>;
    timer: any;
};
export type FileHandle = MemoryHandle | DomHandle | EventHandle | UIHandle | StreamHandle | StorageHandle | CSSHandle | RouteHandle | ClockHandle;
export {};

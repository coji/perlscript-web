export type UIText = {
    type: 'text';
    value: string;
    dom?: Node;
};
export type UIBinding = {
    property: string;
    variable: string;
    value: any;
};
export type UIEvent = {
    sub: string;
    args: any[];
};
export type UIElement = {
    type: 'element';
    tag: string;
    attrs: Record<string, any>;
    events: Record<string, UIEvent>;
    bindings: UIBinding[];
    key: string | null;
    children: UINode[];
    dom?: Element;
    cleanups?: Array<() => void>;
};
export type UINode = UIText | UIElement;
export type UIRoot = {
    type: 'root';
    children: UINode[];
};
/** @typedef {{type:'text',value:string,dom?:Node}} UIText */
/** @typedef {{property:string,variable:string,value:*}} UIBinding */
/** @typedef {{sub:string,args:*[]}} UIEvent */
/** @typedef {{type:'element',tag:string,attrs:Record<string,*>,events:Record<string,UIEvent>,bindings:UIBinding[],key:string|null,children:UINode[],dom?:Element,cleanups?:Array<()=>void>}} UIElement */
/** @typedef {UIText|UIElement} UINode */
/** @typedef {{type:'root',children:UINode[]}} UIRoot */
export declare class UITreeBuilder {
    /** @type {UIRoot} */
    root: UIRoot;
    /** @type {Array<UIRoot|UIElement>} */
    stack: Array<UIRoot | UIElement>;
    constructor();
    /** @returns {UIRoot|UIElement} */
    current(): UIRoot | UIElement;
    /** @param {*} tagValue @param {*[]} attributePairs */
    begin(tagValue: any, attributePairs: any[]): void;
    /** @param {*} value */
    text(value: any): void;
    /** @param {*} eventValue @param {*} subValue @param {*[]} args */
    on(eventValue: any, subValue: any, args?: any[]): void;
    /** @param {*} value */
    key(value: any): void;
    /** @param {*} propertyValue @param {*} variableValue @param {*} value */
    bind(propertyValue: any, variableValue: any, value: any): void;
    end(): void;
    /** @returns {UIRoot} */
    finish(): UIRoot;
    /** @param {UIRoot|UIElement} parent */
    validateKeys(parent: UIRoot | UIElement): void;
    /** @param {string} operation @returns {UIElement} */
    element(operation: string): UIElement;
}
export declare class DOMUIRenderer {
    document: Document;
    root: Element;
    /** @type {UIRoot|null} */
    tree: UIRoot | null;
    /** @param {Document} document @param {Element} root */
    constructor(document: Document, root: Element);
    /**
     * @param {UIRoot} tree
     * @param {(sub:string|null,args:*[],updates:Array<[string,*]>)=>void} dispatch
     */
    commit(tree: UIRoot, dispatch: (sub: string | null, args: any[], updates: Array<[string, any]>) => void): void;
    /** @param {UINode} node @param {(sub:string|null,args:*[],updates:Array<[string,*]>)=>void} dispatch @returns {Node} */
    create(node: UINode, dispatch: (sub: string | null, args: any[], updates: Array<[string, any]>) => void): Node;
    /**
     * @param {Element} parent @param {UINode[]} oldChildren @param {UINode[]} newChildren
     * @param {(sub:string|null,args:*[],updates:Array<[string,*]>)=>void} dispatch
     */
    patchChildren(parent: Element, oldChildren: UINode[], newChildren: UINode[], dispatch: (sub: string | null, args: any[], updates: Array<[string, any]>) => void): void;
    /** @param {UINode} oldNode @param {UINode} newNode */
    compatible(oldNode: UINode, newNode: UINode): boolean;
    /** @param {UINode} oldNode @param {UINode} newNode @param {(sub:string|null,args:*[],updates:Array<[string,*]>)=>void} dispatch @returns {Node} */
    patch(oldNode: UINode, newNode: UINode, dispatch: (sub: string | null, args: any[], updates: Array<[string, any]>) => void): Node;
    /** @param {UIElement|null} oldNode @param {UIElement} node @param {(sub:string|null,args:*[],updates:Array<[string,*]>)=>void} dispatch */
    patchElement(oldNode: UIElement | null, node: UIElement, dispatch: (sub: string | null, args: any[], updates: Array<[string, any]>) => void): void;
    /** @param {UINode} node */
    remove(node: UINode): void;
    /** @param {UINode} node */
    cleanup(node: UINode): void;
    dispose(): void;
}

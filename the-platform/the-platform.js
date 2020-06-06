function relativeUrl(url, baseUrl) {
  return new URL(url, baseUrl).href;
}

async function importTemplate(url, options) {
  const res = await fetch(relativeUrl(url, options.baseUrl));
  const content = await res.text();
  const template = document.createElement("template");
  template.innerHTML = content;
  for (const item of template.content.querySelectorAll("link[href]")) {
    item.setAttribute(
      "href",
      relativeUrl(item.getAttribute("href"), options.baseUrl)
    );
  }
  return template;
}

async function importStyle(url, options) {
  const res = await fetch(relativeUrl(url, options.baseUrl));
  const content = await res.text();
  const style = document.createElement("style");
  style.textContent = content;
  return style;
}

export function createModule(initFn) {
  let inited = false;
  return async (...args) => {
    if (inited) {
      return;
    }
    inited = true;
    await initFn(...args);
  };
}

export class Component extends HTMLElement {
  constructor() {
    super();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    this[name].set(newValue);
  }
}

export class Template {
  #templateTag;

  constructor(templateTag) {
    this.#templateTag = templateTag;
  }

  async init() {}

  createDOM() {
    return this.#templateTag.content.cloneNode(true);
  }
}

export class StringTemplate {
  #templateTag;

  constructor(content, options) {
    this.#templateTag = document.createElement("template");
    this.#templateTag.innerHTML = content;
    for (const item of this.#templateTag.content.querySelectorAll(
      "link[href]"
    )) {
      item.setAttribute(
        "href",
        relativeUrl(item.getAttribute("href"), options.baseUrl)
      );
    }
  }

  createDOM() {
    return this.#templateTag.content.cloneNode(true);
  }
}

export class RemoteTemplate {
  #url;
  #options;
  #templateTag;

  constructor(url, options) {
    this.#url = url;
    this.#options = options;
    this.#templateTag = null;
  }

  async init() {
    this.#templateTag = await importTemplate(this.#url, {
      baseUrl: this.#options.baseUrl,
    });
  }

  getInnerTemplate(id) {
    return new Template(
      this.#templateTag.content.querySelector(`template#${id}`)
    );
  }

  createDOM() {
    return this.#templateTag.content.cloneNode(true);
  }
}

export class StringStyle {
  #styleTag;

  constructor(content) {
    this.#styleTag = document.createElement("style");
    this.#styleTag.textContent = content;
  }

  createDOM() {
    return this.#styleTag.cloneNode(true);
  }
}

export class RemoteStyle {
  #url;
  #options;
  #styleTag;

  constructor(url, options) {
    this.#url = url;
    this.#options = options;
    this.#styleTag = null;
  }

  async init() {
    this.#styleTag = await importStyle(this.#url, {
      baseUrl: this.#options.baseUrl,
    });
  }

  createDOM() {
    return this.#styleTag.cloneNode(true);
  }
}

export class LazyRef extends EventTarget {
  #renderer;
  #selector;

  constructor(renderer, selector) {
    super();
    this.#renderer = renderer;
    this.#selector = selector;
    this.el = null;
    this.ready = false;

    if (renderer.rendered) {
      this.#init();
    } else {
      renderer.addEventListener("rendered", this.#init, { once: true });
    }
  }

  onReady(cb) {
    if (this.ready) {
      cb();
    } else {
      this.addEventListener("ready", cb, { once: true });
    }
  }

  #init = () => {
    this.el = this.#renderer.querySelector(this.#selector);
    this.ready = true;
    this.dispatchEvent(new CustomEvent("ready"));
  };
}

export class ShadowDomRenderer extends EventTarget {
  #ref;
  #children;
  #shadow;

  constructor(ref, children) {
    super();
    this.rendered = false;
    this.#ref = ref;
    this.#children = Array.isArray(children) ? children : [children];
  }

  render() {
    this.#ref.onReady(this.#init);
  }

  #init = () => {
    this.#shadow = this.#ref.el.attachShadow({ mode: "open" });

    for (const child of this.#children) {
      this.#shadow.appendChild(child.createDOM());
    }

    this.rendered = true;
    this.dispatchEvent(new CustomEvent("rendered"));
  };

  querySelector(selector) {
    return this.#shadow.querySelector(selector);
  }
}

class Registry {
  async register(ComponentClass) {
    if (ComponentClass.deps) {
      await Promise.all(ComponentClass.deps.map((dep) => dep.init()));
    }
    customElements.define(ComponentClass.tag, ComponentClass);
  }
}

const registry = new Registry();

export async function register(ComponentClass) {
  return registry.register(ComponentClass);
}

export class Property extends EventTarget {
  #value;

  constructor(defaultValue) {
    super();
    this.#value = defaultValue;
  }

  get() {
    return this.#value;
  }

  set(value) {
    this.#value = value;
    this.dispatchEvent(
      new CustomEvent("changed", {
        detail: {
          value,
        },
      })
    );
  }
}

export class ComputedProperty extends EventTarget {
  #value;
  #fn;
  #deps;

  constructor(fn, ...deps) {
    super();
    this.#fn = fn;
    this.#deps = deps;
    this.#update();
    for (const dep of deps) {
      dep.addEventListener("changed", this.#update);
    }
  }

  get() {
    return this.#value;
  }

  #update = () => {
    this.#value = this.#fn(...this.#deps.map((d) => d.get()));
    this.dispatchEvent(
      new CustomEvent("changed", {
        detail: {
          value: this.#value,
        },
      })
    );
  };
}

export class DownLink {
  #property;
  #reference;
  #referenceAttribute;
  #referenceProperty;

  constructor(options) {
    const {
      property,
      reference,
      referenceAttribute,
      referenceProperty,
    } = options;

    this.#property = property;
    this.#reference = reference;
    this.#referenceAttribute = referenceAttribute;
    this.#referenceProperty = referenceProperty;

    reference.onReady(this.#init);
  }

  #init = () => {
    this.#handler();
    this.#property.addEventListener("changed", this.#handler);
  };

  #handler = () => {
    if (this.#referenceAttribute) {
      this.#reference.el.setAttribute(
        this.#referenceAttribute,
        this.#property.get()
      );
    } else {
      this.#reference.el[this.#referenceProperty] = this.#property.get();
    }
  };
}

export class UpLink extends EventTarget {
  #reference;
  #referenceEventName;
  #valueGetter;
  #property;

  constructor(options) {
    super();

    const { reference, referenceEventName, valueGetter, property } = options;

    this.#reference = reference;
    this.#referenceEventName = referenceEventName;
    this.#valueGetter = valueGetter;
    this.#property = property;

    reference.onReady(this.#init);
  }

  #init = () => {
    this.#reference.el.addEventListener(this.#referenceEventName, (event) => {
      const value = this.#valueGetter(event);
      this.#property.set(value);
      this.dispatchEvent(
        new CustomEvent("triggered", {
          detail: {
            value,
          },
        })
      );
    });
  };
}

export class TwoWayLink extends EventTarget {
  constructor(options) {
    super();
    const {
      property,
      reference,
      referenceAttribute,
      referenceProperty,
      referenceEventName,
      valueGetter,
    } = options;

    this.down = new DownLink({
      property,
      reference,
      referenceAttribute,
      referenceProperty,
    });
    this.up = new UpLink({
      reference,
      referenceEventName,
      valueGetter,
      property,
    });

    this.up.addEventListener("triggered", (event) => {
      this.dispatchEvent(
        new CustomEvent("up-link-triggered", {
          detail: {
            value: event.detail.value,
          },
        })
      );
    });
  }
}

export class TextContentRenderer extends EventTarget {
  #ref;
  #value;

  constructor(ref, value) {
    super();
    this.rendered = false;
    this.#ref = ref;
    this.#value = value;

    ref.onReady(this.#init);
  }

  destroy() {
    this.#value.removeEventListener("changed", this.#handler);
  }

  #init = () => {
    this.#value.addEventListener("changed", this.#handler);
    this.#handler();
    this.rendered = true;
    this.dispatchEvent(new CustomEvent("rendered"));
  };

  #handler = () => {
    this.#ref.el.textContent = this.#value.get();
  };
}

export class ListRenderer extends EventTarget {
  #rootRef;
  #template;
  #list;
  #itemRenderer;
  #prev;

  constructor(options) {
    super();

    const { rootRef, template, list, itemRenderer } = options;

    this.rendered = false;
    this.#rootRef = rootRef;
    this.#template = template;
    this.#list = list;
    this.#itemRenderer = itemRenderer;
    this.#prev = [];

    rootRef.onReady(this.#init);
  }

  destroy() {
    this.#list.removeEventListener("changed", this.#render);
  }

  #init = () => {
    this.#render();
    this.#list.addEventListener("changed", this.#render);

    this.rendered = true;
    this.dispatchEvent(new CustomEvent("rendered"));
  };

  #render = () => {
    const arr = this.#list.get();

    const itemsToRemove = this.#prev.slice(arr.length);
    const itemsToUpdate = this.#prev.slice(0, arr.length);
    const itemsToAdd = arr.slice(this.#prev.length);

    for (const { addedNodes, itemRenderer } of itemsToRemove) {
      for (const node of addedNodes) {
        this.#rootRef.el.removeChild(node);
      }
      itemRenderer.destroy();
    }

    for (let i = 0; i < itemsToUpdate.length; i++) {
      const { property } = itemsToUpdate[i];
      property.set(arr[i]);
    }

    for (const item of itemsToAdd) {
      const nodesLengthBefore = this.#rootRef.el.childNodes.length;
      this.#rootRef.el.appendChild(this.#template.createDOM());
      const addedNodes = Array.from(this.#rootRef.el.childNodes).slice(
        nodesLengthBefore
      );
      const property = new Property(item);
      const itemRenderer = this.#itemRenderer(new Nodes(addedNodes), property);
      this.#prev.push({ addedNodes, property, itemRenderer });
    }
  };
}

export class Nodes {
  #nodes;

  constructor(nodes) {
    this.#nodes = nodes;
  }

  querySelector(selector) {
    for (const node of this.#nodes) {
      if (node instanceof Element) {
        if (node.matches(selector)) {
          return node;
        }
        const result = node.querySelector(selector);
        if (result) {
          return result;
        }
      }
    }
    return null;
  }
}

export class ElementRef extends EventTarget {
  constructor(el) {
    super();
    this.el = el;
    this.ready = true;
  }

  onReady(cb) {
    cb();
  }
}

export class CondRenderer extends EventTarget {
  #ref;
  #value;
  #noop;
  #parent;
  #el;
  #attached;

  constructor(ref, value) {
    super();
    this.rendered = false;
    this.#ref = ref;
    this.#value = value;
    this.#noop = document.createTextNode("");
    this.#parent = null;
    this.#el = null;
    this.#attached = false;

    ref.onReady(this.#init);
  }

  destroy() {
    this.#value.removeEventListener("changed", this.#handler);
  }

  #init = () => {
    this.#value.addEventListener("changed", this.#handler);
    this.#el = this.#ref.el;
    this.#parent = this.#el.parentNode;
    this.#attached = true;
    this.#handler();
    this.rendered = true;
    this.dispatchEvent(new CustomEvent("rendered"));
  };

  #handler = () => {
    const shouldBeAttached = Boolean(this.#value.get());

    if (this.#attached && !shouldBeAttached) {
      this.#parent.replaceChild(this.#noop, this.#el);
      this.#attached = false;
    }

    if (!this.#attached && shouldBeAttached) {
      this.#parent.replaceChild(this.#el, this.#noop);
      this.#attached = true;
    }
  };
}

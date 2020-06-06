import {
  Component,
  StringTemplate,
  StringStyle,
  Property,
  ShadowDomRenderer,
  ElementRef,
  LazyRef,
  register,
  createModule,
} from "../../the-platform/the-platform.js";

class CianInput extends Component {
  static tag = "cian-input";
  static template = new StringTemplate("<input>");
  static style = new StringStyle(`
    input {
      border-color: blue;
    }  
  `);
  static observedAttributes = ["value"];

  constructor() {
    super();

    this.value = new Property(this.getAttribute("value"));

    this.renderer = new ShadowDomRenderer(new ElementRef(this), [
      CianInput.style,
      CianInput.template,
    ]);

    this.inputRef = new LazyRef(this.renderer, "input");
  }

  connectedCallback() {
    this.renderer.render();

    this.inputRef.onReady(() => {
      this.value.addEventListener("changed", this.#valueChanged);
      this.inputRef.el.addEventListener("input", this.#inputChanged);
    });
  }

  disconnectedCallback() {
    this.value.removeEventListener("changed", this.#valueChanged);
    this.inputRef.el.removeEventListener("input", this.#inputChanged);
  }

  #valueChanged = (event) => {
    this.inputRef.el.value = event.detail.value;
  };

  #inputChanged = (event) => {
    this.value.set(event.target.value);
    this.dispatchEvent(
      new CustomEvent("on-value-change", {
        detail: {
          value: event.target.value,
        },
      })
    );
  };
}

export const init = createModule(async () => {
  await register(CianInput);
});

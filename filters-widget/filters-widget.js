import {
  createModule,
  Component,
  register,
  RemoteTemplate,
  Property,
  ShadowDomRenderer,
  ElementRef,
  RemoteStyle,
  TwoWayLink,
  LazyRef,
} from "../the-platform/the-platform.js";
import { init as initInput } from "https://cdn.cian.site/ui-kit/input/input.js";

class CianFilters extends Component {
  static tag = "cian-filters";
  static template = new RemoteTemplate("filters-widget.html", {
    baseUrl: import.meta.url,
  });
  static style = new RemoteStyle("filters-widget.css", {
    baseUrl: import.meta.url,
  });
  static deps = [CianFilters.template, CianFilters.style];
  static observedAttributes = ["query"];

  constructor() {
    super();
    this.query = new Property(this.getAttribute("query"));
    this.renderer = new ShadowDomRenderer(new ElementRef(this), [
      CianFilters.style,
      CianFilters.template,
    ]);
    this.inputRef = new LazyRef(this.renderer, "cian-input");

    this.valueLink = new TwoWayLink({
      property: this.query,
      reference: this.inputRef,
      referenceAttribute: "value",
      referenceEventName: "on-value-change",
      valueGetter: (event) => event.detail.value,
    });

    this.valueLink.addEventListener("up-link-triggered", (event) => {
      this.dispatchEvent(
        new CustomEvent("on-query-change", {
          detail: {
            value: event.detail.value,
          },
        })
      );
    });
  }

  connectedCallback() {
    this.renderer.render();
  }
}

export const init = createModule(async () => {
  await Promise.all([initInput(), register(CianFilters)]);
});

import {
  Component,
  createModule,
  register,
  RemoteTemplate,
  Property,
  LazyRef,
  ShadowDomRenderer,
  ElementRef,
  RemoteStyle,
  TextContentRenderer,
} from "../the-platform/the-platform.js";

class CianSerpResults extends Component {
  static tag = "cian-serp-results";
  static template = new RemoteTemplate("serp-results-widget.html", {
    baseUrl: import.meta.url,
  });
  static style = new RemoteStyle("serp-results-widget.css", {
    baseUrl: import.meta.url,
  });
  static deps = [CianSerpResults.template, CianSerpResults.style];
  static observedAttributes = ["query"];

  constructor() {
    super();

    this.query = new Property(this.getAttribute("query"));
    this.renderer = new ShadowDomRenderer(new ElementRef(this), [
      CianSerpResults.style,
      CianSerpResults.template,
    ]);
    this.queryRef = new LazyRef(this.renderer, "#query");
    this.queryRefRenderer = new TextContentRenderer(this.queryRef, this.query);
  }

  connectedCallback() {
    this.renderer.render();
  }
}

export const init = createModule(async () => {
  register(CianSerpResults);
});

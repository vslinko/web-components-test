import { init as initFiltersWidget } from "../filters-widget/filters-widget.js";
import { init as initSerpResultsWidget } from "../serp-results-widget/serp-results-widget.js";
import { DownLink, ElementRef } from "../the-platform/the-platform.js";

async function init() {
  try {
    await Promise.all([initFiltersWidget(), initSerpResultsWidget()]);

    new DownLink({
      property: document.querySelector("cian-filters").query,
      reference: new ElementRef(document.querySelector("cian-serp-results")),
      referenceAttribute: "query",
    });
  } catch (err) {
    console.error(err);
  }
}

init();

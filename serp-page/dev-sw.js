const mappings = [
  {
    from: "https://cdn.cian.site/ui-kit/",
    to: "http://localhost:8000/ui-kit/",
  },
  {
    from: "https://cdn.cian.site/the-platform/",
    to: "http://localhost:8000/the-platform/",
  },
];

self.addEventListener("fetch", (event) => {
  for (const mapping of mappings) {
    if (event.request.url.startsWith(mapping.from)) {
      const req = new Request(
        event.request.url.replace(mapping.from, mapping.to)
      );
      event.respondWith(fetch(req));
      return;
    }
  }

  event.respondWith(fetch(event.request));
});

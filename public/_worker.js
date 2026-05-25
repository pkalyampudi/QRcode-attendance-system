export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      let response = await env.ASSETS.fetch(request);
      if (response.status === 404) {
        response = await env.ASSETS.fetch(new Request(new URL("/index.html", url.origin)));
      }
      return response;
    } catch (e) {
      return env.ASSETS.fetch(new Request(new URL("/index.html", url.origin)));
    }
  }
};

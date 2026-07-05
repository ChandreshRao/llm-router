var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// node_modules/hono/dist/compose.js
var compose = /* @__PURE__ */ __name((middleware, onError, onNotFound) => {
  return (context, next) => {
    let index = -1;
    return dispatch(0);
    async function dispatch(i) {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }
      index = i;
      let res;
      let isError = false;
      let handler;
      if (middleware[i]) {
        handler = middleware[i][0][0];
        context.req.routeIndex = i;
      } else {
        handler = i === middleware.length && next || void 0;
      }
      if (handler) {
        try {
          res = await handler(context, () => dispatch(i + 1));
        } catch (err) {
          if (err instanceof Error && onError) {
            context.error = err;
            res = await onError(err, context);
            isError = true;
          } else {
            throw err;
          }
        }
      } else {
        if (context.finalized === false && onNotFound) {
          res = await onNotFound(context);
        }
      }
      if (res && (context.finalized === false || isError)) {
        context.res = res;
      }
      return context;
    }
    __name(dispatch, "dispatch");
  };
}, "compose");

// node_modules/hono/dist/request/constants.js
var GET_MATCH_RESULT = /* @__PURE__ */ Symbol();

// node_modules/hono/dist/utils/body.js
var parseBody = /* @__PURE__ */ __name(async (request, options = /* @__PURE__ */ Object.create(null)) => {
  const { all = false, dot = false } = options;
  const headers = request instanceof HonoRequest ? request.raw.headers : request.headers;
  const contentType = headers.get("Content-Type");
  if (contentType?.startsWith("multipart/form-data") || contentType?.startsWith("application/x-www-form-urlencoded")) {
    return parseFormData(request, { all, dot });
  }
  return {};
}, "parseBody");
async function parseFormData(request, options) {
  const formData = await request.formData();
  if (formData) {
    return convertFormDataToBodyData(formData, options);
  }
  return {};
}
__name(parseFormData, "parseFormData");
function convertFormDataToBodyData(formData, options) {
  const form = /* @__PURE__ */ Object.create(null);
  formData.forEach((value, key) => {
    const shouldParseAllValues = options.all || key.endsWith("[]");
    if (!shouldParseAllValues) {
      form[key] = value;
    } else {
      handleParsingAllValues(form, key, value);
    }
  });
  if (options.dot) {
    Object.entries(form).forEach(([key, value]) => {
      const shouldParseDotValues = key.includes(".");
      if (shouldParseDotValues) {
        handleParsingNestedValues(form, key, value);
        delete form[key];
      }
    });
  }
  return form;
}
__name(convertFormDataToBodyData, "convertFormDataToBodyData");
var handleParsingAllValues = /* @__PURE__ */ __name((form, key, value) => {
  if (form[key] !== void 0) {
    if (Array.isArray(form[key])) {
      ;
      form[key].push(value);
    } else {
      form[key] = [form[key], value];
    }
  } else {
    if (!key.endsWith("[]")) {
      form[key] = value;
    } else {
      form[key] = [value];
    }
  }
}, "handleParsingAllValues");
var handleParsingNestedValues = /* @__PURE__ */ __name((form, key, value) => {
  if (/(?:^|\.)__proto__\./.test(key)) {
    return;
  }
  let nestedForm = form;
  const keys = key.split(".");
  keys.forEach((key2, index) => {
    if (index === keys.length - 1) {
      nestedForm[key2] = value;
    } else {
      if (!nestedForm[key2] || typeof nestedForm[key2] !== "object" || Array.isArray(nestedForm[key2]) || nestedForm[key2] instanceof File) {
        nestedForm[key2] = /* @__PURE__ */ Object.create(null);
      }
      nestedForm = nestedForm[key2];
    }
  });
}, "handleParsingNestedValues");

// node_modules/hono/dist/utils/url.js
var splitPath = /* @__PURE__ */ __name((path) => {
  const paths = path.split("/");
  if (paths[0] === "") {
    paths.shift();
  }
  return paths;
}, "splitPath");
var splitRoutingPath = /* @__PURE__ */ __name((routePath) => {
  const { groups, path } = extractGroupsFromPath(routePath);
  const paths = splitPath(path);
  return replaceGroupMarks(paths, groups);
}, "splitRoutingPath");
var extractGroupsFromPath = /* @__PURE__ */ __name((path) => {
  const groups = [];
  path = path.replace(/\{[^}]+\}/g, (match2, index) => {
    const mark = `@${index}`;
    groups.push([mark, match2]);
    return mark;
  });
  return { groups, path };
}, "extractGroupsFromPath");
var replaceGroupMarks = /* @__PURE__ */ __name((paths, groups) => {
  for (let i = groups.length - 1; i >= 0; i--) {
    const [mark] = groups[i];
    for (let j = paths.length - 1; j >= 0; j--) {
      if (paths[j].includes(mark)) {
        paths[j] = paths[j].replace(mark, groups[i][1]);
        break;
      }
    }
  }
  return paths;
}, "replaceGroupMarks");
var patternCache = {};
var getPattern = /* @__PURE__ */ __name((label, next) => {
  if (label === "*") {
    return "*";
  }
  const match2 = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (match2) {
    const cacheKey = `${label}#${next}`;
    if (!patternCache[cacheKey]) {
      if (match2[2]) {
        patternCache[cacheKey] = next && next[0] !== ":" && next[0] !== "*" ? [cacheKey, match2[1], new RegExp(`^${match2[2]}(?=/${next})`)] : [label, match2[1], new RegExp(`^${match2[2]}$`)];
      } else {
        patternCache[cacheKey] = [label, match2[1], true];
      }
    }
    return patternCache[cacheKey];
  }
  return null;
}, "getPattern");
var tryDecode = /* @__PURE__ */ __name((str, decoder) => {
  try {
    return decoder(str);
  } catch {
    return str.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match2) => {
      try {
        return decoder(match2);
      } catch {
        return match2;
      }
    });
  }
}, "tryDecode");
var tryDecodeURI = /* @__PURE__ */ __name((str) => tryDecode(str, decodeURI), "tryDecodeURI");
var getPath = /* @__PURE__ */ __name((request) => {
  const url = request.url;
  const start = url.indexOf("/", url.indexOf(":") + 4);
  let i = start;
  for (; i < url.length; i++) {
    const charCode = url.charCodeAt(i);
    if (charCode === 37) {
      const queryIndex = url.indexOf("?", i);
      const hashIndex = url.indexOf("#", i);
      const end = queryIndex === -1 ? hashIndex === -1 ? void 0 : hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex);
      const path = url.slice(start, end);
      return tryDecodeURI(path.includes("%25") ? path.replace(/%25/g, "%2525") : path);
    } else if (charCode === 63 || charCode === 35) {
      break;
    }
  }
  return url.slice(start, i);
}, "getPath");
var getPathNoStrict = /* @__PURE__ */ __name((request) => {
  const result = getPath(request);
  return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
}, "getPathNoStrict");
var mergePath = /* @__PURE__ */ __name((base, sub, ...rest) => {
  if (rest.length) {
    sub = mergePath(sub, ...rest);
  }
  return `${base?.[0] === "/" ? "" : "/"}${base}${sub === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub?.[0] === "/" ? sub.slice(1) : sub}`}`;
}, "mergePath");
var checkOptionalParameter = /* @__PURE__ */ __name((path) => {
  if (path.charCodeAt(path.length - 1) !== 63 || !path.includes(":")) {
    return null;
  }
  const segments = path.split("/");
  const results = [];
  let basePath = "";
  segments.forEach((segment) => {
    if (segment !== "" && !/\:/.test(segment)) {
      basePath += "/" + segment;
    } else if (/\:/.test(segment)) {
      if (/\?/.test(segment)) {
        if (results.length === 0 && basePath === "") {
          results.push("/");
        } else {
          results.push(basePath);
        }
        const optionalSegment = segment.replace("?", "");
        basePath += "/" + optionalSegment;
        results.push(basePath);
      } else {
        basePath += "/" + segment;
      }
    }
  });
  return results.filter((v, i, a) => a.indexOf(v) === i);
}, "checkOptionalParameter");
var _decodeURI = /* @__PURE__ */ __name((value) => {
  if (!/[%+]/.test(value)) {
    return value;
  }
  if (value.indexOf("+") !== -1) {
    value = value.replace(/\+/g, " ");
  }
  return value.indexOf("%") !== -1 ? tryDecode(value, decodeURIComponent_) : value;
}, "_decodeURI");
var _getQueryParam = /* @__PURE__ */ __name((url, key, multiple) => {
  let encoded;
  if (!multiple && key && !/[%+]/.test(key)) {
    let keyIndex2 = url.indexOf("?", 8);
    if (keyIndex2 === -1) {
      return void 0;
    }
    if (!url.startsWith(key, keyIndex2 + 1)) {
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    while (keyIndex2 !== -1) {
      const trailingKeyCode = url.charCodeAt(keyIndex2 + key.length + 1);
      if (trailingKeyCode === 61) {
        const valueIndex = keyIndex2 + key.length + 2;
        const endIndex = url.indexOf("&", valueIndex);
        return _decodeURI(url.slice(valueIndex, endIndex === -1 ? void 0 : endIndex));
      } else if (trailingKeyCode == 38 || isNaN(trailingKeyCode)) {
        return "";
      }
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    encoded = /[%+]/.test(url);
    if (!encoded) {
      return void 0;
    }
  }
  const results = {};
  encoded ??= /[%+]/.test(url);
  let keyIndex = url.indexOf("?", 8);
  while (keyIndex !== -1) {
    const nextKeyIndex = url.indexOf("&", keyIndex + 1);
    let valueIndex = url.indexOf("=", keyIndex);
    if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) {
      valueIndex = -1;
    }
    let name = url.slice(
      keyIndex + 1,
      valueIndex === -1 ? nextKeyIndex === -1 ? void 0 : nextKeyIndex : valueIndex
    );
    if (encoded) {
      name = _decodeURI(name);
    }
    keyIndex = nextKeyIndex;
    if (name === "") {
      continue;
    }
    let value;
    if (valueIndex === -1) {
      value = "";
    } else {
      value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? void 0 : nextKeyIndex);
      if (encoded) {
        value = _decodeURI(value);
      }
    }
    if (multiple) {
      if (!(results[name] && Array.isArray(results[name]))) {
        results[name] = [];
      }
      ;
      results[name].push(value);
    } else {
      results[name] ??= value;
    }
  }
  return key ? results[key] : results;
}, "_getQueryParam");
var getQueryParam = _getQueryParam;
var getQueryParams = /* @__PURE__ */ __name((url, key) => {
  return _getQueryParam(url, key, true);
}, "getQueryParams");
var decodeURIComponent_ = decodeURIComponent;

// node_modules/hono/dist/request.js
var tryDecodeURIComponent = /* @__PURE__ */ __name((str) => tryDecode(str, decodeURIComponent_), "tryDecodeURIComponent");
var HonoRequest = class {
  static {
    __name(this, "HonoRequest");
  }
  /**
   * `.raw` can get the raw Request object.
   *
   * @see {@link https://hono.dev/docs/api/request#raw}
   *
   * @example
   * ```ts
   * // For Cloudflare Workers
   * app.post('/', async (c) => {
   *   const metadata = c.req.raw.cf?.hostMetadata?
   *   ...
   * })
   * ```
   */
  raw;
  #validatedData;
  // Short name of validatedData
  #matchResult;
  routeIndex = 0;
  /**
   * `.path` can get the pathname of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#path}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const pathname = c.req.path // `/about/me`
   * })
   * ```
   */
  path;
  bodyCache = {};
  constructor(request, path = "/", matchResult = [[]]) {
    this.raw = request;
    this.path = path;
    this.#matchResult = matchResult;
    this.#validatedData = {};
  }
  param(key) {
    return key ? this.#getDecodedParam(key) : this.#getAllDecodedParams();
  }
  #getDecodedParam(key) {
    const paramKey = this.#matchResult[0][this.routeIndex][1][key];
    const param = this.#getParamValue(paramKey);
    return param && /\%/.test(param) ? tryDecodeURIComponent(param) : param;
  }
  #getAllDecodedParams() {
    const decoded = {};
    const keys = Object.keys(this.#matchResult[0][this.routeIndex][1]);
    for (const key of keys) {
      const value = this.#getParamValue(this.#matchResult[0][this.routeIndex][1][key]);
      if (value !== void 0) {
        decoded[key] = /\%/.test(value) ? tryDecodeURIComponent(value) : value;
      }
    }
    return decoded;
  }
  #getParamValue(paramKey) {
    return this.#matchResult[1] ? this.#matchResult[1][paramKey] : paramKey;
  }
  query(key) {
    return getQueryParam(this.url, key);
  }
  queries(key) {
    return getQueryParams(this.url, key);
  }
  header(name) {
    if (name) {
      return this.raw.headers.get(name) ?? void 0;
    }
    const headerData = {};
    this.raw.headers.forEach((value, key) => {
      headerData[key] = value;
    });
    return headerData;
  }
  async parseBody(options) {
    return parseBody(this, options);
  }
  #cachedBody = /* @__PURE__ */ __name((key) => {
    const { bodyCache, raw: raw2 } = this;
    const cachedBody = bodyCache[key];
    if (cachedBody) {
      return cachedBody;
    }
    const anyCachedKey = Object.keys(bodyCache)[0];
    if (anyCachedKey) {
      return bodyCache[anyCachedKey].then((body) => {
        if (anyCachedKey === "json") {
          body = JSON.stringify(body);
        }
        return new Response(body)[key]();
      });
    }
    return bodyCache[key] = raw2[key]();
  }, "#cachedBody");
  /**
   * `.json()` can parse Request body of type `application/json`
   *
   * @see {@link https://hono.dev/docs/api/request#json}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.json()
   * })
   * ```
   */
  json() {
    return this.#cachedBody("text").then((text) => JSON.parse(text));
  }
  /**
   * `.text()` can parse Request body of type `text/plain`
   *
   * @see {@link https://hono.dev/docs/api/request#text}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.text()
   * })
   * ```
   */
  text() {
    return this.#cachedBody("text");
  }
  /**
   * `.arrayBuffer()` parse Request body as an `ArrayBuffer`
   *
   * @see {@link https://hono.dev/docs/api/request#arraybuffer}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.arrayBuffer()
   * })
   * ```
   */
  arrayBuffer() {
    return this.#cachedBody("arrayBuffer");
  }
  /**
   * `.bytes()` parses the request body as a `Uint8Array`.
   *
   * @see {@link https://hono.dev/docs/api/request#bytes}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.bytes()
   * })
   * ```
   */
  bytes() {
    return this.#cachedBody("arrayBuffer").then((buffer) => new Uint8Array(buffer));
  }
  /**
   * Parses the request body as a `Blob`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.blob();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#blob
   */
  blob() {
    return this.#cachedBody("blob");
  }
  /**
   * Parses the request body as `FormData`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.formData();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#formdata
   */
  formData() {
    return this.#cachedBody("formData");
  }
  /**
   * Adds validated data to the request.
   *
   * @param target - The target of the validation.
   * @param data - The validated data to add.
   */
  addValidatedData(target, data) {
    this.#validatedData[target] = data;
  }
  valid(target) {
    return this.#validatedData[target];
  }
  /**
   * `.url()` can get the request url strings.
   *
   * @see {@link https://hono.dev/docs/api/request#url}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const url = c.req.url // `http://localhost:8787/about/me`
   *   ...
   * })
   * ```
   */
  get url() {
    return this.raw.url;
  }
  /**
   * `.method()` can get the method name of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#method}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const method = c.req.method // `GET`
   * })
   * ```
   */
  get method() {
    return this.raw.method;
  }
  get [GET_MATCH_RESULT]() {
    return this.#matchResult;
  }
  /**
   * `.matchedRoutes()` can return a matched route in the handler
   *
   * @deprecated
   *
   * Use matchedRoutes helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#matchedroutes}
   *
   * @example
   * ```ts
   * app.use('*', async function logger(c, next) {
   *   await next()
   *   c.req.matchedRoutes.forEach(({ handler, method, path }, i) => {
   *     const name = handler.name || (handler.length < 2 ? '[handler]' : '[middleware]')
   *     console.log(
   *       method,
   *       ' ',
   *       path,
   *       ' '.repeat(Math.max(10 - path.length, 0)),
   *       name,
   *       i === c.req.routeIndex ? '<- respond from here' : ''
   *     )
   *   })
   * })
   * ```
   */
  get matchedRoutes() {
    return this.#matchResult[0].map(([[, route]]) => route);
  }
  /**
   * `routePath()` can retrieve the path registered within the handler
   *
   * @deprecated
   *
   * Use routePath helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#routepath}
   *
   * @example
   * ```ts
   * app.get('/posts/:id', (c) => {
   *   return c.json({ path: c.req.routePath })
   * })
   * ```
   */
  get routePath() {
    return this.#matchResult[0].map(([[, route]]) => route)[this.routeIndex].path;
  }
};

// node_modules/hono/dist/utils/html.js
var HtmlEscapedCallbackPhase = {
  Stringify: 1,
  BeforeStream: 2,
  Stream: 3
};
var raw = /* @__PURE__ */ __name((value, callbacks) => {
  const escapedString = new String(value);
  escapedString.isEscaped = true;
  escapedString.callbacks = callbacks;
  return escapedString;
}, "raw");
var resolveCallback = /* @__PURE__ */ __name(async (str, phase, preserveCallbacks, context, buffer) => {
  if (typeof str === "object" && !(str instanceof String)) {
    if (!(str instanceof Promise)) {
      str = str.toString();
    }
    if (str instanceof Promise) {
      str = await str;
    }
  }
  const callbacks = str.callbacks;
  if (!callbacks?.length) {
    return Promise.resolve(str);
  }
  if (buffer) {
    buffer[0] += str;
  } else {
    buffer = [str];
  }
  const resStr = Promise.all(callbacks.map((c) => c({ phase, buffer, context }))).then(
    (res) => Promise.all(
      res.filter(Boolean).map((str2) => resolveCallback(str2, phase, false, context, buffer))
    ).then(() => buffer[0])
  );
  if (preserveCallbacks) {
    return raw(await resStr, callbacks);
  } else {
    return resStr;
  }
}, "resolveCallback");

// node_modules/hono/dist/context.js
var TEXT_PLAIN = "text/plain; charset=UTF-8";
var setDefaultContentType = /* @__PURE__ */ __name((contentType, headers) => {
  return {
    "Content-Type": contentType,
    ...headers
  };
}, "setDefaultContentType");
var createResponseInstance = /* @__PURE__ */ __name((body, init) => new Response(body, init), "createResponseInstance");
var Context = class {
  static {
    __name(this, "Context");
  }
  #rawRequest;
  #req;
  /**
   * `.env` can get bindings (environment variables, secrets, KV namespaces, D1 database, R2 bucket etc.) in Cloudflare Workers.
   *
   * @see {@link https://hono.dev/docs/api/context#env}
   *
   * @example
   * ```ts
   * // Environment object for Cloudflare Workers
   * app.get('*', async c => {
   *   const counter = c.env.COUNTER
   * })
   * ```
   */
  env = {};
  #var;
  finalized = false;
  /**
   * `.error` can get the error object from the middleware if the Handler throws an error.
   *
   * @see {@link https://hono.dev/docs/api/context#error}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   await next()
   *   if (c.error) {
   *     // do something...
   *   }
   * })
   * ```
   */
  error;
  #status;
  #executionCtx;
  #res;
  #layout;
  #renderer;
  #notFoundHandler;
  #preparedHeaders;
  #matchResult;
  #path;
  /**
   * Creates an instance of the Context class.
   *
   * @param req - The Request object.
   * @param options - Optional configuration options for the context.
   */
  constructor(req, options) {
    this.#rawRequest = req;
    if (options) {
      this.#executionCtx = options.executionCtx;
      this.env = options.env;
      this.#notFoundHandler = options.notFoundHandler;
      this.#path = options.path;
      this.#matchResult = options.matchResult;
    }
  }
  /**
   * `.req` is the instance of {@link HonoRequest}.
   */
  get req() {
    this.#req ??= new HonoRequest(this.#rawRequest, this.#path, this.#matchResult);
    return this.#req;
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#event}
   * The FetchEvent associated with the current request.
   *
   * @throws Will throw an error if the context does not have a FetchEvent.
   */
  get event() {
    if (this.#executionCtx && "respondWith" in this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no FetchEvent");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#executionctx}
   * The ExecutionContext associated with the current request.
   *
   * @throws Will throw an error if the context does not have an ExecutionContext.
   */
  get executionCtx() {
    if (this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no ExecutionContext");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#res}
   * The Response object for the current request.
   */
  get res() {
    return this.#res ||= createResponseInstance(null, {
      headers: this.#preparedHeaders ??= new Headers()
    });
  }
  /**
   * Sets the Response object for the current request.
   *
   * @param _res - The Response object to set.
   */
  set res(_res) {
    if (this.#res && _res) {
      _res = createResponseInstance(_res.body, _res);
      for (const [k, v] of this.#res.headers.entries()) {
        if (k === "content-type") {
          continue;
        }
        if (k === "set-cookie") {
          const cookies = this.#res.headers.getSetCookie();
          _res.headers.delete("set-cookie");
          for (const cookie of cookies) {
            _res.headers.append("set-cookie", cookie);
          }
        } else {
          _res.headers.set(k, v);
        }
      }
    }
    this.#res = _res;
    this.finalized = true;
  }
  /**
   * `.render()` can create a response within a layout.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   return c.render('Hello!')
   * })
   * ```
   */
  render = /* @__PURE__ */ __name((...args) => {
    this.#renderer ??= (content) => this.html(content);
    return this.#renderer(...args);
  }, "render");
  /**
   * Sets the layout for the response.
   *
   * @param layout - The layout to set.
   * @returns The layout function.
   */
  setLayout = /* @__PURE__ */ __name((layout) => this.#layout = layout, "setLayout");
  /**
   * Gets the current layout for the response.
   *
   * @returns The current layout function.
   */
  getLayout = /* @__PURE__ */ __name(() => this.#layout, "getLayout");
  /**
   * `.setRenderer()` can set the layout in the custom middleware.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```tsx
   * app.use('*', async (c, next) => {
   *   c.setRenderer((content) => {
   *     return c.html(
   *       <html>
   *         <body>
   *           <p>{content}</p>
   *         </body>
   *       </html>
   *     )
   *   })
   *   await next()
   * })
   * ```
   */
  setRenderer = /* @__PURE__ */ __name((renderer) => {
    this.#renderer = renderer;
  }, "setRenderer");
  /**
   * `.header()` can set headers.
   *
   * @see {@link https://hono.dev/docs/api/context#header}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  header = /* @__PURE__ */ __name((name, value, options) => {
    if (this.finalized) {
      this.#res = createResponseInstance(this.#res.body, this.#res);
    }
    const headers = this.#res ? this.#res.headers : this.#preparedHeaders ??= new Headers();
    if (value === void 0) {
      headers.delete(name);
    } else if (options?.append) {
      headers.append(name, value);
    } else {
      headers.set(name, value);
    }
  }, "header");
  status = /* @__PURE__ */ __name((status) => {
    this.#status = status;
  }, "status");
  /**
   * `.set()` can set the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   c.set('message', 'Hono is hot!!')
   *   await next()
   * })
   * ```
   */
  set = /* @__PURE__ */ __name((key, value) => {
    this.#var ??= /* @__PURE__ */ new Map();
    this.#var.set(key, value);
  }, "set");
  /**
   * `.get()` can use the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   const message = c.get('message')
   *   return c.text(`The message is "${message}"`)
   * })
   * ```
   */
  get = /* @__PURE__ */ __name((key) => {
    return this.#var ? this.#var.get(key) : void 0;
  }, "get");
  /**
   * `.var` can access the value of a variable.
   *
   * @see {@link https://hono.dev/docs/api/context#var}
   *
   * @example
   * ```ts
   * const result = c.var.client.oneMethod()
   * ```
   */
  // c.var.propName is a read-only
  get var() {
    if (!this.#var) {
      return {};
    }
    return Object.fromEntries(this.#var);
  }
  #newResponse(data, arg, headers) {
    const responseHeaders = this.#res ? new Headers(this.#res.headers) : this.#preparedHeaders ?? new Headers();
    if (typeof arg === "object" && "headers" in arg) {
      const argHeaders = arg.headers instanceof Headers ? arg.headers : new Headers(arg.headers);
      for (const [key, value] of argHeaders) {
        if (key.toLowerCase() === "set-cookie") {
          responseHeaders.append(key, value);
        } else {
          responseHeaders.set(key, value);
        }
      }
    }
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        if (typeof v === "string") {
          responseHeaders.set(k, v);
        } else {
          responseHeaders.delete(k);
          for (const v2 of v) {
            responseHeaders.append(k, v2);
          }
        }
      }
    }
    const status = typeof arg === "number" ? arg : arg?.status ?? this.#status;
    return createResponseInstance(data, { status, headers: responseHeaders });
  }
  newResponse = /* @__PURE__ */ __name((...args) => this.#newResponse(...args), "newResponse");
  /**
   * `.body()` can return the HTTP response.
   * You can set headers with `.header()` and set HTTP status code with `.status`.
   * This can also be set in `.text()`, `.json()` and so on.
   *
   * @see {@link https://hono.dev/docs/api/context#body}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *   // Set HTTP status code
   *   c.status(201)
   *
   *   // Return the response body
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  body = /* @__PURE__ */ __name((data, arg, headers) => this.#newResponse(data, arg, headers), "body");
  /**
   * `.text()` can render text as `Content-Type:text/plain`.
   *
   * @see {@link https://hono.dev/docs/api/context#text}
   *
   * @example
   * ```ts
   * app.get('/say', (c) => {
   *   return c.text('Hello!')
   * })
   * ```
   */
  text = /* @__PURE__ */ __name((text, arg, headers) => {
    return !this.#preparedHeaders && !this.#status && !arg && !headers && !this.finalized ? new Response(text) : this.#newResponse(
      text,
      arg,
      setDefaultContentType(TEXT_PLAIN, headers)
    );
  }, "text");
  /**
   * `.json()` can render JSON as `Content-Type:application/json`.
   *
   * @see {@link https://hono.dev/docs/api/context#json}
   *
   * @example
   * ```ts
   * app.get('/api', (c) => {
   *   return c.json({ message: 'Hello!' })
   * })
   * ```
   */
  json = /* @__PURE__ */ __name((object, arg, headers) => {
    return this.#newResponse(
      JSON.stringify(object),
      arg,
      setDefaultContentType("application/json", headers)
    );
  }, "json");
  html = /* @__PURE__ */ __name((html, arg, headers) => {
    const res = /* @__PURE__ */ __name((html2) => this.#newResponse(html2, arg, setDefaultContentType("text/html; charset=UTF-8", headers)), "res");
    return typeof html === "object" ? resolveCallback(html, HtmlEscapedCallbackPhase.Stringify, false, {}).then(res) : res(html);
  }, "html");
  /**
   * `.redirect()` can Redirect, default status code is 302.
   *
   * @see {@link https://hono.dev/docs/api/context#redirect}
   *
   * @example
   * ```ts
   * app.get('/redirect', (c) => {
   *   return c.redirect('/')
   * })
   * app.get('/redirect-permanently', (c) => {
   *   return c.redirect('/', 301)
   * })
   * ```
   */
  redirect = /* @__PURE__ */ __name((location, status) => {
    const locationString = String(location);
    this.header(
      "Location",
      // Multibyes should be encoded
      // eslint-disable-next-line no-control-regex
      !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString)
    );
    return this.newResponse(null, status ?? 302);
  }, "redirect");
  /**
   * `.notFound()` can return the Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/context#notfound}
   *
   * @example
   * ```ts
   * app.get('/notfound', (c) => {
   *   return c.notFound()
   * })
   * ```
   */
  notFound = /* @__PURE__ */ __name(() => {
    this.#notFoundHandler ??= () => createResponseInstance();
    return this.#notFoundHandler(this);
  }, "notFound");
};

// node_modules/hono/dist/router.js
var METHOD_NAME_ALL = "ALL";
var METHOD_NAME_ALL_LOWERCASE = "all";
var METHODS = ["get", "post", "put", "delete", "options", "patch"];
var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
var UnsupportedPathError = class extends Error {
  static {
    __name(this, "UnsupportedPathError");
  }
};

// node_modules/hono/dist/utils/constants.js
var COMPOSED_HANDLER = "__COMPOSED_HANDLER";

// node_modules/hono/dist/hono-base.js
var notFoundHandler = /* @__PURE__ */ __name((c) => {
  return c.text("404 Not Found", 404);
}, "notFoundHandler");
var errorHandler = /* @__PURE__ */ __name((err, c) => {
  if ("getResponse" in err) {
    const res = err.getResponse();
    return c.newResponse(res.body, res);
  }
  console.error(err);
  return c.text("Internal Server Error", 500);
}, "errorHandler");
var Hono = class _Hono {
  static {
    __name(this, "_Hono");
  }
  get;
  post;
  put;
  delete;
  options;
  patch;
  all;
  on;
  use;
  /*
    This class is like an abstract class and does not have a router.
    To use it, inherit the class and implement router in the constructor.
  */
  router;
  getPath;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  _basePath = "/";
  #path = "/";
  routes = [];
  constructor(options = {}) {
    const allMethods = [...METHODS, METHOD_NAME_ALL_LOWERCASE];
    allMethods.forEach((method) => {
      this[method] = (args1, ...args) => {
        if (typeof args1 === "string") {
          this.#path = args1;
        } else {
          this.#addRoute(method, this.#path, args1);
        }
        args.forEach((handler) => {
          this.#addRoute(method, this.#path, handler);
        });
        return this;
      };
    });
    this.on = (method, path, ...handlers) => {
      for (const p of [path].flat()) {
        this.#path = p;
        for (const m of [method].flat()) {
          handlers.map((handler) => {
            this.#addRoute(m.toUpperCase(), this.#path, handler);
          });
        }
      }
      return this;
    };
    this.use = (arg1, ...handlers) => {
      if (typeof arg1 === "string") {
        this.#path = arg1;
      } else {
        this.#path = "*";
        handlers.unshift(arg1);
      }
      handlers.forEach((handler) => {
        this.#addRoute(METHOD_NAME_ALL, this.#path, handler);
      });
      return this;
    };
    const { strict, ...optionsWithoutStrict } = options;
    Object.assign(this, optionsWithoutStrict);
    this.getPath = strict ?? true ? options.getPath ?? getPath : getPathNoStrict;
  }
  #clone() {
    const clone = new _Hono({
      router: this.router,
      getPath: this.getPath
    });
    clone.errorHandler = this.errorHandler;
    clone.#notFoundHandler = this.#notFoundHandler;
    clone.routes = this.routes;
    return clone;
  }
  #notFoundHandler = notFoundHandler;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  errorHandler = errorHandler;
  /**
   * `.route()` allows grouping other Hono instance in routes.
   *
   * @see {@link https://hono.dev/docs/api/routing#grouping}
   *
   * @param {string} path - base Path
   * @param {Hono} app - other Hono instance
   * @returns {Hono} routed Hono instance
   *
   * @example
   * ```ts
   * const app = new Hono()
   * const app2 = new Hono()
   *
   * app2.get("/user", (c) => c.text("user"))
   * app.route("/api", app2) // GET /api/user
   * ```
   */
  route(path, app2) {
    const subApp = this.basePath(path);
    app2.routes.map((r) => {
      let handler;
      if (app2.errorHandler === errorHandler) {
        handler = r.handler;
      } else {
        handler = /* @__PURE__ */ __name(async (c, next) => (await compose([], app2.errorHandler)(c, () => r.handler(c, next))).res, "handler");
        handler[COMPOSED_HANDLER] = r.handler;
      }
      subApp.#addRoute(r.method, r.path, handler, r.basePath);
    });
    return this;
  }
  /**
   * `.basePath()` allows base paths to be specified.
   *
   * @see {@link https://hono.dev/docs/api/routing#base-path}
   *
   * @param {string} path - base Path
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * const api = new Hono().basePath('/api')
   * ```
   */
  basePath(path) {
    const subApp = this.#clone();
    subApp._basePath = mergePath(this._basePath, path);
    return subApp;
  }
  /**
   * `.onError()` handles an error and returns a customized Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#error-handling}
   *
   * @param {ErrorHandler} handler - request Handler for error
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.onError((err, c) => {
   *   console.error(`${err}`)
   *   return c.text('Custom Error Message', 500)
   * })
   * ```
   */
  onError = /* @__PURE__ */ __name((handler) => {
    this.errorHandler = handler;
    return this;
  }, "onError");
  /**
   * `.notFound()` allows you to customize a Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#not-found}
   *
   * @param {NotFoundHandler} handler - request handler for not-found
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.notFound((c) => {
   *   return c.text('Custom 404 Message', 404)
   * })
   * ```
   */
  notFound = /* @__PURE__ */ __name((handler) => {
    this.#notFoundHandler = handler;
    return this;
  }, "notFound");
  /**
   * `.mount()` allows you to mount applications built with other frameworks into your Hono application.
   *
   * @see {@link https://hono.dev/docs/api/hono#mount}
   *
   * @param {string} path - base Path
   * @param {Function} applicationHandler - other Request Handler
   * @param {MountOptions} [options] - options of `.mount()`
   * @returns {Hono} mounted Hono instance
   *
   * @example
   * ```ts
   * import { Router as IttyRouter } from 'itty-router'
   * import { Hono } from 'hono'
   * // Create itty-router application
   * const ittyRouter = IttyRouter()
   * // GET /itty-router/hello
   * ittyRouter.get('/hello', () => new Response('Hello from itty-router'))
   *
   * const app = new Hono()
   * app.mount('/itty-router', ittyRouter.handle)
   * ```
   *
   * @example
   * ```ts
   * const app = new Hono()
   * // Send the request to another application without modification.
   * app.mount('/app', anotherApp, {
   *   replaceRequest: (req) => req,
   * })
   * ```
   */
  mount(path, applicationHandler, options) {
    let replaceRequest;
    let optionHandler;
    if (options) {
      if (typeof options === "function") {
        optionHandler = options;
      } else {
        optionHandler = options.optionHandler;
        if (options.replaceRequest === false) {
          replaceRequest = /* @__PURE__ */ __name((request) => request, "replaceRequest");
        } else {
          replaceRequest = options.replaceRequest;
        }
      }
    }
    const getOptions = optionHandler ? (c) => {
      const options2 = optionHandler(c);
      return Array.isArray(options2) ? options2 : [options2];
    } : (c) => {
      let executionContext = void 0;
      try {
        executionContext = c.executionCtx;
      } catch {
      }
      return [c.env, executionContext];
    };
    replaceRequest ||= (() => {
      const mergedPath = mergePath(this._basePath, path);
      const pathPrefixLength = mergedPath === "/" ? 0 : mergedPath.length;
      return (request) => {
        const url = new URL(request.url);
        url.pathname = this.getPath(request).slice(pathPrefixLength) || "/";
        return new Request(url, request);
      };
    })();
    const handler = /* @__PURE__ */ __name(async (c, next) => {
      const res = await applicationHandler(replaceRequest(c.req.raw), ...getOptions(c));
      if (res) {
        return res;
      }
      await next();
    }, "handler");
    this.#addRoute(METHOD_NAME_ALL, mergePath(path, "*"), handler);
    return this;
  }
  #addRoute(method, path, handler, baseRoutePath) {
    method = method.toUpperCase();
    path = mergePath(this._basePath, path);
    const r = {
      basePath: baseRoutePath !== void 0 ? mergePath(this._basePath, baseRoutePath) : this._basePath,
      path,
      method,
      handler
    };
    this.router.add(method, path, [handler, r]);
    this.routes.push(r);
  }
  #handleError(err, c) {
    if (err instanceof Error) {
      return this.errorHandler(err, c);
    }
    throw err;
  }
  #dispatch(request, executionCtx, env, method) {
    if (method === "HEAD") {
      return (async () => new Response(null, await this.#dispatch(request, executionCtx, env, "GET")))();
    }
    const path = this.getPath(request, { env });
    const matchResult = this.router.match(method, path);
    const c = new Context(request, {
      path,
      matchResult,
      env,
      executionCtx,
      notFoundHandler: this.#notFoundHandler
    });
    if (matchResult[0].length === 1) {
      let res;
      try {
        res = matchResult[0][0][0][0](c, async () => {
          c.res = await this.#notFoundHandler(c);
        });
      } catch (err) {
        return this.#handleError(err, c);
      }
      return res instanceof Promise ? res.then(
        (resolved) => resolved || (c.finalized ? c.res : this.#notFoundHandler(c))
      ).catch((err) => this.#handleError(err, c)) : res ?? this.#notFoundHandler(c);
    }
    const composed = compose(matchResult[0], this.errorHandler, this.#notFoundHandler);
    return (async () => {
      try {
        const context = await composed(c);
        if (!context.finalized) {
          throw new Error(
            "Context is not finalized. Did you forget to return a Response object or `await next()`?"
          );
        }
        return context.res;
      } catch (err) {
        return this.#handleError(err, c);
      }
    })();
  }
  /**
   * `.fetch()` will be entry point of your app.
   *
   * @see {@link https://hono.dev/docs/api/hono#fetch}
   *
   * @param {Request} request - request Object of request
   * @param {Env} Env - env Object
   * @param {ExecutionContext} - context of execution
   * @returns {Response | Promise<Response>} response of request
   *
   */
  fetch = /* @__PURE__ */ __name((request, ...rest) => {
    return this.#dispatch(request, rest[1], rest[0], request.method);
  }, "fetch");
  /**
   * `.request()` is a useful method for testing.
   * You can pass a URL or pathname to send a GET request.
   * app will return a Response object.
   * ```ts
   * test('GET /hello is ok', async () => {
   *   const res = await app.request('/hello')
   *   expect(res.status).toBe(200)
   * })
   * ```
   * @see https://hono.dev/docs/api/hono#request
   */
  request = /* @__PURE__ */ __name((input, requestInit, Env, executionCtx) => {
    if (input instanceof Request) {
      return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
    }
    input = input.toString();
    return this.fetch(
      new Request(
        /^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`,
        requestInit
      ),
      Env,
      executionCtx
    );
  }, "request");
  /**
   * `.fire()` automatically adds a global fetch event listener.
   * This can be useful for environments that adhere to the Service Worker API, such as non-ES module Cloudflare Workers.
   * @deprecated
   * Use `fire` from `hono/service-worker` instead.
   * ```ts
   * import { Hono } from 'hono'
   * import { fire } from 'hono/service-worker'
   *
   * const app = new Hono()
   * // ...
   * fire(app)
   * ```
   * @see https://hono.dev/docs/api/hono#fire
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
   * @see https://developers.cloudflare.com/workers/reference/migrate-to-module-workers/
   */
  fire = /* @__PURE__ */ __name(() => {
    addEventListener("fetch", (event) => {
      event.respondWith(this.#dispatch(event.request, event, void 0, event.request.method));
    });
  }, "fire");
};

// node_modules/hono/dist/router/reg-exp-router/matcher.js
var emptyParam = [];
function match(method, path) {
  const matchers = this.buildAllMatchers();
  const match2 = /* @__PURE__ */ __name(((method2, path2) => {
    const matcher = matchers[method2] || matchers[METHOD_NAME_ALL];
    const staticMatch = matcher[2][path2];
    if (staticMatch) {
      return staticMatch;
    }
    const match3 = path2.match(matcher[0]);
    if (!match3) {
      return [[], emptyParam];
    }
    const index = match3.indexOf("", 1);
    return [matcher[1][index], match3];
  }), "match2");
  this.match = match2;
  return match2(method, path);
}
__name(match, "match");

// node_modules/hono/dist/router/reg-exp-router/node.js
var LABEL_REG_EXP_STR = "[^/]+";
var ONLY_WILDCARD_REG_EXP_STR = ".*";
var TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
var PATH_ERROR = /* @__PURE__ */ Symbol();
var regExpMetaChars = new Set(".\\+*[^]$()");
function compareKey(a, b) {
  if (a.length === 1) {
    return b.length === 1 ? a < b ? -1 : 1 : -1;
  }
  if (b.length === 1) {
    return 1;
  }
  if (a === ONLY_WILDCARD_REG_EXP_STR || a === TAIL_WILDCARD_REG_EXP_STR) {
    return 1;
  } else if (b === ONLY_WILDCARD_REG_EXP_STR || b === TAIL_WILDCARD_REG_EXP_STR) {
    return -1;
  }
  if (a === LABEL_REG_EXP_STR) {
    return 1;
  } else if (b === LABEL_REG_EXP_STR) {
    return -1;
  }
  return a.length === b.length ? a < b ? -1 : 1 : b.length - a.length;
}
__name(compareKey, "compareKey");
var Node = class _Node {
  static {
    __name(this, "_Node");
  }
  #index;
  #varIndex;
  #children = /* @__PURE__ */ Object.create(null);
  insert(tokens, index, paramMap, context, pathErrorCheckOnly) {
    if (tokens.length === 0) {
      if (this.#index !== void 0) {
        throw PATH_ERROR;
      }
      if (pathErrorCheckOnly) {
        return;
      }
      this.#index = index;
      return;
    }
    const [token, ...restTokens] = tokens;
    const pattern = token === "*" ? restTokens.length === 0 ? ["", "", ONLY_WILDCARD_REG_EXP_STR] : ["", "", LABEL_REG_EXP_STR] : token === "/*" ? ["", "", TAIL_WILDCARD_REG_EXP_STR] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
    let node;
    if (pattern) {
      const name = pattern[1];
      let regexpStr = pattern[2] || LABEL_REG_EXP_STR;
      if (name && pattern[2]) {
        if (regexpStr === ".*") {
          throw PATH_ERROR;
        }
        regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
        if (/\((?!\?:)/.test(regexpStr)) {
          throw PATH_ERROR;
        }
      }
      node = this.#children[regexpStr];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[regexpStr] = new _Node();
        if (name !== "") {
          node.#varIndex = context.varIndex++;
        }
      }
      if (!pathErrorCheckOnly && name !== "") {
        paramMap.push([name, node.#varIndex]);
      }
    } else {
      node = this.#children[token];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k.length > 1 && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[token] = new _Node();
      }
    }
    node.insert(restTokens, index, paramMap, context, pathErrorCheckOnly);
  }
  buildRegExpStr() {
    const childKeys = Object.keys(this.#children).sort(compareKey);
    const strList = childKeys.map((k) => {
      const c = this.#children[k];
      return (typeof c.#varIndex === "number" ? `(${k})@${c.#varIndex}` : regExpMetaChars.has(k) ? `\\${k}` : k) + c.buildRegExpStr();
    });
    if (typeof this.#index === "number") {
      strList.unshift(`#${this.#index}`);
    }
    if (strList.length === 0) {
      return "";
    }
    if (strList.length === 1) {
      return strList[0];
    }
    return "(?:" + strList.join("|") + ")";
  }
};

// node_modules/hono/dist/router/reg-exp-router/trie.js
var Trie = class {
  static {
    __name(this, "Trie");
  }
  #context = { varIndex: 0 };
  #root = new Node();
  insert(path, index, pathErrorCheckOnly) {
    const paramAssoc = [];
    const groups = [];
    for (let i = 0; ; ) {
      let replaced = false;
      path = path.replace(/\{[^}]+\}/g, (m) => {
        const mark = `@\\${i}`;
        groups[i] = [mark, m];
        i++;
        replaced = true;
        return mark;
      });
      if (!replaced) {
        break;
      }
    }
    const tokens = path.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const [mark] = groups[i];
      for (let j = tokens.length - 1; j >= 0; j--) {
        if (tokens[j].indexOf(mark) !== -1) {
          tokens[j] = tokens[j].replace(mark, groups[i][1]);
          break;
        }
      }
    }
    this.#root.insert(tokens, index, paramAssoc, this.#context, pathErrorCheckOnly);
    return paramAssoc;
  }
  buildRegExp() {
    let regexp = this.#root.buildRegExpStr();
    if (regexp === "") {
      return [/^$/, [], []];
    }
    let captureIndex = 0;
    const indexReplacementMap = [];
    const paramReplacementMap = [];
    regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
      if (handlerIndex !== void 0) {
        indexReplacementMap[++captureIndex] = Number(handlerIndex);
        return "$()";
      }
      if (paramIndex !== void 0) {
        paramReplacementMap[Number(paramIndex)] = ++captureIndex;
        return "";
      }
      return "";
    });
    return [new RegExp(`^${regexp}`), indexReplacementMap, paramReplacementMap];
  }
};

// node_modules/hono/dist/router/reg-exp-router/router.js
var nullMatcher = [/^$/, [], /* @__PURE__ */ Object.create(null)];
var wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
function buildWildcardRegExp(path) {
  return wildcardRegExpCache[path] ??= new RegExp(
    path === "*" ? "" : `^${path.replace(
      /\/\*$|([.\\+*[^\]$()])/g,
      (_, metaChar) => metaChar ? `\\${metaChar}` : "(?:|/.*)"
    )}$`
  );
}
__name(buildWildcardRegExp, "buildWildcardRegExp");
function clearWildcardRegExpCache() {
  wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
}
__name(clearWildcardRegExpCache, "clearWildcardRegExpCache");
function buildMatcherFromPreprocessedRoutes(routes) {
  const trie = new Trie();
  const handlerData = [];
  if (routes.length === 0) {
    return nullMatcher;
  }
  const routesWithStaticPathFlag = routes.map(
    (route) => [!/\*|\/:/.test(route[0]), ...route]
  ).sort(
    ([isStaticA, pathA], [isStaticB, pathB]) => isStaticA ? 1 : isStaticB ? -1 : pathA.length - pathB.length
  );
  const staticMap = /* @__PURE__ */ Object.create(null);
  for (let i = 0, j = -1, len = routesWithStaticPathFlag.length; i < len; i++) {
    const [pathErrorCheckOnly, path, handlers] = routesWithStaticPathFlag[i];
    if (pathErrorCheckOnly) {
      staticMap[path] = [handlers.map(([h]) => [h, /* @__PURE__ */ Object.create(null)]), emptyParam];
    } else {
      j++;
    }
    let paramAssoc;
    try {
      paramAssoc = trie.insert(path, j, pathErrorCheckOnly);
    } catch (e) {
      throw e === PATH_ERROR ? new UnsupportedPathError(path) : e;
    }
    if (pathErrorCheckOnly) {
      continue;
    }
    handlerData[j] = handlers.map(([h, paramCount]) => {
      const paramIndexMap = /* @__PURE__ */ Object.create(null);
      paramCount -= 1;
      for (; paramCount >= 0; paramCount--) {
        const [key, value] = paramAssoc[paramCount];
        paramIndexMap[key] = value;
      }
      return [h, paramIndexMap];
    });
  }
  const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
  for (let i = 0, len = handlerData.length; i < len; i++) {
    for (let j = 0, len2 = handlerData[i].length; j < len2; j++) {
      const map = handlerData[i][j]?.[1];
      if (!map) {
        continue;
      }
      const keys = Object.keys(map);
      for (let k = 0, len3 = keys.length; k < len3; k++) {
        map[keys[k]] = paramReplacementMap[map[keys[k]]];
      }
    }
  }
  const handlerMap = [];
  for (const i in indexReplacementMap) {
    handlerMap[i] = handlerData[indexReplacementMap[i]];
  }
  return [regexp, handlerMap, staticMap];
}
__name(buildMatcherFromPreprocessedRoutes, "buildMatcherFromPreprocessedRoutes");
function findMiddleware(middleware, path) {
  if (!middleware) {
    return void 0;
  }
  for (const k of Object.keys(middleware).sort((a, b) => b.length - a.length)) {
    if (buildWildcardRegExp(k).test(path)) {
      return [...middleware[k]];
    }
  }
  return void 0;
}
__name(findMiddleware, "findMiddleware");
var RegExpRouter = class {
  static {
    __name(this, "RegExpRouter");
  }
  name = "RegExpRouter";
  #middleware;
  #routes;
  constructor() {
    this.#middleware = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
    this.#routes = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
  }
  add(method, path, handler) {
    const middleware = this.#middleware;
    const routes = this.#routes;
    if (!middleware || !routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    if (!middleware[method]) {
      ;
      [middleware, routes].forEach((handlerMap) => {
        handlerMap[method] = /* @__PURE__ */ Object.create(null);
        Object.keys(handlerMap[METHOD_NAME_ALL]).forEach((p) => {
          handlerMap[method][p] = [...handlerMap[METHOD_NAME_ALL][p]];
        });
      });
    }
    if (path === "/*") {
      path = "*";
    }
    const paramCount = (path.match(/\/:/g) || []).length;
    if (/\*$/.test(path)) {
      const re = buildWildcardRegExp(path);
      if (method === METHOD_NAME_ALL) {
        Object.keys(middleware).forEach((m) => {
          middleware[m][path] ||= findMiddleware(middleware[m], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
        });
      } else {
        middleware[method][path] ||= findMiddleware(middleware[method], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
      }
      Object.keys(middleware).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(middleware[m]).forEach((p) => {
            re.test(p) && middleware[m][p].push([handler, paramCount]);
          });
        }
      });
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(routes[m]).forEach(
            (p) => re.test(p) && routes[m][p].push([handler, paramCount])
          );
        }
      });
      return;
    }
    const paths = checkOptionalParameter(path) || [path];
    for (let i = 0, len = paths.length; i < len; i++) {
      const path2 = paths[i];
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          routes[m][path2] ||= [
            ...findMiddleware(middleware[m], path2) || findMiddleware(middleware[METHOD_NAME_ALL], path2) || []
          ];
          routes[m][path2].push([handler, paramCount - len + i + 1]);
        }
      });
    }
  }
  match = match;
  buildAllMatchers() {
    const matchers = /* @__PURE__ */ Object.create(null);
    Object.keys(this.#routes).concat(Object.keys(this.#middleware)).forEach((method) => {
      matchers[method] ||= this.#buildMatcher(method);
    });
    this.#middleware = this.#routes = void 0;
    clearWildcardRegExpCache();
    return matchers;
  }
  #buildMatcher(method) {
    const routes = [];
    let hasOwnRoute = method === METHOD_NAME_ALL;
    [this.#middleware, this.#routes].forEach((r) => {
      const ownRoute = r[method] ? Object.keys(r[method]).map((path) => [path, r[method][path]]) : [];
      if (ownRoute.length !== 0) {
        hasOwnRoute ||= true;
        routes.push(...ownRoute);
      } else if (method !== METHOD_NAME_ALL) {
        routes.push(
          ...Object.keys(r[METHOD_NAME_ALL]).map((path) => [path, r[METHOD_NAME_ALL][path]])
        );
      }
    });
    if (!hasOwnRoute) {
      return null;
    } else {
      return buildMatcherFromPreprocessedRoutes(routes);
    }
  }
};

// node_modules/hono/dist/router/smart-router/router.js
var SmartRouter = class {
  static {
    __name(this, "SmartRouter");
  }
  name = "SmartRouter";
  #routers = [];
  #routes = [];
  constructor(init) {
    this.#routers = init.routers;
  }
  add(method, path, handler) {
    if (!this.#routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    this.#routes.push([method, path, handler]);
  }
  match(method, path) {
    if (!this.#routes) {
      throw new Error("Fatal error");
    }
    const routers = this.#routers;
    const routes = this.#routes;
    const len = routers.length;
    let i = 0;
    let res;
    for (; i < len; i++) {
      const router = routers[i];
      try {
        for (let i2 = 0, len2 = routes.length; i2 < len2; i2++) {
          router.add(...routes[i2]);
        }
        res = router.match(method, path);
      } catch (e) {
        if (e instanceof UnsupportedPathError) {
          continue;
        }
        throw e;
      }
      this.match = router.match.bind(router);
      this.#routers = [router];
      this.#routes = void 0;
      break;
    }
    if (i === len) {
      throw new Error("Fatal error");
    }
    this.name = `SmartRouter + ${this.activeRouter.name}`;
    return res;
  }
  get activeRouter() {
    if (this.#routes || this.#routers.length !== 1) {
      throw new Error("No active router has been determined yet.");
    }
    return this.#routers[0];
  }
};

// node_modules/hono/dist/router/trie-router/node.js
var emptyParams = /* @__PURE__ */ Object.create(null);
var hasChildren = /* @__PURE__ */ __name((children) => {
  for (const _ in children) {
    return true;
  }
  return false;
}, "hasChildren");
var Node2 = class _Node2 {
  static {
    __name(this, "_Node");
  }
  #methods;
  #children;
  #patterns;
  #order = 0;
  #params = emptyParams;
  constructor(method, handler, children) {
    this.#children = children || /* @__PURE__ */ Object.create(null);
    this.#methods = [];
    if (method && handler) {
      const m = /* @__PURE__ */ Object.create(null);
      m[method] = { handler, possibleKeys: [], score: 0 };
      this.#methods = [m];
    }
    this.#patterns = [];
  }
  insert(method, path, handler) {
    this.#order = ++this.#order;
    let curNode = this;
    const parts = splitRoutingPath(path);
    const possibleKeys = [];
    for (let i = 0, len = parts.length; i < len; i++) {
      const p = parts[i];
      const nextP = parts[i + 1];
      const pattern = getPattern(p, nextP);
      const key = Array.isArray(pattern) ? pattern[0] : p;
      if (key in curNode.#children) {
        curNode = curNode.#children[key];
        if (pattern) {
          possibleKeys.push(pattern[1]);
        }
        continue;
      }
      curNode.#children[key] = new _Node2();
      if (pattern) {
        curNode.#patterns.push(pattern);
        possibleKeys.push(pattern[1]);
      }
      curNode = curNode.#children[key];
    }
    curNode.#methods.push({
      [method]: {
        handler,
        possibleKeys: possibleKeys.filter((v, i, a) => a.indexOf(v) === i),
        score: this.#order
      }
    });
    return curNode;
  }
  #pushHandlerSets(handlerSets, node, method, nodeParams, params) {
    for (let i = 0, len = node.#methods.length; i < len; i++) {
      const m = node.#methods[i];
      const handlerSet = m[method] || m[METHOD_NAME_ALL];
      const processedSet = {};
      if (handlerSet !== void 0) {
        handlerSet.params = /* @__PURE__ */ Object.create(null);
        handlerSets.push(handlerSet);
        if (nodeParams !== emptyParams || params && params !== emptyParams) {
          for (let i2 = 0, len2 = handlerSet.possibleKeys.length; i2 < len2; i2++) {
            const key = handlerSet.possibleKeys[i2];
            const processed = processedSet[handlerSet.score];
            handlerSet.params[key] = params?.[key] && !processed ? params[key] : nodeParams[key] ?? params?.[key];
            processedSet[handlerSet.score] = true;
          }
        }
      }
    }
  }
  search(method, path) {
    const handlerSets = [];
    this.#params = emptyParams;
    const curNode = this;
    let curNodes = [curNode];
    const parts = splitPath(path);
    const curNodesQueue = [];
    const len = parts.length;
    let partOffsets = null;
    for (let i = 0; i < len; i++) {
      const part = parts[i];
      const isLast = i === len - 1;
      const tempNodes = [];
      for (let j = 0, len2 = curNodes.length; j < len2; j++) {
        const node = curNodes[j];
        const nextNode = node.#children[part];
        if (nextNode) {
          nextNode.#params = node.#params;
          if (isLast) {
            if (nextNode.#children["*"]) {
              this.#pushHandlerSets(handlerSets, nextNode.#children["*"], method, node.#params);
            }
            this.#pushHandlerSets(handlerSets, nextNode, method, node.#params);
          } else {
            tempNodes.push(nextNode);
          }
        }
        for (let k = 0, len3 = node.#patterns.length; k < len3; k++) {
          const pattern = node.#patterns[k];
          const params = node.#params === emptyParams ? {} : { ...node.#params };
          if (pattern === "*") {
            const astNode = node.#children["*"];
            if (astNode) {
              this.#pushHandlerSets(handlerSets, astNode, method, node.#params);
              astNode.#params = params;
              tempNodes.push(astNode);
            }
            continue;
          }
          const [key, name, matcher] = pattern;
          if (!part && !(matcher instanceof RegExp)) {
            continue;
          }
          const child = node.#children[key];
          if (matcher instanceof RegExp) {
            if (partOffsets === null) {
              partOffsets = new Array(len);
              let offset = path[0] === "/" ? 1 : 0;
              for (let p = 0; p < len; p++) {
                partOffsets[p] = offset;
                offset += parts[p].length + 1;
              }
            }
            const restPathString = path.substring(partOffsets[i]);
            const m = matcher.exec(restPathString);
            if (m) {
              params[name] = m[0];
              this.#pushHandlerSets(handlerSets, child, method, node.#params, params);
              if (hasChildren(child.#children)) {
                child.#params = params;
                const componentCount = m[0].match(/\//)?.length ?? 0;
                const targetCurNodes = curNodesQueue[componentCount] ||= [];
                targetCurNodes.push(child);
              }
              continue;
            }
          }
          if (matcher === true || matcher.test(part)) {
            params[name] = part;
            if (isLast) {
              this.#pushHandlerSets(handlerSets, child, method, params, node.#params);
              if (child.#children["*"]) {
                this.#pushHandlerSets(
                  handlerSets,
                  child.#children["*"],
                  method,
                  params,
                  node.#params
                );
              }
            } else {
              child.#params = params;
              tempNodes.push(child);
            }
          }
        }
      }
      const shifted = curNodesQueue.shift();
      curNodes = shifted ? tempNodes.concat(shifted) : tempNodes;
    }
    if (handlerSets.length > 1) {
      handlerSets.sort((a, b) => {
        return a.score - b.score;
      });
    }
    return [handlerSets.map(({ handler, params }) => [handler, params])];
  }
};

// node_modules/hono/dist/router/trie-router/router.js
var TrieRouter = class {
  static {
    __name(this, "TrieRouter");
  }
  name = "TrieRouter";
  #node;
  constructor() {
    this.#node = new Node2();
  }
  add(method, path, handler) {
    const results = checkOptionalParameter(path);
    if (results) {
      for (let i = 0, len = results.length; i < len; i++) {
        this.#node.insert(method, results[i], handler);
      }
      return;
    }
    this.#node.insert(method, path, handler);
  }
  match(method, path) {
    return this.#node.search(method, path);
  }
};

// node_modules/hono/dist/hono.js
var Hono2 = class extends Hono {
  static {
    __name(this, "Hono");
  }
  /**
   * Creates an instance of the Hono class.
   *
   * @param options - Optional configuration options for the Hono instance.
   */
  constructor(options = {}) {
    super(options);
    this.router = options.router ?? new SmartRouter({
      routers: [new RegExpRouter(), new TrieRouter()]
    });
  }
};

// node_modules/hono/dist/middleware/cors/index.js
var cors = /* @__PURE__ */ __name((options) => {
  const opts = {
    origin: "*",
    allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH"],
    allowHeaders: [],
    exposeHeaders: [],
    ...options
  };
  const findAllowOrigin = ((optsOrigin) => {
    if (typeof optsOrigin === "string") {
      if (optsOrigin === "*") {
        return () => optsOrigin;
      } else {
        return (origin) => optsOrigin === origin ? origin : null;
      }
    } else if (typeof optsOrigin === "function") {
      return optsOrigin;
    } else {
      return (origin) => optsOrigin.includes(origin) ? origin : null;
    }
  })(opts.origin);
  const findAllowMethods = ((optsAllowMethods) => {
    if (typeof optsAllowMethods === "function") {
      return optsAllowMethods;
    } else if (Array.isArray(optsAllowMethods)) {
      return () => optsAllowMethods;
    } else {
      return () => [];
    }
  })(opts.allowMethods);
  return /* @__PURE__ */ __name(async function cors2(c, next) {
    function set(key, value) {
      c.res.headers.set(key, value);
    }
    __name(set, "set");
    const allowOrigin = await findAllowOrigin(c.req.header("origin") || "", c);
    if (allowOrigin) {
      set("Access-Control-Allow-Origin", allowOrigin);
    }
    if (opts.credentials) {
      set("Access-Control-Allow-Credentials", "true");
    }
    if (opts.exposeHeaders?.length) {
      set("Access-Control-Expose-Headers", opts.exposeHeaders.join(","));
    }
    if (c.req.method === "OPTIONS") {
      if (opts.origin !== "*") {
        set("Vary", "Origin");
      }
      if (opts.maxAge != null) {
        set("Access-Control-Max-Age", opts.maxAge.toString());
      }
      const allowMethods = await findAllowMethods(c.req.header("origin") || "", c);
      if (allowMethods.length) {
        set("Access-Control-Allow-Methods", allowMethods.join(","));
      }
      let headers = opts.allowHeaders;
      if (!headers?.length) {
        const requestHeaders = c.req.header("Access-Control-Request-Headers");
        if (requestHeaders) {
          headers = requestHeaders.split(/\s*,\s*/);
        }
      }
      if (headers?.length) {
        set("Access-Control-Allow-Headers", headers.join(","));
        c.res.headers.append("Vary", "Access-Control-Request-Headers");
      }
      c.res.headers.delete("Content-Length");
      c.res.headers.delete("Content-Type");
      return new Response(null, {
        headers: c.res.headers,
        status: 204,
        statusText: "No Content"
      });
    }
    await next();
    if (opts.origin !== "*") {
      c.header("Vary", "Origin", { append: true });
    }
  }, "cors2");
}, "cors");

// src/client-quotas.ts
async function consumeClientQuotas(env, key) {
  if (key.daily_token_limit != null && key.daily_token_limit > 0) {
    const tokens = await readDailyTokens(env, key.id);
    if (tokens >= key.daily_token_limit) {
      return {
        ok: false,
        status: 429,
        error: `Client key daily token limit exceeded (${key.daily_token_limit})`
      };
    }
  }
  if (key.rpm_limit != null && key.rpm_limit > 0) {
    const bucket = currentMinuteBucket();
    const kvKey = rpmKey(key.id, bucket);
    const current = Number(await env.COOLDOWNS.get(kvKey)) || 0;
    if (current >= key.rpm_limit) {
      return { ok: false, status: 429, error: `Client key RPM limit exceeded (${key.rpm_limit})` };
    }
    await env.COOLDOWNS.put(kvKey, String(current + 1), { expirationTtl: 120 });
  }
  return { ok: true };
}
__name(consumeClientQuotas, "consumeClientQuotas");
async function addClientDailyTokens(env, clientKeyId, tokens) {
  if (!Number.isFinite(tokens) || tokens <= 0) {
    return;
  }
  const day = currentUtcDay();
  const key = dailyTokenKey(clientKeyId, day);
  const current = Number(await env.COOLDOWNS.get(key)) || 0;
  await env.COOLDOWNS.put(key, String(current + tokens), { expirationTtl: 86400 });
}
__name(addClientDailyTokens, "addClientDailyTokens");
async function readDailyTokens(env, clientKeyId) {
  const value = await env.COOLDOWNS.get(dailyTokenKey(clientKeyId, currentUtcDay()));
  return Number(value) || 0;
}
__name(readDailyTokens, "readDailyTokens");
function rpmKey(clientKeyId, bucket) {
  return `quota:rpm:${clientKeyId}:${bucket}`;
}
__name(rpmKey, "rpmKey");
function dailyTokenKey(clientKeyId, day) {
  return `quota:tokens:${clientKeyId}:${day}`;
}
__name(dailyTokenKey, "dailyTokenKey");
function currentMinuteBucket() {
  const now = /* @__PURE__ */ new Date();
  return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}`;
}
__name(currentMinuteBucket, "currentMinuteBucket");
function currentUtcDay() {
  const now = /* @__PURE__ */ new Date();
  return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}`;
}
__name(currentUtcDay, "currentUtcDay");
function pad(value) {
  return String(value).padStart(2, "0");
}
__name(pad, "pad");

// src/crypto.ts
var textEncoder = new TextEncoder();
var textDecoder = new TextDecoder();
function makeId(prefix) {
  return `${prefix}_${base64Url(crypto.getRandomValues(new Uint8Array(18)))}`;
}
__name(makeId, "makeId");
function makeClientSecret() {
  return `sk-router-${base64Url(crypto.getRandomValues(new Uint8Array(32)))}`;
}
__name(makeClientSecret, "makeClientSecret");
async function sha256Hex(input) {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(input));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
__name(sha256Hex, "sha256Hex");
function constantTimeEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
__name(constantTimeEqual, "constantTimeEqual");
async function encryptSecret(plaintext, encryptionKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getAesKey(encryptionKey);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, textEncoder.encode(plaintext));
  return `v1:${base64(iv)}:${base64(new Uint8Array(ciphertext))}`;
}
__name(encryptSecret, "encryptSecret");
async function decryptSecret(payload, encryptionKey) {
  const [version, ivValue, ciphertextValue] = payload.split(":");
  if (version !== "v1" || !ivValue || !ciphertextValue) {
    throw new Error("Unsupported encrypted secret format");
  }
  const key = await getAesKey(encryptionKey);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(fromBase64(ivValue)) },
    key,
    toArrayBuffer(fromBase64(ciphertextValue))
  );
  return textDecoder.decode(plaintext);
}
__name(decryptSecret, "decryptSecret");
async function getAesKey(encryptionKey) {
  if (!encryptionKey) {
    throw new Error("ENCRYPTION_KEY is not configured");
  }
  const keyBytes = await crypto.subtle.digest("SHA-256", textEncoder.encode(encryptionKey));
  return crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}
__name(getAesKey, "getAesKey");
function base64(bytes) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}
__name(base64, "base64");
function fromBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
__name(fromBase64, "fromBase64");
function toArrayBuffer(bytes) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}
__name(toArrayBuffer, "toArrayBuffer");
function base64Url(bytes) {
  return base64(bytes).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
__name(base64Url, "base64Url");

// src/auth.ts
function adminAuth() {
  return async (c, next) => {
    const token = bearerToken(c);
    if (!c.env.ADMIN_TOKEN || !token || !constantTimeEqual(token, c.env.ADMIN_TOKEN)) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    await next();
  };
}
__name(adminAuth, "adminAuth");
async function authenticateClient(c) {
  const token = bearerToken(c);
  if (!token) {
    return c.json({ error: "Missing bearer token" }, 401);
  }
  const keyHash = await sha256Hex(token);
  const row = await c.env.DB.prepare(
    "SELECT id, name, key_hash, enabled, rpm_limit, daily_token_limit, created_at, last_used_at FROM client_keys WHERE key_hash = ?"
  ).bind(keyHash).first();
  if (!row || row.enabled !== 1) {
    return c.json({ error: "Invalid API key" }, 401);
  }
  const quotaCheck = await consumeClientQuotas(c.env, row);
  if (!quotaCheck.ok) {
    return c.json({ error: quotaCheck.error }, quotaCheck.status);
  }
  c.set("clientKeyId", row.id);
  c.executionCtx.waitUntil(
    c.env.DB.prepare("UPDATE client_keys SET last_used_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").bind(row.id).run()
  );
  return null;
}
__name(authenticateClient, "authenticateClient");
function bearerToken(c) {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return null;
  }
  return header.slice("Bearer ".length).trim();
}
__name(bearerToken, "bearerToken");

// src/model-route-usage.ts
function formatModelInUseError(modelId, routes) {
  const names = routes.map((route) => route.routeName).sort();
  if (names.length === 1) {
    return `Model "${modelId}" is used by route "${names[0]}". Remove it from the route before deleting.`;
  }
  return `Model "${modelId}" is used by routes: ${names.map((name) => `"${name}"`).join(", ")}. Remove it from those routes before deleting.`;
}
__name(formatModelInUseError, "formatModelInUseError");
function formatModelRenamedMessage(modelId, newModelId, routesUpdated) {
  if (routesUpdated === 0) {
    return `Model renamed to "${newModelId}".`;
  }
  if (routesUpdated === 1) {
    return `Model renamed to "${newModelId}" and 1 route entry was updated.`;
  }
  return `Model renamed from "${modelId}" to "${newModelId}" and ${routesUpdated} route entries were updated.`;
}
__name(formatModelRenamedMessage, "formatModelRenamedMessage");

// src/providers.ts
var providerDefaults = [
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    exampleModel: "gpt-4o-mini",
    modelsCatalog: {
      openRouterAuthors: "openai",
      stripOpenRouterPrefix: "openai/"
    }
  },
  {
    id: "groq",
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    exampleModel: "llama-3.1-8b-instant",
    modelsCatalog: {
      openRouterProviders: "groq"
    }
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    exampleModel: "meta-llama/llama-3.1-8b-instruct:free"
  },
  {
    id: "github-models",
    name: "GitHub Models",
    baseUrl: "https://models.github.ai/inference",
    exampleModel: "openai/gpt-4o-mini"
  },
  {
    id: "gemini",
    name: "Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    exampleModel: "gemini-2.0-flash",
    modelsCatalog: {
      openRouterAuthors: "google",
      stripOpenRouterPrefix: "google/"
    }
  },
  {
    // Native Anthropic uses /messages, not OpenAI /chat/completions — use OpenRouter or a compatible gateway.
    id: "anthropic",
    name: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    exampleModel: "claude-3-5-haiku-latest",
    modelsCatalog: {
      openRouterAuthors: "anthropic"
    }
  }
];
var OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
function getProviderCatalog(providerId) {
  const preset = providerDefaults.find((item) => item.id === providerId);
  if (!preset || !("modelsCatalog" in preset)) {
    return null;
  }
  return preset.modelsCatalog;
}
__name(getProviderCatalog, "getProviderCatalog");
function resolveProviderCatalog(providerId, row) {
  const defaults = getProviderCatalog(providerId) ?? {};
  const catalog = {
    openRouterAuthors: row?.open_router_authors === null || row?.open_router_authors === void 0 ? defaults.openRouterAuthors : normalizeCatalogValue(row.open_router_authors),
    openRouterProviders: row?.open_router_providers === null || row?.open_router_providers === void 0 ? defaults.openRouterProviders : normalizeCatalogValue(row.open_router_providers),
    stripOpenRouterPrefix: row?.strip_open_router_prefix === null || row?.strip_open_router_prefix === void 0 ? defaults.stripOpenRouterPrefix : normalizeCatalogValue(row.strip_open_router_prefix)
  };
  if (!catalog.openRouterAuthors && !catalog.openRouterProviders && !catalog.stripOpenRouterPrefix) {
    return null;
  }
  return catalog;
}
__name(resolveProviderCatalog, "resolveProviderCatalog");
function isOpenRouterProvider(providerId) {
  return providerId === "openrouter";
}
__name(isOpenRouterProvider, "isOpenRouterProvider");
function normalizeCatalogValue(value) {
  return value.trim() || void 0;
}
__name(normalizeCatalogValue, "normalizeCatalogValue");

// src/provider-models.ts
async function fetchProviderModels(env, providerId) {
  const provider = await env.DB.prepare("SELECT id, base_url FROM providers WHERE id = ?").bind(providerId).first();
  if (!provider) {
    return { models: [], source: "fallback", error: "Provider not found" };
  }
  const fallback = fallbackModels(providerId);
  const cachedModels = await getCachedProviderModels(env, providerId);
  if (cachedModels.length > 0) {
    return { models: cachedModels, source: "cached", error: null };
  }
  const keyRow = await env.DB.prepare(
    "SELECT api_key_ciphertext FROM provider_keys WHERE provider_id = ? AND enabled = 1 ORDER BY created_at ASC LIMIT 1"
  ).bind(providerId).first();
  if (keyRow) {
    try {
      const apiKey = await decryptSecret(keyRow.api_key_ciphertext, env.ENCRYPTION_KEY);
      const nativeModels = await fetchNativeModels(provider.base_url, apiKey);
      if (nativeModels.length > 0) {
        return { models: nativeModels, source: "upstream", error: null };
      }
    } catch (error) {
      const nativeError = error instanceof Error ? error.message : "Failed to fetch models";
      return withFallback({ models: [], source: "fallback", error: nativeError }, fallback);
    }
  }
  return withFallback(
    { models: [], source: "fallback", error: null },
    fallback,
    "Add a provider API key or sync models from OpenRouter"
  );
}
__name(fetchProviderModels, "fetchProviderModels");
async function getCachedProviderModels(env, providerId) {
  const rows = await getCachedProviderModelsWithMeta(env, providerId);
  return rows.map((row) => row.modelId);
}
__name(getCachedProviderModels, "getCachedProviderModels");
async function getCachedProviderModelsWithMeta(env, providerId) {
  const rows = await env.DB.prepare(
    "SELECT model_id, source FROM provider_models WHERE provider_id = ? ORDER BY model_id"
  ).bind(providerId).all();
  return (rows.results ?? []).map((row) => ({
    modelId: row.model_id,
    source: row.source === "manual" ? "manual" : "sync"
  }));
}
__name(getCachedProviderModelsWithMeta, "getCachedProviderModelsWithMeta");
async function getCachedProviderModelsResponse(env, providerId) {
  const provider = await env.DB.prepare("SELECT id FROM providers WHERE id = ?").bind(providerId).first();
  if (!provider) {
    throw new Error("Provider not found");
  }
  const [models, excludedCount] = await Promise.all([
    getCachedProviderModelsWithMeta(env, providerId),
    getProviderModelExclusionCount(env, providerId)
  ]);
  return { models, excludedCount };
}
__name(getCachedProviderModelsResponse, "getCachedProviderModelsResponse");
async function addManualProviderModel(env, providerId, modelId) {
  const provider = await env.DB.prepare("SELECT id FROM providers WHERE id = ?").bind(providerId).first();
  if (!provider) {
    throw new Error("Provider not found");
  }
  const existing = await env.DB.prepare("SELECT model_id FROM provider_models WHERE provider_id = ? AND model_id = ?").bind(providerId, modelId).first();
  if (existing) {
    throw new Error("Model already exists in catalog");
  }
  await env.DB.batch([
    env.DB.prepare("INSERT INTO provider_models (provider_id, model_id, source) VALUES (?, ?, 'manual')").bind(providerId, modelId),
    env.DB.prepare("DELETE FROM provider_model_exclusions WHERE provider_id = ? AND model_id = ?").bind(providerId, modelId)
  ]);
}
__name(addManualProviderModel, "addManualProviderModel");
async function renameProviderModel(env, providerId, oldModelId, newModelId) {
  const row = await env.DB.prepare("SELECT source FROM provider_models WHERE provider_id = ? AND model_id = ?").bind(providerId, oldModelId).first();
  if (!row) {
    throw new Error("Model not found");
  }
  const duplicate = await env.DB.prepare("SELECT model_id FROM provider_models WHERE provider_id = ? AND model_id = ?").bind(providerId, newModelId).first();
  if (duplicate) {
    throw new Error("Target model ID already exists in catalog");
  }
  const entryCountRow = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM route_entries WHERE provider_id = ? AND upstream_model = ?"
  ).bind(providerId, oldModelId).first();
  const entriesUpdated = entryCountRow?.count ?? 0;
  const statements = [
    env.DB.prepare("DELETE FROM provider_models WHERE provider_id = ? AND model_id = ?").bind(providerId, oldModelId),
    env.DB.prepare("INSERT INTO provider_models (provider_id, model_id, source) VALUES (?, ?, ?)").bind(
      providerId,
      newModelId,
      row.source
    ),
    env.DB.prepare("DELETE FROM provider_model_exclusions WHERE provider_id = ? AND model_id = ?").bind(providerId, newModelId),
    env.DB.prepare(
      "UPDATE route_entries SET upstream_model = ? WHERE provider_id = ? AND upstream_model = ?"
    ).bind(newModelId, providerId, oldModelId)
  ];
  if (row.source === "sync") {
    statements.push(
      env.DB.prepare("INSERT OR IGNORE INTO provider_model_exclusions (provider_id, model_id) VALUES (?, ?)").bind(
        providerId,
        oldModelId
      )
    );
  }
  await env.DB.batch(statements);
  return {
    newModelId,
    routesUpdated: entriesUpdated
  };
}
__name(renameProviderModel, "renameProviderModel");
async function deleteProviderModel(env, providerId, modelId) {
  const row = await env.DB.prepare("SELECT source FROM provider_models WHERE provider_id = ? AND model_id = ?").bind(providerId, modelId).first();
  if (!row) {
    throw new Error("Model not found");
  }
  const routeUsage = await getRoutesUsingUpstreamModel(env, providerId, modelId);
  if (routeUsage.length > 0) {
    throw new Error(formatModelInUseError(modelId, routeUsage));
  }
  const statements = [
    env.DB.prepare("DELETE FROM provider_models WHERE provider_id = ? AND model_id = ?").bind(providerId, modelId)
  ];
  if (row.source === "sync") {
    statements.push(
      env.DB.prepare("INSERT OR IGNORE INTO provider_model_exclusions (provider_id, model_id) VALUES (?, ?)").bind(
        providerId,
        modelId
      )
    );
  }
  await env.DB.batch(statements);
}
__name(deleteProviderModel, "deleteProviderModel");
async function syncProviderModelsFromOpenRouter(env, providerId) {
  const provider = await env.DB.prepare(
    "SELECT id, open_router_authors, open_router_providers, strip_open_router_prefix FROM providers WHERE id = ?"
  ).bind(providerId).first();
  if (!provider) {
    throw new Error("Provider not found");
  }
  const catalog = resolveProviderCatalog(providerId, provider);
  if (!catalog?.openRouterAuthors && !catalog?.openRouterProviders && !isOpenRouterProvider(providerId)) {
    throw new Error("Provider has no OpenRouter catalog mapping");
  }
  const rawIds = await fetchOpenRouterModelIds(catalog);
  const models = uniqueSorted(
    isOpenRouterProvider(providerId) ? rawIds : rawIds.map((id) => transformOpenRouterModelId(id, catalog?.stripOpenRouterPrefix))
  );
  if (models.length === 0) {
    throw new Error("OpenRouter catalog returned no models");
  }
  const exclusions = await getProviderModelExclusions(env, providerId);
  const existingModels = new Set(await getCachedProviderModels(env, providerId));
  const toInsert = models.filter((model) => !exclusions.has(model));
  const syncedAt = (/* @__PURE__ */ new Date()).toISOString();
  let addedCount = 0;
  await env.DB.batch([
    env.DB.prepare("DELETE FROM provider_models WHERE provider_id = ? AND source = 'sync'").bind(providerId)
  ]);
  const insertStatements = toInsert.map((model) => {
    if (!existingModels.has(model)) {
      addedCount += 1;
    }
    return env.DB.prepare("INSERT OR IGNORE INTO provider_models (provider_id, model_id, source) VALUES (?, ?, 'sync')").bind(
      providerId,
      model
    );
  });
  await runStatementBatches(env, insertStatements);
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE providers SET models_synced_at = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?"
    ).bind(syncedAt, providerId)
  ]);
  const catalogModels = await getCachedProviderModels(env, providerId);
  return {
    providerId,
    modelCount: catalogModels.length,
    syncedAt,
    models: catalogModels,
    addedCount
  };
}
__name(syncProviderModelsFromOpenRouter, "syncProviderModelsFromOpenRouter");
async function mergeUpstreamModelsIntoCatalog(env, providerId) {
  const provider = await env.DB.prepare("SELECT id, base_url FROM providers WHERE id = ?").bind(providerId).first();
  if (!provider) {
    throw new Error("Provider not found");
  }
  const keyRow = await env.DB.prepare(
    "SELECT api_key_ciphertext FROM provider_keys WHERE provider_id = ? AND enabled = 1 ORDER BY created_at ASC LIMIT 1"
  ).bind(providerId).first();
  if (!keyRow) {
    throw new Error("Add a provider API key before refreshing models from upstream");
  }
  const apiKey = await decryptSecret(keyRow.api_key_ciphertext, env.ENCRYPTION_KEY);
  const upstreamModels = await fetchNativeModels(provider.base_url, apiKey);
  if (upstreamModels.length === 0) {
    throw new Error("Upstream returned no models");
  }
  const [existingModels, exclusions] = await Promise.all([
    new Set(await getCachedProviderModels(env, providerId)),
    getProviderModelExclusions(env, providerId)
  ]);
  const toAdd = upstreamModels.filter((model) => !existingModels.has(model) && !exclusions.has(model));
  const insertStatements = toAdd.map(
    (model) => env.DB.prepare("INSERT OR IGNORE INTO provider_models (provider_id, model_id, source) VALUES (?, ?, 'sync')").bind(
      providerId,
      model
    )
  );
  await runStatementBatches(env, insertStatements);
  const catalogModels = await getCachedProviderModels(env, providerId);
  return {
    addedCount: toAdd.length,
    modelCount: catalogModels.length,
    models: catalogModels
  };
}
__name(mergeUpstreamModelsIntoCatalog, "mergeUpstreamModelsIntoCatalog");
async function getRoutesUsingUpstreamModel(env, providerId, upstreamModel) {
  const rows = await env.DB.prepare(
    `SELECT DISTINCT r.id AS route_id, r.name AS route_name
     FROM route_entries re
     JOIN routes r ON r.id = re.route_id
     WHERE re.provider_id = ? AND re.upstream_model = ?`
  ).bind(providerId, upstreamModel).all();
  return (rows.results ?? []).map((row) => ({
    routeId: row.route_id,
    routeName: row.route_name
  }));
}
__name(getRoutesUsingUpstreamModel, "getRoutesUsingUpstreamModel");
async function getProviderModelExclusions(env, providerId) {
  const rows = await env.DB.prepare("SELECT model_id FROM provider_model_exclusions WHERE provider_id = ?").bind(providerId).all();
  return new Set((rows.results ?? []).map((row) => row.model_id));
}
__name(getProviderModelExclusions, "getProviderModelExclusions");
async function getProviderModelExclusionCount(env, providerId) {
  const row = await env.DB.prepare("SELECT COUNT(*) AS count FROM provider_model_exclusions WHERE provider_id = ?").bind(providerId).first();
  return row?.count ?? 0;
}
__name(getProviderModelExclusionCount, "getProviderModelExclusionCount");
async function fetchNativeModels(baseUrl, apiKey) {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/models`, {
    headers: { authorization: `Bearer ${apiKey}` }
  });
  if (!response.ok) {
    throw new Error(await safeText(response) || `Upstream returned ${response.status}`);
  }
  const payload = await response.json();
  return uniqueSorted((payload.data ?? []).map((item) => item.id).filter((id) => Boolean(id)));
}
__name(fetchNativeModels, "fetchNativeModels");
async function fetchOpenRouterModelIds(catalog) {
  const params = new URLSearchParams();
  if (catalog?.openRouterAuthors) {
    params.set("model_authors", catalog.openRouterAuthors);
  }
  if (catalog?.openRouterProviders) {
    params.set("providers", catalog.openRouterProviders);
  }
  const url = params.size > 0 ? `${OPENROUTER_MODELS_URL}?${params}` : OPENROUTER_MODELS_URL;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(await safeText(response) || `OpenRouter catalog returned ${response.status}`);
  }
  const payload = await response.json();
  return (payload.data ?? []).map((item) => item.id).filter((id) => Boolean(id));
}
__name(fetchOpenRouterModelIds, "fetchOpenRouterModelIds");
function transformOpenRouterModelId(id, stripPrefix) {
  if (stripPrefix && id.startsWith(stripPrefix)) {
    return id.slice(stripPrefix.length);
  }
  return id;
}
__name(transformOpenRouterModelId, "transformOpenRouterModelId");
function withFallback(result, fallback, message) {
  if (fallback.length === 0) {
    return {
      models: [],
      source: "fallback",
      error: message ?? result.error
    };
  }
  return {
    models: fallback,
    source: "fallback",
    error: message ?? result.error
  };
}
__name(withFallback, "withFallback");
function fallbackModels(providerId) {
  const preset = providerDefaults.find((item) => item.id === providerId);
  return preset ? [preset.exampleModel] : [];
}
__name(fallbackModels, "fallbackModels");
function uniqueSorted(values) {
  return [...new Set(values)].sort();
}
__name(uniqueSorted, "uniqueSorted");
var D1_BATCH_CHUNK_SIZE = 50;
async function runStatementBatches(env, statements) {
  for (let i = 0; i < statements.length; i += D1_BATCH_CHUNK_SIZE) {
    await env.DB.batch(statements.slice(i, i + D1_BATCH_CHUNK_SIZE));
  }
}
__name(runStatementBatches, "runStatementBatches");
async function safeText(response) {
  try {
    return (await response.text()).slice(0, 500);
  } catch {
    return "";
  }
}
__name(safeText, "safeText");

// src/query-params.ts
function parseStatsWindow(value) {
  return value === "7d" || value === "30d" || value === "all" ? value : "24h";
}
__name(parseStatsWindow, "parseStatsWindow");
function statsWindowCutoff(window) {
  if (window === "all") {
    return null;
  }
  const hours = window === "24h" ? 24 : window === "7d" ? 7 * 24 : 30 * 24;
  return new Date(Date.now() - hours * 60 * 60 * 1e3).toISOString();
}
__name(statsWindowCutoff, "statsWindowCutoff");
function readBoundedLimit(value, fallback, max) {
  const parsed = Number(value);
  const limit = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  return Math.min(limit, max);
}
__name(readBoundedLimit, "readBoundedLimit");

// src/route-validation.ts
function validatePinnedProviderKeys(entries, keysById) {
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const providerKeyId = entry.providerKeyId?.trim();
    if (!providerKeyId) {
      continue;
    }
    const step = index + 1;
    const key = keysById.get(providerKeyId);
    if (!key) {
      return `Step ${step}: provider key not found`;
    }
    if (key.provider_id !== entry.providerId) {
      return `Step ${step}: provider key "${providerKeyId}" belongs to a different provider`;
    }
    if (key.enabled !== 1) {
      return `Step ${step}: provider key is disabled`;
    }
  }
  return null;
}
__name(validatePinnedProviderKeys, "validatePinnedProviderKeys");

// src/admin-api.ts
function createAdminApi() {
  const app2 = new Hono2();
  app2.use("*", adminAuth());
  app2.get("/bootstrap", (c) => c.json({ providerDefaults }));
  app2.get("/providers", async (c) => {
    const providers = await c.env.DB.prepare(
      `SELECT
        p.id, p.name, p.base_url, p.enabled, p.created_at, p.updated_at,
        COUNT(pk.id) AS key_count
      FROM providers p
      LEFT JOIN provider_keys pk ON pk.provider_id = p.id
      GROUP BY p.id
      ORDER BY p.name`
    ).all();
    const keys = await c.env.DB.prepare(
      "SELECT id, provider_id, name, enabled, last_used_at, created_at, updated_at FROM provider_keys ORDER BY created_at DESC"
    ).all();
    return c.json({ providers: providers.results ?? [], keys: keys.results ?? [] });
  });
  app2.get("/provider-catalog", async (c) => {
    const rows = await c.env.DB.prepare(
      `SELECT
        p.id, p.name, p.base_url, p.enabled,
        p.open_router_authors, p.open_router_providers, p.strip_open_router_prefix,
        p.models_synced_at, p.created_at, p.updated_at,
        COUNT(pm.model_id) AS model_count
      FROM providers p
      LEFT JOIN provider_models pm ON pm.provider_id = p.id
      GROUP BY p.id
      ORDER BY p.name`
    ).all();
    const providers = (rows.results ?? []).map((provider) => {
      const catalog = resolveProviderCatalog(provider.id, provider);
      return {
        id: provider.id,
        name: provider.name,
        openRouterAuthors: catalog?.openRouterAuthors ?? "",
        openRouterProviders: catalog?.openRouterProviders ?? "",
        stripOpenRouterPrefix: catalog?.stripOpenRouterPrefix ?? "",
        modelCount: provider.model_count,
        modelsSyncedAt: provider.models_synced_at,
        syncEnabled: isOpenRouterProvider(provider.id) || Boolean(catalog?.openRouterAuthors || catalog?.openRouterProviders)
      };
    });
    return c.json({ providers });
  });
  app2.post("/providers", async (c) => {
    const body = await c.req.json();
    if (!body.name || !body.baseUrl) {
      return c.json({ error: "name and baseUrl are required" }, 400);
    }
    const id = body.id?.trim() || makeId("provider");
    await c.env.DB.prepare(
      `INSERT INTO providers (id, name, base_url, enabled)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, base_url = excluded.base_url, enabled = excluded.enabled, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`
    ).bind(id, body.name.trim(), body.baseUrl.trim(), body.enabled === false ? 0 : 1).run();
    return c.json({ id });
  });
  app2.patch("/providers/:id", async (c) => {
    const body = await c.req.json();
    await c.env.DB.prepare(
      `UPDATE providers
       SET name = COALESCE(?, name), base_url = COALESCE(?, base_url), enabled = COALESCE(?, enabled), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ?`
    ).bind(body.name?.trim() ?? null, body.baseUrl?.trim() ?? null, body.enabled === void 0 ? null : body.enabled ? 1 : 0, c.req.param("id")).run();
    return c.json({ ok: true });
  });
  app2.patch("/providers/:id/catalog", async (c) => {
    const body = await c.req.json();
    await c.env.DB.prepare(
      `UPDATE providers
       SET open_router_authors = ?, open_router_providers = ?, strip_open_router_prefix = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ?`
    ).bind(
      body.openRouterAuthors?.trim() ?? "",
      body.openRouterProviders?.trim() ?? "",
      body.stripOpenRouterPrefix?.trim() ?? "",
      c.req.param("id")
    ).run();
    return c.json({ ok: true });
  });
  app2.delete("/providers/:id", async (c) => {
    await c.env.DB.prepare("DELETE FROM providers WHERE id = ?").bind(c.req.param("id")).run();
    return c.json({ ok: true });
  });
  app2.get("/providers/:id/models", async (c) => {
    if (c.req.query("mergeUpstream") === "1") {
      try {
        const merged = await mergeUpstreamModelsIntoCatalog(c.env, c.req.param("id"));
        return c.json({
          models: merged.models,
          source: "cached",
          error: null,
          addedCount: merged.addedCount
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to refresh models from upstream";
        return c.json({ error: message }, 400);
      }
    }
    const result = await fetchProviderModels(c.env, c.req.param("id"));
    return c.json(result);
  });
  app2.get("/providers/:id/models/cached", async (c) => {
    try {
      return c.json(await getCachedProviderModelsResponse(c.env, c.req.param("id")));
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : "Failed to load cached models" }, 404);
    }
  });
  app2.post("/providers/:id/models", async (c) => {
    const body = await c.req.json();
    const modelId = body.modelId?.trim();
    if (!modelId) {
      return c.json({ error: "modelId is required" }, 400);
    }
    try {
      await addManualProviderModel(c.env, c.req.param("id"), modelId);
      return c.json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to add model";
      const status = message === "Provider not found" ? 404 : 400;
      return c.json({ error: message }, status);
    }
  });
  app2.patch("/providers/:id/models/:modelId", async (c) => {
    const body = await c.req.json();
    const newModelId = body.modelId?.trim();
    if (!newModelId) {
      return c.json({ error: "modelId is required" }, 400);
    }
    try {
      const result = await renameProviderModel(c.env, c.req.param("id"), c.req.param("modelId"), newModelId);
      return c.json({
        ok: true,
        newModelId: result.newModelId,
        routesUpdated: result.routesUpdated,
        message: formatModelRenamedMessage(c.req.param("modelId"), result.newModelId, result.routesUpdated)
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to rename model";
      const status = message === "Model not found" ? 404 : 400;
      return c.json({ error: message }, status);
    }
  });
  app2.delete("/providers/:id/models/:modelId", async (c) => {
    try {
      await deleteProviderModel(c.env, c.req.param("id"), c.req.param("modelId"));
      return c.json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete model";
      const status = message === "Model not found" ? 404 : 400;
      return c.json({ error: message }, status);
    }
  });
  app2.post("/providers/:id/models/sync", async (c) => {
    try {
      return c.json(await syncProviderModelsFromOpenRouter(c.env, c.req.param("id")));
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : "Failed to sync provider models" }, 400);
    }
  });
  app2.post("/provider-catalog/sync-all", async (c) => {
    const rows = await c.env.DB.prepare(
      `SELECT id, open_router_authors, open_router_providers, strip_open_router_prefix
       FROM providers
       ORDER BY name`
    ).all();
    const results = [];
    for (const provider of rows.results ?? []) {
      const catalog = resolveProviderCatalog(provider.id, provider);
      if (!isOpenRouterProvider(provider.id) && !catalog?.openRouterAuthors && !catalog?.openRouterProviders) {
        continue;
      }
      try {
        results.push(await syncProviderModelsFromOpenRouter(c.env, provider.id));
      } catch (error) {
        results.push({
          providerId: provider.id,
          error: error instanceof Error ? error.message : "Failed to sync provider models"
        });
      }
    }
    return c.json({ results });
  });
  app2.post("/providers/:id/keys", async (c) => {
    const body = await c.req.json();
    if (!body.name || !body.apiKey) {
      return c.json({ error: "name and apiKey are required" }, 400);
    }
    const id = makeId("pkey");
    const ciphertext = await encryptSecret(body.apiKey.trim(), c.env.ENCRYPTION_KEY);
    await c.env.DB.prepare(
      "INSERT INTO provider_keys (id, provider_id, name, api_key_ciphertext, enabled) VALUES (?, ?, ?, ?, ?)"
    ).bind(id, c.req.param("id"), body.name.trim(), ciphertext, body.enabled === false ? 0 : 1).run();
    return c.json({ id });
  });
  app2.patch("/provider-keys/:id", async (c) => {
    const body = await c.req.json();
    const ciphertext = body.apiKey ? await encryptSecret(body.apiKey.trim(), c.env.ENCRYPTION_KEY) : null;
    await c.env.DB.prepare(
      `UPDATE provider_keys
       SET name = COALESCE(?, name), api_key_ciphertext = COALESCE(?, api_key_ciphertext), enabled = COALESCE(?, enabled), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ?`
    ).bind(body.name?.trim() ?? null, ciphertext, body.enabled === void 0 ? null : body.enabled ? 1 : 0, c.req.param("id")).run();
    return c.json({ ok: true });
  });
  app2.delete("/provider-keys/:id", async (c) => {
    await c.env.DB.prepare("DELETE FROM provider_keys WHERE id = ?").bind(c.req.param("id")).run();
    await c.env.COOLDOWNS.delete(`cooldown:${c.req.param("id")}`);
    return c.json({ ok: true });
  });
  app2.get("/routes", async (c) => {
    const routes = await c.env.DB.prepare("SELECT id, name, created_at, updated_at FROM routes ORDER BY name").all();
    const entries = await c.env.DB.prepare(
      `SELECT
        re.id, re.route_id, re.provider_id, re.provider_key_id, pk.name AS provider_key_name, p.name AS provider_name, p.base_url,
        re.upstream_model, re.position
      FROM route_entries re
      JOIN providers p ON p.id = re.provider_id
      LEFT JOIN provider_keys pk ON pk.id = re.provider_key_id
      ORDER BY re.route_id, re.position`
    ).all();
    return c.json({ routes: routes.results ?? [], entries: entries.results ?? [] });
  });
  app2.post("/routes", async (c) => {
    const body = await c.req.json();
    if (!body.name) {
      return c.json({ error: "name is required" }, 400);
    }
    try {
      const id = makeId("route");
      await saveRoute(c.env, id, body.name.trim(), body.entries ?? []);
      return c.json({ id });
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : "Failed to save route" }, 400);
    }
  });
  app2.put("/routes/:id", async (c) => {
    const body = await c.req.json();
    const id = c.req.param("id");
    if (!body.name) {
      return c.json({ error: "name is required" }, 400);
    }
    try {
      await saveRoute(c.env, id, body.name.trim(), body.entries ?? []);
      return c.json({ id });
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : "Failed to save route" }, 400);
    }
  });
  app2.delete("/routes/:id", async (c) => {
    await c.env.DB.prepare("DELETE FROM routes WHERE id = ? AND name <> 'default'").bind(c.req.param("id")).run();
    return c.json({ ok: true });
  });
  app2.get("/client-keys", async (c) => {
    const keys = await c.env.DB.prepare(
      "SELECT id, name, enabled, rpm_limit, daily_token_limit, created_at, last_used_at FROM client_keys ORDER BY created_at DESC"
    ).all();
    return c.json({ keys: keys.results ?? [] });
  });
  app2.post("/client-keys", async (c) => {
    const body = await c.req.json();
    const name = normalizeClientKeyName(body.name);
    if (!name) {
      return c.json({ error: "name is required" }, 400);
    }
    const id = makeId("ckey");
    const secret = makeClientSecret();
    const keyHash = await sha256Hex(secret);
    await c.env.DB.prepare(
      "INSERT INTO client_keys (id, name, key_hash, enabled, rpm_limit, daily_token_limit) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(
      id,
      name,
      keyHash,
      body.enabled === false ? 0 : 1,
      normalizeQuotaLimit(body.rpmLimit),
      normalizeQuotaLimit(body.dailyTokenLimit)
    ).run();
    return c.json({ id, secret });
  });
  app2.patch("/client-keys/:id", async (c) => {
    const body = await c.req.json();
    const fields = [];
    const values = [];
    if (body.name !== void 0) {
      const name = normalizeClientKeyName(body.name);
      if (!name) {
        return c.json({ error: "name is required" }, 400);
      }
      fields.push("name = ?");
      values.push(name);
    }
    if (body.enabled !== void 0) {
      fields.push("enabled = ?");
      values.push(body.enabled ? 1 : 0);
    }
    if (body.rpmLimit !== void 0) {
      fields.push("rpm_limit = ?");
      values.push(normalizeQuotaLimit(body.rpmLimit));
    }
    if (body.dailyTokenLimit !== void 0) {
      fields.push("daily_token_limit = ?");
      values.push(normalizeQuotaLimit(body.dailyTokenLimit));
    }
    if (fields.length === 0) {
      return c.json({ ok: true });
    }
    values.push(c.req.param("id"));
    await c.env.DB.prepare(`UPDATE client_keys SET ${fields.join(", ")} WHERE id = ?`).bind(...values).run();
    return c.json({ ok: true });
  });
  app2.delete("/client-keys/:id", async (c) => {
    await c.env.DB.prepare("DELETE FROM client_keys WHERE id = ?").bind(c.req.param("id")).run();
    return c.json({ ok: true });
  });
  app2.get("/usage", async (c) => {
    const limit = readBoundedLimit(c.req.query("limit"), 100, 500);
    const rows = await c.env.DB.prepare(
      `SELECT
        u.*, ck.name AS client_key_name, p.name AS provider_name
      FROM usage_log u
      LEFT JOIN client_keys ck ON ck.id = u.client_key_id
      LEFT JOIN providers p ON p.id = u.provider_id
      ORDER BY u.created_at DESC
      LIMIT ?`
    ).bind(limit).all();
    const summary = await c.env.DB.prepare(
      `SELECT
        COUNT(*) AS requests,
        SUM(COALESCE(total_tokens, 0)) AS total_tokens,
        SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) AS errors
      FROM usage_log`
    ).first();
    return c.json({ rows: rows.results ?? [], summary });
  });
  app2.get("/stats", async (c) => {
    const window = parseStatsWindow(c.req.query("window"));
    const cutoff = statsWindowCutoff(window);
    const filter = cutoff ? "WHERE u.created_at >= ?" : "";
    const summaryStatement = c.env.DB.prepare(
      `SELECT
        COUNT(*) AS requests,
        SUM(COALESCE(total_tokens, 0)) AS total_tokens,
        SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) AS errors,
        AVG(latency_ms) AS avg_latency_ms
      FROM usage_log u
      ${filter}`
    );
    const summary = await bindCutoff(summaryStatement, cutoff).first();
    const providers = await statsBreakdown(
      c.env,
      `SELECT
        COALESCE(u.provider_id, 'unknown') AS id,
        COALESCE(p.name, 'Unknown provider') AS name,
        COUNT(*) AS requests,
        SUM(COALESCE(u.total_tokens, 0)) AS total_tokens,
        SUM(CASE WHEN u.status >= 400 THEN 1 ELSE 0 END) AS errors,
        AVG(u.latency_ms) AS avg_latency_ms
      FROM usage_log u
      LEFT JOIN providers p ON p.id = u.provider_id
      ${filter}
      GROUP BY u.provider_id, p.name
      ORDER BY requests DESC, name`,
      cutoff
    );
    const routes = await statsBreakdown(
      c.env,
      `SELECT
        u.route_name AS id,
        u.route_name AS name,
        COUNT(*) AS requests,
        SUM(COALESCE(u.total_tokens, 0)) AS total_tokens,
        SUM(CASE WHEN u.status >= 400 THEN 1 ELSE 0 END) AS errors,
        AVG(u.latency_ms) AS avg_latency_ms
      FROM usage_log u
      ${filter}
      GROUP BY u.route_name
      ORDER BY requests DESC, name`,
      cutoff
    );
    const clientKeys = await statsBreakdown(
      c.env,
      `SELECT
        COALESCE(u.client_key_id, 'unknown') AS id,
        COALESCE(ck.name, 'Unknown app') AS name,
        COUNT(*) AS requests,
        SUM(COALESCE(u.total_tokens, 0)) AS total_tokens,
        SUM(CASE WHEN u.status >= 400 THEN 1 ELSE 0 END) AS errors,
        AVG(u.latency_ms) AS avg_latency_ms
      FROM usage_log u
      LEFT JOIN client_keys ck ON ck.id = u.client_key_id
      ${filter}
      GROUP BY u.client_key_id, ck.name
      ORDER BY requests DESC, name`,
      cutoff
    );
    const requests = summary?.requests ?? 0;
    const errors = summary?.errors ?? 0;
    return c.json({
      window,
      summary: {
        requests,
        totalTokens: summary?.total_tokens ?? 0,
        errors,
        avgLatencyMs: Math.round(summary?.avg_latency_ms ?? 0),
        successRate: requests > 0 ? (requests - errors) / requests : 0
      },
      breakdowns: {
        providers,
        routes,
        clientKeys
      }
    });
  });
  app2.get("/cooldowns", async (c) => {
    const listed = await c.env.COOLDOWNS.list({ prefix: "cooldown:" });
    return c.json({ cooldowns: listed.keys });
  });
  return app2;
}
__name(createAdminApi, "createAdminApi");
async function statsBreakdown(env, query, cutoff) {
  const rows = await bindCutoff(env.DB.prepare(query), cutoff).all();
  return (rows.results ?? []).map((row) => ({
    id: row.id ?? "unknown",
    name: row.name ?? "Unknown",
    requests: row.requests,
    totalTokens: row.total_tokens ?? 0,
    errors: row.errors,
    avgLatencyMs: Math.round(row.avg_latency_ms ?? 0),
    successRate: row.requests > 0 ? (row.requests - row.errors) / row.requests : 0
  }));
}
__name(statsBreakdown, "statsBreakdown");
function bindCutoff(statement, cutoff) {
  return cutoff ? statement.bind(cutoff) : statement;
}
__name(bindCutoff, "bindCutoff");
function normalizeQuotaLimit(value) {
  if (value == null) {
    return null;
  }
  const parsed = Math.trunc(value);
  return parsed > 0 ? parsed : null;
}
__name(normalizeQuotaLimit, "normalizeQuotaLimit");
function normalizeClientKeyName(value) {
  if (value == null || typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
__name(normalizeClientKeyName, "normalizeClientKeyName");
async function saveRoute(env, id, name, entries) {
  const validationError = await validateRouteEntriesForSave(env, entries);
  if (validationError) {
    throw new Error(validationError);
  }
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO routes (id, name)
       VALUES (?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`
    ).bind(id, name),
    env.DB.prepare("DELETE FROM route_entries WHERE route_id = ?").bind(id),
    ...entries.map(
      (entry, index) => env.DB.prepare("INSERT INTO route_entries (id, route_id, provider_id, provider_key_id, upstream_model, position) VALUES (?, ?, ?, ?, ?, ?)").bind(makeId("rent"), id, entry.providerId, entry.providerKeyId?.trim() || null, entry.upstreamModel, index)
    )
  ]);
}
__name(saveRoute, "saveRoute");
async function validateRouteEntriesForSave(env, entries) {
  const pinnedIds = entries.map((entry) => entry.providerKeyId?.trim()).filter((value) => Boolean(value));
  if (pinnedIds.length === 0) {
    return null;
  }
  const placeholders = pinnedIds.map(() => "?").join(", ");
  const keys = await env.DB.prepare(
    `SELECT id, provider_id, enabled FROM provider_keys WHERE id IN (${placeholders})`
  ).bind(...pinnedIds).all();
  const keysById = new Map((keys.results ?? []).map((key) => [key.id, key]));
  return validatePinnedProviderKeys(entries, keysById);
}
__name(validateRouteEntriesForSave, "validateRouteEntriesForSave");

// src/router-logic.ts
function shouldFallback(status) {
  return status === 401 || status === 402 || status === 403 || status === 408 || status === 409 || status === 429 || status >= 500;
}
__name(shouldFallback, "shouldFallback");
function readNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
__name(readNumber, "readNumber");

// src/adaptive-routing.ts
function isAdaptiveRoutingEnabled(env) {
  return env.ADAPTIVE_ROUTING_ENABLED === "true";
}
__name(isAdaptiveRoutingEnabled, "isAdaptiveRoutingEnabled");
function adaptiveRoutingWindowHours(env) {
  return readNumber(env.ADAPTIVE_ROUTING_WINDOW_HOURS, 24);
}
__name(adaptiveRoutingWindowHours, "adaptiveRoutingWindowHours");
function sortCandidatesByHealth(candidates, healthRows) {
  const scoreByTarget = /* @__PURE__ */ new Map();
  for (const row of healthRows) {
    const key = healthKey(row.providerId, row.upstreamModel);
    const successRate = row.requests > 0 ? (row.requests - row.errors) / row.requests : 1;
    scoreByTarget.set(key, successRate);
  }
  return [...candidates].sort((left, right) => {
    const leftScore = scoreByTarget.get(healthKey(left.provider_id, left.upstream_model)) ?? 1;
    const rightScore = scoreByTarget.get(healthKey(right.provider_id, right.upstream_model)) ?? 1;
    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }
    if (left.position !== right.position) {
      return left.position - right.position;
    }
    return 0;
  });
}
__name(sortCandidatesByHealth, "sortCandidatesByHealth");
async function loadProviderModelHealth(env, windowHours) {
  const cutoff = new Date(Date.now() - windowHours * 60 * 60 * 1e3).toISOString();
  const result = await env.DB.prepare(
    `SELECT
      provider_id AS providerId,
      upstream_model AS upstreamModel,
      COUNT(*) AS requests,
      SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) AS errors
    FROM usage_log
    WHERE created_at >= ?
      AND provider_id IS NOT NULL
      AND upstream_model IS NOT NULL
    GROUP BY provider_id, upstream_model`
  ).bind(cutoff).all();
  return result.results ?? [];
}
__name(loadProviderModelHealth, "loadProviderModelHealth");
function healthKey(providerId, upstreamModel) {
  return `${providerId}:${upstreamModel}`;
}
__name(healthKey, "healthKey");

// src/usage.ts
async function logUsage(env, usage) {
  await env.DB.prepare(
    `INSERT INTO usage_log (
      id, client_key_id, route_name, provider_id, provider_key_id, upstream_model,
      status, latency_ms, prompt_tokens, completion_tokens, total_tokens, error
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    makeId("usage"),
    usage.clientKeyId,
    usage.routeName,
    usage.providerId,
    usage.providerKeyId,
    usage.upstreamModel,
    usage.status,
    usage.latencyMs,
    usage.promptTokens ?? null,
    usage.completionTokens ?? null,
    usage.totalTokens ?? null,
    usage.error ?? null
  ).run();
  if (usage.clientKeyId && usage.totalTokens && usage.totalTokens > 0) {
    try {
      await addClientDailyTokens(env, usage.clientKeyId, usage.totalTokens);
    } catch {
    }
  }
}
__name(logUsage, "logUsage");
async function parseJsonUsage(response) {
  try {
    const data = await response.clone().json();
    return usageFromObject(data.usage);
  } catch {
    return {};
  }
}
__name(parseJsonUsage, "parseJsonUsage");
async function parseStreamingUsage(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let usage = {};
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) {
          continue;
        }
        const payload = line.slice("data:".length).trim();
        if (!payload || payload === "[DONE]") {
          continue;
        }
        try {
          const data = JSON.parse(payload);
          if (data.usage) {
            usage = usageFromObject(data.usage);
          }
        } catch {
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
  return usage;
}
__name(parseStreamingUsage, "parseStreamingUsage");
function usageFromObject(usage) {
  if (!usage) {
    return {};
  }
  return {
    promptTokens: usage.prompt_tokens ?? null,
    completionTokens: usage.completion_tokens ?? null,
    totalTokens: usage.total_tokens ?? null
  };
}
__name(usageFromObject, "usageFromObject");

// src/router.ts
async function handleChatCompletions(request, env, ctx, clientKeyId) {
  const started = Date.now();
  let incomingBody;
  try {
    incomingBody = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body");
  }
  const requestedModel = typeof incomingBody.model === "string" ? incomingBody.model : "default";
  const routeName = await resolveRouteName(env, requestedModel);
  let candidates = await loadCandidates(env, routeName);
  if (isAdaptiveRoutingEnabled(env) && candidates.length > 1) {
    try {
      const healthRows = await loadProviderModelHealth(env, adaptiveRoutingWindowHours(env));
      candidates = sortCandidatesByHealth(candidates, healthRows);
    } catch {
    }
  }
  const failures = [];
  if (candidates.length === 0) {
    await logUsage(env, {
      clientKeyId,
      routeName,
      providerId: null,
      providerKeyId: null,
      upstreamModel: null,
      status: 502,
      latencyMs: Date.now() - started,
      error: "No enabled route entries with enabled provider keys"
    });
    return jsonError(502, "No enabled route entries with enabled provider keys", failures);
  }
  for (const candidate of candidates) {
    if (await isCoolingDown(env, candidate.provider_key_id)) {
      failures.push({
        provider: candidate.provider_name,
        model: candidate.upstream_model,
        reason: "provider key is cooling down"
      });
      continue;
    }
    const apiKey = await decryptSecret(candidate.api_key_ciphertext, env.ENCRYPTION_KEY);
    const body = prepareBody(incomingBody, candidate.upstream_model);
    const upstreamStarted = Date.now();
    let upstreamResponse;
    try {
      upstreamResponse = await fetchWithTimeout(
        `${candidate.base_url.replace(/\/$/, "")}/chat/completions`,
        {
          method: "POST",
          headers: buildUpstreamHeaders(request, apiKey),
          body: JSON.stringify(body)
        },
        readNumber(env.UPSTREAM_TIMEOUT_MS, 6e4)
      );
    } catch (error) {
      await setCooldown(env, candidate.provider_key_id, "network");
      failures.push({
        provider: candidate.provider_name,
        model: candidate.upstream_model,
        reason: error instanceof Error ? error.message : "network error"
      });
      continue;
    }
    if (shouldFallback(upstreamResponse.status)) {
      const errorText = await safeResponseText(upstreamResponse);
      await setCooldown(env, candidate.provider_key_id, `${upstreamResponse.status}`);
      const reason = errorText || upstreamResponse.statusText;
      failures.push({
        provider: candidate.provider_name,
        model: candidate.upstream_model,
        status: upstreamResponse.status,
        reason
      });
      console.warn(
        `[router] fallback after ${upstreamResponse.status} from ${candidate.provider_name}/${candidate.upstream_model}: ${reason}`
      );
      continue;
    }
    const latencyMs = Date.now() - upstreamStarted;
    const baseUsage = {
      clientKeyId,
      routeName,
      providerId: candidate.provider_id,
      providerKeyId: candidate.provider_key_id,
      upstreamModel: candidate.upstream_model,
      status: upstreamResponse.status,
      latencyMs,
      error: upstreamResponse.ok ? null : upstreamResponse.statusText
    };
    await env.DB.prepare(
      "UPDATE provider_keys SET last_used_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?"
    ).bind(candidate.provider_key_id).run();
    if (body.stream) {
      if (!upstreamResponse.body) {
        const reason = upstreamResponse.ok ? "upstream returned no stream body" : `upstream returned no stream body (${upstreamResponse.status})`;
        failures.push({
          provider: candidate.provider_name,
          model: candidate.upstream_model,
          status: upstreamResponse.status,
          reason
        });
        continue;
      }
      const [clientStream, loggingStream] = upstreamResponse.body.tee();
      const response = new Response(clientStream, copyResponseInit(upstreamResponse));
      queueUsage(env, ctx, {
        baseUsage: { ...baseUsage, latencyMs: Date.now() - started },
        stream: loggingStream
      });
      return response;
    }
    const responseForClient = upstreamResponse.clone();
    queueUsage(env, ctx, {
      baseUsage: { ...baseUsage, latencyMs: Date.now() - started },
      response: upstreamResponse
    });
    return responseForClient;
  }
  const errorDetail = failures.map((failure) => `${failure.provider}: ${failure.reason}`).join("; ");
  await logUsage(env, {
    clientKeyId,
    routeName,
    providerId: null,
    providerKeyId: null,
    upstreamModel: null,
    status: 502,
    latencyMs: Date.now() - started,
    error: errorDetail
  });
  return jsonError(502, "All configured providers failed or are cooling down", failures);
}
__name(handleChatCompletions, "handleChatCompletions");
async function resolveRouteName(env, requestedModel) {
  const directRoute = await env.DB.prepare("SELECT name FROM routes WHERE name = ?").bind(requestedModel).first();
  if (directRoute) {
    return directRoute.name;
  }
  const defaultRoute = await env.DB.prepare("SELECT name FROM routes WHERE name = 'default'").first();
  return defaultRoute?.name ?? requestedModel;
}
__name(resolveRouteName, "resolveRouteName");
async function loadCandidates(env, routeName) {
  const result = await env.DB.prepare(
    `SELECT
      p.id AS provider_id,
      p.name AS provider_name,
      p.base_url AS base_url,
      pk.id AS provider_key_id,
      pk.api_key_ciphertext AS api_key_ciphertext,
      re.upstream_model AS upstream_model,
      re.position AS position
    FROM routes r
    JOIN route_entries re ON re.route_id = r.id
    JOIN providers p ON p.id = re.provider_id
    JOIN provider_keys pk ON pk.provider_id = p.id
      AND (re.provider_key_id IS NULL OR pk.id = re.provider_key_id)
    WHERE r.name = ? AND p.enabled = 1 AND pk.enabled = 1
    ORDER BY re.position ASC, COALESCE(pk.last_used_at, '') ASC, pk.created_at ASC`
  ).bind(routeName).all();
  return result.results ?? [];
}
__name(loadCandidates, "loadCandidates");
function prepareBody(body, upstreamModel) {
  const nextBody = {
    ...body,
    model: upstreamModel
  };
  if (nextBody.stream) {
    nextBody.stream_options = {
      ...typeof body.stream_options === "object" ? body.stream_options : {},
      include_usage: true
    };
  }
  return nextBody;
}
__name(prepareBody, "prepareBody");
function buildUpstreamHeaders(request, apiKey) {
  const headers = new Headers({
    "content-type": "application/json",
    authorization: `Bearer ${apiKey}`
  });
  const referer = request.headers.get("HTTP-Referer") ?? request.headers.get("Referer");
  if (referer) {
    headers.set("HTTP-Referer", referer);
  }
  const title = request.headers.get("X-Title");
  if (title) {
    headers.set("X-Title", title);
  }
  return headers;
}
__name(buildUpstreamHeaders, "buildUpstreamHeaders");
async function isCoolingDown(env, providerKeyId) {
  return await env.COOLDOWNS.get(cooldownKey(providerKeyId)) !== null;
}
__name(isCoolingDown, "isCoolingDown");
async function setCooldown(env, providerKeyId, reason) {
  const ttl = reason === "429" || reason === "402" ? readNumber(env.DEFAULT_COOLDOWN_429_SECONDS, 300) : readNumber(env.DEFAULT_COOLDOWN_5XX_SECONDS, 60);
  await env.COOLDOWNS.put(cooldownKey(providerKeyId), reason, { expirationTtl: ttl });
}
__name(setCooldown, "setCooldown");
function cooldownKey(providerKeyId) {
  return `cooldown:${providerKeyId}`;
}
__name(cooldownKey, "cooldownKey");
async function fetchWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("upstream timeout"), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}
__name(fetchWithTimeout, "fetchWithTimeout");
function copyResponseInit(response) {
  const headers = new Headers(response.headers);
  headers.delete("content-encoding");
  headers.delete("content-length");
  return {
    status: response.status,
    statusText: response.statusText,
    headers
  };
}
__name(copyResponseInit, "copyResponseInit");
function queueUsage(env, ctx, options) {
  const promise = (async () => {
    try {
      const parsed = options.stream ? await parseStreamingUsage(options.stream) : options.response ? await parseJsonUsage(options.response) : {};
      await logUsage(env, {
        ...options.baseUsage,
        ...parsed
      });
    } catch (error) {
      await logUsage(env, {
        ...options.baseUsage,
        error: error instanceof Error ? error.message : "usage logging failed"
      });
    }
  })();
  ctx.waitUntil(promise);
}
__name(queueUsage, "queueUsage");
async function safeResponseText(response) {
  try {
    return (await response.text()).slice(0, 1e3);
  } catch {
    return "";
  }
}
__name(safeResponseText, "safeResponseText");
function jsonError(status, error, attempts = []) {
  return Response.json({ error, attempts }, { status });
}
__name(jsonError, "jsonError");

// src/index.ts
var app = new Hono2();
app.use(
  "/v1/*",
  cors({
    origin: "*",
    allowHeaders: ["authorization", "content-type", "http-referer", "x-title"],
    allowMethods: ["GET", "POST", "OPTIONS"]
  })
);
app.get("/health", (c) => c.json({ ok: true }));
app.route("/admin", createAdminApi());
app.get("/v1/models", async (c) => {
  const authResponse = await authenticateClient(c);
  if (authResponse) {
    return authResponse;
  }
  const routes = await c.env.DB.prepare("SELECT name FROM routes ORDER BY name").all();
  const created = Math.floor(Date.now() / 1e3);
  return c.json({
    object: "list",
    data: (routes.results ?? []).map((route) => ({
      id: route.name,
      object: "model",
      created,
      owned_by: "llm-router"
    }))
  });
});
app.post("/v1/chat/completions", async (c) => {
  const authResponse = await authenticateClient(c);
  if (authResponse) {
    return authResponse;
  }
  return handleChatCompletions(c.req.raw, c.env, c.executionCtx, c.get("clientKeyId") ?? null);
});
app.all("/v1/*", (c) => c.json({ error: "Unsupported OpenAI-compatible endpoint" }, 404));
app.get("*", async (c) => c.env.ASSETS.fetch(c.req.raw));
var index_default = app;
export {
  index_default as default
};
//# sourceMappingURL=index.js.map

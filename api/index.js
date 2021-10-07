global.AbortController = require("abort-controller");
global.fetch = require("node-fetch");
const { get, merge } = require("lodash");
const { fromFetch } = require("rxjs/fetch");
const { defer, from } = require("rxjs");
const { map, switchMap, tap } = require("rxjs/operators");

const L = require("../cli/log.js");

const Biz = (init = {}) => {
  const target = { ...init };

  target.api = (x) =>
    defer(() => {
      const method = x.body ? "POST" : "GET";
      const headers = {
        Authorization: `token ${target.token}`,
        "User-Agent": "Muranode/1.0.0",
      };
      if (x.url.endsWith("/api:1/token/")) {
        delete headers["Authorization"];
      }

      const options = merge(
        {
          headers,
          method,
        },
        x
      );
      if (
        !get(options, "headers.content-type", "").includes(
          "multipart/form-data"
        )
      ) {
        options.headers["content-type"] = "application/json";
        options.body = JSON.stringify(options.body);
      }

      L.log(options);
      return fromFetch(x.url, options).pipe(
        tap((x) => L.log(x.status)),
        switchMap((x) => x.text()),
        tap((x) => L.log(x)),
        map((x) => {
          try {
            return JSON.parse(x);
          } catch (e) {
            return x;
          }
        }),
        map((x) => {
          if (x.statusCode >= 400) {
            throw x;
          } else {
            return x;
          }
        })
      );
    });

  const handler = {
    get: (_, service) => {
      const prefix = `https://${_.host}/api:1/`;
      service = service.toLowerCase();

      switch (service) {
        case "_":
          return new Proxy(
            {},
            {
              get: (__, k) => _[k],
            }
          );
        case "token":
          return (body) =>
            _.api({
              body,
              url: `${prefix}token/`,
            }).pipe(tap((x) => (_.token = x.token)));
        case "businesses":
          return (x) =>
            _.api({
              url: `${prefix}user/${x.email}/membership/`,
            });
        case "solution":
          return (x) =>
            _.api({
              url: `${prefix}solution/${x.id}`,
            });
        case "solutions":
          return (x) =>
            _.api({
              url: `${prefix}business/${x.businessId}/solution/`,
            });
        case "serviceConfig":
          return {
            list: (x) =>
              _.api({
                url: `${prefix}solution/${_.applicationId}/serviceconfig`,
              }),
            add: (x) =>
              _.api({
                body: {
                  ...x,
                },
                url: `${prefix}solution/${_.applicationId}/serviceconfig`,
              }),
            update: (x) =>
              _.api({
                body: {
                  parameters: x.parameters,
                },
                method: "PUT",
                url: `${prefix}solution/${_.applicationId}/serviceconfig/${x.service}`,
              }),
          };
        case "module":
          return {
            list: () =>
              _.api({
                url: `${prefix}solution/${_.applicationId}/module`,
              }),
            update: (x) =>
              _.api({
                body: {
                  alias: `${_.applicationId}_${x.name}`,
                  name: x.name,
                  solution_id: _.applicationId,
                  script: x.script,
                },
                method: "PUT",
                url: `${prefix}solution/${_.applicationId}/module/${_.applicationId}_${x.name}`,
              }),
            delete: (x) =>
              _.api({
                method: "DELETE",
                url: `${prefix}solution/${_.applicationId}/module/${_.applicationId}_${x.name}`,
              }),
          };
        case "fileupload":
          return (x) =>
            _.api({
              body: x.formData,
              headers: x.formData.getHeaders(),
              method: "PUT",
              url: `${prefix}solution/${
                _.applicationId
              }/fileupload/${x.path.replace(/^\//, "")}`,
            });
        case "endpoint":
          return {
            list: () =>
              _.api({
                url: `${prefix}solution/${_.applicationId}/endpoint`,
              }),
            add: (x) =>
              _.api({
                body: {
                  content_type: x.content_type,
                  method: x.method,
                  path: x.path,
                  script: x.script,
                },
                method: "POST",
                url: `${prefix}solution/${_.applicationId}/endpoint`,
              }),
            update: (x) =>
              _.api({
                body: {
                  content_type: x.content_type,
                  method: x.method,
                  path: x.path,
                  script: x.script,
                },
                method: "PUT",
                url: `${prefix}solution/${_.applicationId}/endpoint/${x.id}`,
              }),
            delete: (x) =>
              _.api({
                method: "DELETE",
                url: `${prefix}solution/${_.applicationId}/endpoint/${x.id}`,
              }),
          };
        case "eventHandler":
          return {
            list: () =>
              _.api({
                url: `${prefix}solution/${_.applicationId}/eventhandler`,
              }),
            update: (x) =>
              _.api({
                body: {
                  alias: `${_.applicationId}_${x.name}`,
                  solution_id: _.applicationId,
                  script: x.script,
                },
                method: "PUT",
                url: `${prefix}solution/${_.applicationId}/eventhandler/${_.applicationId}_${x.name}`,
              }),
          };
        case "exchange":
          return {
            element: () =>
              _.api({
                url: `${prefix}exchange/${_.businessId}/element/`,
              }),
            purchased: () =>
              _.api({
                url: `${prefix}exchange/${_.businessId}/purchase/`,
              }),
            purchase: (x) =>
              _.api({
                body: {
                  elementId: x.elementId,
                  type: "service",
                  solutionId: _.applicationId,
                },
                url: `${prefix}exchange/${_.businessId}/purchase/`,
              }),
          };
        default:
          return new Proxy(
            {
              solutionId: service === "device2" ? _.productId : _.applicationId,
            },
            {
              get: (__, method) => (body) => {
                let url = `${prefix}solution/${__.solutionId}/serviceconfig/${service}/call/${method}`;
                if (service === "user" && method === "createUserData") {
                  url = `${prefix}solution/${__.solutionId}/user/${body.id}/storage`;
                  delete body.id;
                }
                if (method === "querySignals") {
                  url = `${prefix}service/${_.productId}/device2/identity/${body.identity}/signals/query`;
                  delete body.identity;
                }
                return _.api({ body, url }).pipe(
                  map((x) => {
                    if (method === "countIdentities" && x === "") {
                      return 0;
                    } else {
                      return x;
                    }
                  })
                );
              },
            }
          );
      }
    },
  };

  return new Proxy(target, handler);
};

module.exports = {
  Biz,
};
